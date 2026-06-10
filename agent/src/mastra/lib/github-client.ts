/**
 * Single chokepoint for ALL GitHub API traffic (R4).
 *
 * Two budgets, never one: the Search API (~30 req/min) is a separate,
 * much smaller pool than core REST (~15k/hr for an App installation).
 * Both are read live from x-ratelimit-* response headers — never
 * hardcoded, since core limits vary by installation size.
 *
 * Rules enforced here:
 *  - pre-flight refuses a call when its budget is exhausted (BudgetExhaustedError)
 *  - Retry-After is surfaced as RetryAfterError; callers wait, never hammer
 *  - mutating requests are serialized ≥ WRITE_GAP_MS apart
 *  - every request is logged to github_requests (best-effort) so the
 *    dashboard budget meter reflects reality
 *
 * Auth: GITHUB_TOKEN (PAT) if set, else GitHub App
 * (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY / GITHUB_APP_INSTALLATION_ID),
 * else unauthenticated (60 core/hr, 10 search/min — dev only).
 */
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

import { getPool } from "./db";

const WRITE_GAP_MS = 1000;

export type GithubResource = "search" | "core" | (string & {});

export interface RateBudget {
  resource: GithubResource;
  limit: number | null;
  remaining: number | null;
  resetAt: Date | null;
  updatedAt: Date;
}

export class BudgetExhaustedError extends Error {
  constructor(
    public readonly resource: GithubResource,
    public readonly resetAt: Date | null,
  ) {
    super(
      `GitHub ${resource} budget exhausted${resetAt ? `; resets ${resetAt.toISOString()}` : ""}`,
    );
    this.name = "BudgetExhaustedError";
  }
}

export class RetryAfterError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    public readonly status: number,
  ) {
    super(`GitHub asked to retry after ${retryAfterSeconds}s (HTTP ${status})`);
    this.name = "RetryAfterError";
  }
}

type Headers = Record<string, string | number | undefined>;

function resourceFor(url: string, headers?: Headers): GithubResource {
  const fromHeader = headers?.["x-ratelimit-resource"];
  if (typeof fromHeader === "string" && fromHeader.length > 0) return fromHeader;
  return url.startsWith("/search/") || url.includes("/search/") ? "search" : "core";
}

function intHeader(headers: Headers, name: string): number | null {
  const v = headers[name];
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type AuthMode = "pat" | "app" | "unauthenticated";

export class GithubClient {
  readonly octokit: Octokit;
  readonly authMode: AuthMode;
  private readonly budgets = new Map<GithubResource, RateBudget>();
  private lastWriteAt = 0;

  constructor() {
    const { octokit, authMode } = buildOctokit();
    this.octokit = octokit;
    this.authMode = authMode;

    this.octokit.hook.wrap("request", async (request, options) => {
      const url = String(options.url ?? "");
      const method = String(options.method ?? "GET").toUpperCase();
      this.preflight(resourceFor(url));
      if (method !== "GET" && method !== "HEAD") await this.serializeWrite();

      const started = Date.now();
      try {
        const response = await request(options);
        const headers = (response.headers ?? {}) as Headers;
        const resource = resourceFor(url, headers);
        this.updateBudget(resource, headers);
        this.log(resource, method, url, response.status, headers, Date.now() - started);
        return response;
      } catch (err) {
        const e = err as { status?: number; response?: { headers?: Headers } };
        const headers = e.response?.headers ?? {};
        const resource = resourceFor(url, headers);
        this.updateBudget(resource, headers);
        this.log(resource, method, url, e.status ?? null, headers, Date.now() - started);
        const retryAfter = intHeader(headers, "retry-after");
        if (retryAfter !== null && (e.status === 403 || e.status === 429)) {
          throw new RetryAfterError(retryAfter, e.status);
        }
        throw err;
      }
    });
  }

  getBudgets(): RateBudget[] {
    return [...this.budgets.values()];
  }

  getBudget(resource: GithubResource): RateBudget | undefined {
    return this.budgets.get(resource);
  }

  private preflight(resource: GithubResource): void {
    const b = this.budgets.get(resource);
    if (!b || b.remaining === null) return;
    if (b.remaining > 0) return;
    if (b.resetAt && b.resetAt.getTime() <= Date.now()) return; // window rolled over
    throw new BudgetExhaustedError(resource, b.resetAt);
  }

  private async serializeWrite(): Promise<void> {
    const wait = this.lastWriteAt + WRITE_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastWriteAt = Date.now();
  }

  private updateBudget(resource: GithubResource, headers: Headers): void {
    const limit = intHeader(headers, "x-ratelimit-limit");
    const remaining = intHeader(headers, "x-ratelimit-remaining");
    const reset = intHeader(headers, "x-ratelimit-reset");
    if (limit === null && remaining === null) return;
    this.budgets.set(resource, {
      resource,
      limit,
      remaining,
      resetAt: reset !== null ? new Date(reset * 1000) : null,
      updatedAt: new Date(),
    });
  }

  /** Best-effort: never let the budget log break a GitHub call. */
  private log(
    resource: GithubResource,
    method: string,
    route: string,
    status: number | null,
    headers: Headers,
    latencyMs: number,
  ): void {
    const reset = intHeader(headers, "x-ratelimit-reset");
    void getPool()
      .query(
        `INSERT INTO github_requests
           (resource, method, route, status, rate_limit, rate_remaining, rate_reset_at, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          resource,
          method,
          route,
          status,
          intHeader(headers, "x-ratelimit-limit"),
          intHeader(headers, "x-ratelimit-remaining"),
          reset !== null ? new Date(reset * 1000) : null,
          latencyMs,
        ],
      )
      .catch((err) => console.warn("[github-client] request log failed:", err.message));
  }
}

function buildOctokit(): { octokit: Octokit; authMode: AuthMode } {
  const pat = process.env.GITHUB_TOKEN;
  if (pat) return { octokit: new Octokit({ auth: pat }), authMode: "pat" };

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  if (appId && privateKey && installationId) {
    return {
      octokit: new Octokit({
        authStrategy: createAppAuth,
        auth: { appId, privateKey, installationId: Number(installationId) },
      }),
      authMode: "app",
    };
  }

  console.warn(
    "[github-client] no GITHUB_TOKEN or GitHub App credentials — running unauthenticated (60 core/hr, 10 search/min)",
  );
  return { octokit: new Octokit(), authMode: "unauthenticated" };
}

let client: GithubClient | undefined;

export function getGithubClient(): GithubClient {
  if (!client) client = new GithubClient();
  return client;
}
