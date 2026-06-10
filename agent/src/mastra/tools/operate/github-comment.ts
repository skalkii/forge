import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getPool } from "../../lib/db";
import { disclosureText } from "../../lib/disclosure";
import { getGithubClient } from "../../lib/github-client";

/**
 * operate/* tools are attached to NO agent (constraint #2): an LLM must
 * never be able to post. They are invoked only by deterministic workflow
 * steps that run AFTER human approval. Defense-in-depth refusals here,
 * independent of the workflow's own checks:
 *   - TOUCHES_ENABLED must be exactly "true"
 *   - global kill-switch (settings row or KILL_SWITCH env, R6) must be off
 *   - body must contain the affiliation disclosure verbatim (R3)
 *   - GitHub auth must be a human PAT, never the App/bot identity; when
 *     GITHUB_POST_AS is set, the authenticated login must match it
 */

export class OperateRefusedError extends Error {
  constructor(reason: string) {
    super(`public action refused: ${reason}`);
    this.name = "OperateRefusedError";
  }
}

export interface PostingGateDeps {
  isKillSwitchOn(): Promise<boolean>;
  authMode(): string;
  authenticatedLogin(): Promise<string>;
}

export const prodPostingGateDeps: PostingGateDeps = {
  async isKillSwitchOn() {
    if (process.env.KILL_SWITCH === "true") return true;
    const { rows } = await getPool().query(`SELECT value FROM settings WHERE key = 'kill_switch'`);
    return rows[0]?.value === true;
  },
  authMode: () => getGithubClient().authMode,
  async authenticatedLogin() {
    const { data } = await getGithubClient().octokit.rest.users.getAuthenticated();
    return data.login;
  },
};

/** shared gate for every operate/* tool — throws OperateRefusedError */
export async function assertPostingAllowed(
  body: string,
  deps: PostingGateDeps = prodPostingGateDeps,
): Promise<void> {
  if (process.env.TOUCHES_ENABLED !== "true") {
    throw new OperateRefusedError("TOUCHES_ENABLED is not 'true'");
  }
  if (!body.includes(disclosureText())) {
    throw new OperateRefusedError("body is missing the affiliation disclosure (R3)");
  }
  if (await deps.isKillSwitchOn()) {
    throw new OperateRefusedError("global kill-switch is ON (R6)");
  }
  const authMode = deps.authMode();
  if (authMode !== "pat") {
    throw new OperateRefusedError(
      `posting requires a human account PAT, auth mode is "${authMode}"`,
    );
  }
  const postAs = process.env.GITHUB_POST_AS;
  if (postAs) {
    const login = await deps.authenticatedLogin();
    if (login.toLowerCase() !== postAs.toLowerCase()) {
      throw new OperateRefusedError(
        `authenticated as "${login}" but GITHUB_POST_AS is "${postAs}"`,
      );
    }
  }
}

const THREAD_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/;

export interface GithubCommentInput {
  threadUrl: string;
  body: string;
}

export interface GithubCommentResult {
  commentUrl: string;
  commentId: number;
}

export async function postGithubComment({
  threadUrl,
  body,
}: GithubCommentInput): Promise<GithubCommentResult> {
  await assertPostingAllowed(body);

  const match = THREAD_URL.exec(threadUrl);
  if (!match) {
    throw new OperateRefusedError(`unsupported thread URL (issues/PRs only): ${threadUrl}`);
  }
  const [, owner, repo, issueNumber] = match;

  const client = getGithubClient();
  const { data } = await client.octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: Number(issueNumber),
    body,
  });

  await getPool().query(
    `INSERT INTO audit_log (actor, action, subject_table, subject_id, detail)
     VALUES ('system', 'github.comment.posted', 'touches', NULL, $1)`,
    [JSON.stringify({ threadUrl, commentUrl: data.html_url })],
  );

  return { commentUrl: data.html_url, commentId: data.id };
}

/** Workflow-only tool — never attach to an Agent. */
export const githubCommentTool = createTool({
  id: "github-comment",
  description:
    "POST a public reply to a GitHub issue/PR thread. Deterministic post-approval step only; refuses without kill-switch off, disclosure present, and human PAT identity.",
  inputSchema: z.object({
    threadUrl: z.string().describe("https://github.com/{owner}/{repo}/issues/{n} or /pull/{n}"),
    body: z.string().min(1).describe("final approved reply body, disclosure included"),
  }),
  outputSchema: z.object({
    commentUrl: z.string(),
    commentId: z.number(),
  }),
  execute: async (input) => postGithubComment(input),
});
