import type { ReactNode } from "react";

/** Page heading + a plain-English definition of what the page shows. */
export function PageIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
