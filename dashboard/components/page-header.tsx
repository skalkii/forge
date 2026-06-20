import type { ReactNode } from "react";

import { LoopStageChip } from "@/components/loop-stage";
import type { LoopStage } from "@/components/nav-items";

/**
 * The one header every page uses. Title (serif), a chip showing where the page
 * sits in the loop, a plain-English description of what you're looking at, and
 * optionally the database tables the data comes from + right-aligned actions.
 */
export function PageHeader({
  title,
  description,
  stage,
  sources,
  children,
}: {
  title: string;
  description: ReactNode;
  stage?: LoopStage;
  /** the DB tables / sources this page reads, shown as small "from …" chips */
  sources?: string[];
  /** right-aligned actions (filters, buttons) */
  children?: ReactNode;
}) {
  return (
    <header className="space-y-2.5 border-b pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {stage ? <LoopStageChip stage={stage} /> : null}
        </div>
        {children ? <div className="flex items-center gap-2">{children}</div> : null}
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      {sources && sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-muted-foreground/70">data from</span>
          {sources.map((s) => (
            <code
              key={s}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              {s}
            </code>
          ))}
        </div>
      ) : null}
    </header>
  );
}
