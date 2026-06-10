import { z } from "zod";

import { getSnippetTemplate, type SnippetTemplate } from "./registry";

/**
 * Select-and-fill rendering (R2). Params are injected as *Python literals*
 * (JSON-encoded strings, bare numbers, True/False) so a malicious or odd
 * param value can never break out of the snippet — these land in public
 * GitHub comments under a human's name.
 */
export class SnippetRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnippetRenderError";
  }
}

export function pyLiteral(value: unknown): string {
  switch (typeof value) {
    case "string":
      // JSON string escapes are a strict subset of valid Python string syntax
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new SnippetRenderError(`non-finite number: ${value}`);
      return String(value);
    case "boolean":
      return value ? "True" : "False";
    default:
      throw new SnippetRenderError(`unsupported param type: ${typeof value}`);
  }
}

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

export function renderSnippet(
  templateId: string,
  params: Record<string, unknown>,
): { code: string; template: SnippetTemplate } {
  const template = getSnippetTemplate(templateId);
  if (!template) throw new SnippetRenderError(`unknown template: ${templateId}`);

  const parsed = template.params.safeParse(params);
  if (!parsed.success) {
    throw new SnippetRenderError(
      `invalid params for ${templateId}: ${z.prettifyError(parsed.error)}`,
    );
  }
  const values = parsed.data as Record<string, unknown>;

  const code = template.code.replace(PLACEHOLDER, (_, key: string) => {
    if (!(key in values)) {
      throw new SnippetRenderError(`template ${templateId} references unknown param {{${key}}}`);
    }
    return pyLiteral(values[key]);
  });

  if (PLACEHOLDER.test(code)) {
    throw new SnippetRenderError(`template ${templateId} left unfilled placeholders after render`);
  }

  return { code, template };
}
