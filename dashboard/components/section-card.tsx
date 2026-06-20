import type { ReactNode } from "react";

import { InfoTip } from "@/components/info-tip";
import type { GlossaryKey } from "@/lib/glossary";

/**
 * A titled panel with a built-in one-line description, so no section on any
 * page is unlabeled. Optional glossary `term` adds an ⓘ definition next to the
 * title; `aside` is a right-aligned slot (a link, a count, a filter).
 */
export function SectionCard({
  title,
  description,
  term,
  aside,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  description?: ReactNode;
  term?: GlossaryKey;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`surface overflow-hidden ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-brand-2"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
              {term ? <InfoTip term={term} /> : null}
            </div>
            {description ? (
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {aside ? <div className="shrink-0 text-[0.8125rem] text-muted-foreground">{aside}</div> : null}
      </header>
      <div className={bodyClassName || "p-4"}>{children}</div>
    </section>
  );
}
