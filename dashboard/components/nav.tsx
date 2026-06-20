"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/components/nav-items";

export function Nav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        const base = `group/nav relative flex items-center rounded-lg text-sm transition-colors ${
          collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2"
        }`;
        return item.built ? (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? `${item.label} — ${item.blurb}` : item.blurb}
            aria-label={item.label}
            className={`${base} ${
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            }`}
          >
            {active && !collapsed ? (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
            ) : null}
            <Icon className={`size-4.5 shrink-0 ${active ? "text-primary" : ""}`} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ) : (
          <span
            key={item.href}
            title={`${item.blurb} (coming soon)`}
            className={`${base} text-muted-foreground/50`}
          >
            <Icon className="size-4.5 shrink-0" />
            {!collapsed && (
              <>
                {item.label}
                <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
