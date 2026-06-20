"use client";

import { usePathname } from "next/navigation";

import { LoopStageChip } from "@/components/loop-stage";
import { navItemFor } from "@/components/nav-items";

/** Header breadcrumb: section name + loop stage, derived from the current route. */
export function PageTitle() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  if (!item) return null;
  const Icon = item.icon;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="font-medium">{item.label}</span>
      <span className="hidden md:inline">
        <LoopStageChip stage={item.stage} />
      </span>
      <span className="hidden truncate text-xs text-muted-foreground lg:inline">{item.blurb}</span>
    </div>
  );
}
