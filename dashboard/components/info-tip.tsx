"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * A small "ⓘ" that reveals a plain-English definition on hover or keyboard
 * focus. Built on Base UI Tooltip so the panel renders in a PORTAL — it can
 * never be clipped by a card's `overflow-hidden` or a scroll container, and is
 * fully positioned + accessible. Pass a glossary `term` for a canonical
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
  side?: "top" | "bottom" | "left" | "right";
}) {
  const entry = term ? GLOSSARY[term] : undefined;
  const body = children ?? entry?.def;
  if (!body) return null;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        aria-label={entry ? `Definition: ${entry.term}` : "More information"}
        className={`inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 ${className}`}
      >
        <Info className="size-3.5" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} className="z-[100]">
          <Tooltip.Popup className="max-w-[17rem] rounded-lg border bg-popover p-2.5 text-left text-[0.8125rem] leading-relaxed text-popover-foreground shadow-[var(--shadow-pop)] origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            {entry ? (
              <>
                <span className="mb-0.5 block font-semibold text-foreground">{entry.term}</span>
                <span className="text-muted-foreground">{body}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{body}</span>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
