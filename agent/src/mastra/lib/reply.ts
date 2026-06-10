/**
 * Reply composition constants shared by the craft agent, the
 * spam-guardrail scorer, and the (Phase G) compose step — kept out of
 * the agent module so importing them never constructs an Agent.
 */
export const SNIPPET_MARKER = "[[SNIPPET]]";
