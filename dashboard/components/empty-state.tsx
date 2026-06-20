import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Consistent, friendly empty state — explains why a panel is empty and what fills it. */
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {Icon ? (
        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4.5" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children ? (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}
