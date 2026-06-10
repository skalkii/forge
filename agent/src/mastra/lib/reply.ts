/**
 * Reply composition constants shared by the craft agent, the
 * spam-guardrail scorer, and the (Phase G) compose step — kept out of
 * the agent module so importing them never constructs an Agent.
 */
export const SNIPPET_MARKER = "[[SNIPPET]]";

/**
 * Splice the rendered snippet into the drafted prose. Callers must have
 * verified exactly one marker (the spam-guardrail does); replacement uses
 * a function so `$`-sequences in code can't be misread as patterns.
 */
export function composeReply(replyBody: string, snippetCode: string): string {
  const block = ["```python", snippetCode.trim(), "```"].join("\n");
  return replyBody.replace(SNIPPET_MARKER, () => block);
}
