import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getPool } from "../../lib/db";
import { getGithubClient } from "../../lib/github-client";
import { assertPostingAllowed, OperateRefusedError } from "./github-comment";

/**
 * Cookbook-PR escalation (R2): when no snippet template fits but the
 * problem is worth a worked example, a human-approved workflow step opens
 * a PR against the cookbook repo. Same rules as github-comment: attached
 * to NO agent, deterministic post-approval invocation only, all
 * assertPostingAllowed refusals apply (disclosure goes in the PR body).
 */

export interface GithubPrInput {
  repo: string; // "owner/name"
  branchName: string;
  filePath: string;
  fileContent: string;
  commitMessage: string;
  title: string;
  body: string;
  baseBranch?: string;
}

export interface GithubPrResult {
  prUrl: string;
  prNumber: number;
}

export async function openGithubPr(input: GithubPrInput): Promise<GithubPrResult> {
  await assertPostingAllowed(input.body);

  const [owner, repo] = input.repo.split("/");
  if (!owner || !repo) {
    throw new OperateRefusedError(`repo must be "owner/name", got: ${input.repo}`);
  }

  const client = getGithubClient();
  const octokit = client.octokit;

  const base =
    input.baseBranch ?? (await octokit.rest.repos.get({ owner, repo })).data.default_branch;
  const baseRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${base}` });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${input.branchName}`,
    sha: baseRef.data.object.sha,
  });

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: input.filePath,
    message: input.commitMessage,
    content: Buffer.from(input.fileContent, "utf8").toString("base64"),
    branch: input.branchName,
  });

  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    title: input.title,
    body: input.body,
    head: input.branchName,
    base,
  });

  await getPool().query(
    `INSERT INTO audit_log (actor, action, subject_table, subject_id, detail)
     VALUES ('system', 'github.pr.opened', 'touches', NULL, $1)`,
    [JSON.stringify({ repo: input.repo, prUrl: pr.data.html_url })],
  );

  return { prUrl: pr.data.html_url, prNumber: pr.data.number };
}

/** Workflow-only tool — never attach to an Agent. */
export const githubPrTool = createTool({
  id: "github-pr",
  description:
    "Open a cookbook pull request (branch + file + PR). Deterministic post-approval step only; refuses without kill-switch off, disclosure present, and human PAT identity.",
  inputSchema: z.object({
    repo: z.string().describe('target repository as "owner/name"'),
    branchName: z.string().min(1),
    filePath: z.string().min(1),
    fileContent: z.string().min(1),
    commitMessage: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1).describe("PR description, disclosure included"),
    baseBranch: z.string().optional(),
  }),
  outputSchema: z.object({
    prUrl: z.string(),
    prNumber: z.number(),
  }),
  execute: async (input) => openGithubPr(input),
});
