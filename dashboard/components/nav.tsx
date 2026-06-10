"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/components/nav-items";

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return item.built ? (
          <Link
            key={item.href}
            href={item.href}
            title={item.blurb}
            className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            }`}
          >
            <Icon className={`size-4 shrink-0 ${active ? "text-primary" : ""}`} />
            {item.label}
          </Link>
        ) : (
          <span
            key={item.href}
            title={`${item.blurb} (coming soon)`}
            className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground/50"
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
            <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
          </span>
        );
      })}
    </nav>
  );
}
