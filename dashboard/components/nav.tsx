"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: { href: string; label: string; built: boolean }[] = [
  { href: "/", label: "Overview", built: true },
  { href: "/signals", label: "Signals", built: false },
  { href: "/candidates", label: "Candidates", built: false },
  { href: "/drafts", label: "Drafts", built: false },
  { href: "/runs", label: "Runs", built: false },
  { href: "/snippets", label: "Snippets", built: false },
  { href: "/strategy", label: "Strategy", built: true },
  { href: "/experiments", label: "Experiments", built: false },
  { href: "/costs", label: "Costs", built: false },
  { href: "/errors", label: "Errors", built: false },
  { href: "/settings", label: "Settings", built: true },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((item) =>
        item.built ? (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              pathname === item.href
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.href}
            className="flex items-baseline justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground/50"
          >
            {item.label}
            <span className="text-[10px] uppercase tracking-wide">soon</span>
          </span>
        ),
      )}
    </nav>
  );
}
