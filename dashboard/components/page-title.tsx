"use client";

import { usePathname } from "next/navigation";

import { navItems } from "@/components/nav-items";

/** Header breadcrumb: section name derived from the current route. */
export function PageTitle() {
  const pathname = usePathname();
  const item =
    navItems.find((i) => i.href !== "/" && pathname.startsWith(i.href)) ??
    navItems.find((i) => i.href === pathname);
  if (!item) return null;
  const Icon = item.icon;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="font-medium">{item.label}</span>
      <span className="hidden truncate text-xs text-muted-foreground md:inline">{item.blurb}</span>
    </div>
  );
}
