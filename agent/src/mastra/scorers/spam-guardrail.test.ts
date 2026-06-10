import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_DISCLOSURE_TEXT, disclosureText } from "../lib/disclosure";
import {
  countLinks,
  countMarkers,
  dailyTouchCap,
  runGuardrailChecks,
  type GuardrailDeps,
} from "./spam-guardrail";

const okDeps: GuardrailDeps = {
  isKillSwitchOn: async () => false,
  postedCountToday: async () => 0,
  hasPriorTouch: async () => false,
};

const input = {
  candidateId: "11111111-1111-1111-1111-111111111111",
  author: "someuser",
  threadUrl: "https://github.com/someuser/repo/issues/1",
};

const goodBody = `Your ffmpeg OOM pain is what extract_scenes removes.\n\n[[SNIPPET]]\n\n${DEFAULT_DISCLOSURE_TEXT}`;

afterEach(() => {
  delete process.env.DISCLOSURE_TEXT;
  delete process.env.DAILY_TOUCH_CAP;
  delete process.env.KILL_SWITCH;
});

describe("disclosureText", () => {
  it("falls back to the shipped default", () => {
    expect(disclosureText()).toBe(DEFAULT_DISCLOSURE_TEXT);
  });
  it("prefers a non-empty env override", () => {
    process.env.DISCLOSURE_TEXT = "Disclosure: I work at VideoDB.";
    expect(disclosureText()).toBe("Disclosure: I work at VideoDB.");
  });
  it("ignores a whitespace-only env value", () => {
    process.env.DISCLOSURE_TEXT = "   ";
    expect(disclosureText()).toBe(DEFAULT_DISCLOSURE_TEXT);
  });
});

describe("countLinks / countMarkers / dailyTouchCap", () => {
  it("counts http and https links", () => {
    expect(countLinks("no links")).toBe(0);
    expect(countLinks("see https://a.com and http://b.com")).toBe(2);
  });
  it("counts snippet markers", () => {
    expect(countMarkers("x")).toBe(0);
    expect(countMarkers("a [[SNIPPET]] b")).toBe(1);
    expect(countMarkers("[[SNIPPET]] [[SNIPPET]]")).toBe(2);
  });
  it("defaults the cap to 20 and honors the env", () => {
    expect(dailyTouchCap()).toBe(20);
    process.env.DAILY_TOUCH_CAP = "5";
    expect(dailyTouchCap()).toBe(5);
    process.env.DAILY_TOUCH_CAP = "garbage";
    expect(dailyTouchCap()).toBe(20);
  });
});

describe("runGuardrailChecks", () => {
  it("passes a clean draft", async () => {
    const r = await runGuardrailChecks(input, { replyBody: goodBody }, okDeps);
    expect(r.failures).toEqual([]);
    expect(Object.values(r.checks).every(Boolean)).toBe(true);
  });

  it("hard-fails a missing disclosure (R3)", async () => {
    const r = await runGuardrailChecks(
      input,
      { replyBody: "helpful text\n\n[[SNIPPET]]" },
      okDeps,
    );
    expect(r.checks.disclosure).toBe(false);
    expect(r.failures.join()).toMatch(/disclosure/);
  });

  it("fails an edited/paraphrased disclosure — must be verbatim", async () => {
    const r = await runGuardrailChecks(
      input,
      { replyBody: "text\n\n[[SNIPPET]]\n\nFYI I am affiliated with VideoDB." },
      okDeps,
    );
    expect(r.checks.disclosure).toBe(false);
  });

  it("blocks when the kill-switch is on (R6)", async () => {
    const r = await runGuardrailChecks(
      input,
      { replyBody: goodBody },
      { ...okDeps, isKillSwitchOn: async () => true },
    );
    expect(r.checks.killSwitch).toBe(false);
    expect(r.failures.join()).toMatch(/kill-switch/);
  });

  it("blocks at the daily cap boundary", async () => {
    process.env.DAILY_TOUCH_CAP = "3";
    const at = await runGuardrailChecks(
      input,
      { replyBody: goodBody },
      { ...okDeps, postedCountToday: async () => 3 },
    );
    expect(at.checks.dailyCap).toBe(false);
    const under = await runGuardrailChecks(
      input,
      { replyBody: goodBody },
      { ...okDeps, postedCountToday: async () => 2 },
    );
    expect(under.checks.dailyCap).toBe(true);
  });

  it("blocks a duplicate author/thread", async () => {
    const r = await runGuardrailChecks(
      input,
      { replyBody: goodBody },
      { ...okDeps, hasPriorTouch: async () => true },
    );
    expect(r.checks.dedup).toBe(false);
    expect(r.failures.join()).toMatch(/already touched/);
  });

  it("blocks links in the draft", async () => {
    const r = await runGuardrailChecks(
      input,
      { replyBody: `${goodBody}\nsee https://videodb.io` },
      okDeps,
    );
    expect(r.checks.links).toBe(false);
  });

  it("requires exactly one snippet marker", async () => {
    const none = await runGuardrailChecks(
      input,
      { replyBody: `prose only\n\n${DEFAULT_DISCLOSURE_TEXT}` },
      okDeps,
    );
    expect(none.checks.marker).toBe(false);
    const two = await runGuardrailChecks(
      input,
      { replyBody: `[[SNIPPET]] [[SNIPPET]]\n\n${DEFAULT_DISCLOSURE_TEXT}` },
      okDeps,
    );
    expect(two.checks.marker).toBe(false);
  });

  it("accumulates multiple failures", async () => {
    process.env.KILL_SWITCH = "true";
    const r = await runGuardrailChecks(
      input,
      { replyBody: "spam https://x.com" },
      {
        isKillSwitchOn: async () => process.env.KILL_SWITCH === "true",
        postedCountToday: async () => 999,
        hasPriorTouch: async () => true,
      },
    );
    expect(r.failures.length).toBe(6);
  });
});
