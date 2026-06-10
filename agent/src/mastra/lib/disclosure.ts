/**
 * R3 — affiliation disclosure, mandatory on every public touch.
 * Single source of truth: injected into craft-agent instructions and
 * deterministically checked by the spam-guardrail scorer (hard fail).
 * VideoDB's preferred wording is tracked in OPEN_QUESTIONS.md; this
 * default ships so nothing blocks on it.
 */
export const DEFAULT_DISCLOSURE_TEXT =
  "Disclosure: I work with the VideoDB team, so I'm biased — but this is exactly the problem the product was built for.";

export function disclosureText(): string {
  const fromEnv = process.env.DISCLOSURE_TEXT?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DISCLOSURE_TEXT;
}
