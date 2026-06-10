import { describe, expect, it } from "vitest";

import { assignVariant, buildUtmLink, VARIANTS } from "./attribution";

describe("assignVariant", () => {
  it("is deterministic — same candidate always lands in the same arm", () => {
    const id = "60cef481-e635-4940-8905-6554ebaf3d9b";
    expect(assignVariant(id)).toBe(assignVariant(id));
  });

  it("only produces known variants and uses more than one arm", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) {
      const v = assignVariant(`candidate-${i}`);
      expect(VARIANTS).toContain(v);
      seen.add(v);
    }
    expect(seen.size).toBe(VARIANTS.length);
  });
});

describe("buildUtmLink", () => {
  const touchId = "b1946ac9-2f9c-4d52-a9f1-0123456789ab";

  it("carries the touch id on utm_campaign — the attribution join key", () => {
    const url = new URL(buildUtmLink(touchId).replace(/^Docs: /, ""));
    expect(url.searchParams.get("utm_campaign")).toBe(touchId);
    expect(url.searchParams.get("utm_source")).toBe("github");
    expect(url.searchParams.get("utm_medium")).toBe("agent-touch");
  });

  it("rides the variant on utm_content when assigned (R5)", () => {
    const url = new URL(buildUtmLink(touchId, "B").replace(/^Docs: /, ""));
    expect(url.searchParams.get("utm_content")).toBe("B");
    expect(url.searchParams.get("utm_campaign")).toBe(touchId);
  });

  it("omits utm_content when no experiment is running", () => {
    const url = new URL(buildUtmLink(touchId, null).replace(/^Docs: /, ""));
    expect(url.searchParams.has("utm_content")).toBe(false);
  });
});
