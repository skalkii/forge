"use client";

import { ScrollArea } from "@base-ui/react/scroll-area";
import type { ReactNode } from "react";

/**
 * A fixed-height scroll container for long lists/tables, with a thin, polished,
 * theme-aware scrollbar that appears on hover/scroll. Keeps any list from
 * pushing the page arbitrarily long — content scrolls inside a stable box.
 * `maxH` is a Tailwind max-height class (e.g. "max-h-[32rem]").
 */
export function ScrollList({
  children,
  maxH = "max-h-[28rem]",
  className = "",
}: {
  children: ReactNode;
  maxH?: string;
  className?: string;
}) {
  return (
    <ScrollArea.Root className={`relative ${className}`}>
      <ScrollArea.Viewport
        className={`${maxH} w-full rounded-[inherit] focus-visible:outline-none`}
      >
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="m-0.5 flex w-1.5 justify-center rounded-full opacity-0 transition-opacity delay-100 duration-150 data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[scrolling]:opacity-100 data-[scrolling]:delay-0"
      >
        <ScrollArea.Thumb className="w-full rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/60" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
