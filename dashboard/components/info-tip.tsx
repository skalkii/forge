import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * A small "ⓘ" that reveals a plain-English definition on hover or keyboard
 * focus. Server-rendered (no JS) and accessible: the trigger is focusable and
 * the panel is exposed as a tooltip. Pass a glossary `term` for a canonical
 * definition, or custom `children` for one-off explanations.
 */
export function InfoTip({
  term,
  children,
  className = "",
  side = "top",
}: {
  term?: GlossaryKey;
  children?: ReactNode;
  className?: string;
  side?: "top" | "bottom";
}) {
  const entry = term ? GLOSSARY[term] : undefined;
  const body = children ?? entry?.def;
  if (!body) return null;

  const pos =
    side === "top"
      ? "bottom-full mb-1.5 left-1/2 -translate-x-1/2"
      : "top-full mt-1.5 left-1/2 -translate-x-1/2";

  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      <button
        type="button"
        tabIndex={0}
        aria-label={entry ? `Definition: ${entry.term}` : "More information"}
        className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Info className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-64 rounded-lg border bg-popover p-2.5 text-left text-xs leading-relaxed text-popover-foreground opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${pos}`}
      >
        {entry ? (
          <>
            <span className="mb-0.5 block font-medium text-foreground">{entry.term}</span>
            <span className="text-muted-foreground">{body}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{body}</span>
        )}
      </span>
    </span>
  );
}
