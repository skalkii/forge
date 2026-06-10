import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_DISCLOSURE_TEXT } from "../../lib/disclosure";
import {
  assertPostingAllowed,
  OperateRefusedError,
  postGithubComment,
  type PostingGateDeps,
} from "./github-comment";

const goodBody = `helpful reply\n\n${DEFAULT_DISCLOSURE_TEXT}`;

const okDeps: PostingGateDeps = {
  isKillSwitchOn: async () => false,
  authMode: () => "pat",
  authenticatedLogin: async () => "someuser",
};

afterEach(() => {
  delete process.env.TOUCHES_ENABLED;
  delete process.env.GITHUB_POST_AS;
});

describe("assertPostingAllowed — every gate fails closed", () => {
  it("refuses when TOUCHES_ENABLED is not 'true'", async () => {
    await expect(assertPostingAllowed(goodBody, okDeps)).rejects.toThrow(/TOUCHES_ENABLED/);
  });

  it("refuses a body missing the disclosure (R3)", async () => {
    process.env.TOUCHES_ENABLED = "true";
    await expect(assertPostingAllowed("no disclosure here", okDeps)).rejects.toThrow(/disclosure/);
  });

  it("refuses when the kill-switch is on (R6)", async () => {
    process.env.TOUCHES_ENABLED = "true";
    const deps: PostingGateDeps = { ...okDeps, isKillSwitchOn: async () => true };
    await expect(assertPostingAllowed(goodBody, deps)).rejects.toThrow(/kill-switch/);
  });

  it("refuses non-PAT auth — posting identity must be a human account", async () => {
    process.env.TOUCHES_ENABLED = "true";
    const deps: PostingGateDeps = { ...okDeps, authMode: () => "app" };
    await expect(assertPostingAllowed(goodBody, deps)).rejects.toThrow(/human account PAT/);
  });

  it("refuses when authenticated login does not match GITHUB_POST_AS", async () => {
    process.env.TOUCHES_ENABLED = "true";
    process.env.GITHUB_POST_AS = "expected-human";
    await expect(assertPostingAllowed(goodBody, okDeps)).rejects.toThrow(/GITHUB_POST_AS/);
  });

  it("passes when every gate is green (login match is case-insensitive)", async () => {
    process.env.TOUCHES_ENABLED = "true";
    process.env.GITHUB_POST_AS = "SomeUser";
    await expect(assertPostingAllowed(goodBody, okDeps)).resolves.toBeUndefined();
  });
});

describe("postGithubComment", () => {
  it("refuses before any URL parsing or network call when gates fail", async () => {
    await expect(
      postGithubComment({ threadUrl: "not-a-url", body: goodBody }),
    ).rejects.toThrow(OperateRefusedError);
  });
});
