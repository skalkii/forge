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
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-medium">{title}</h2>
            {term ? <InfoTip term={term} /> : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0 text-xs text-muted-foreground">{aside}</div> : null}
      </header>
      <div className={bodyClassName || "p-4"}>{children}</div>
    </section>
  );
}
