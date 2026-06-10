import { Flame, ShieldCheck } from "lucide-react";

import { KillSwitch } from "@/components/kill-switch";
import { LiveBadge } from "@/components/live-badge";
import { Nav } from "@/components/nav";
import { PageTitle } from "@/components/page-title";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Flame className="size-4.5" />
          </span>
          <div>
            <div className="font-heading text-lg font-semibold leading-tight tracking-tight">forge</div>
            <div className="text-[11px] text-muted-foreground">VideoDB Growth Agent</div>
          </div>
        </div>
        <Nav />
        <div className="mt-auto px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Human-approved, always
          </p>
          <p className="mt-1">No public action posts without a reviewer.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-background/90 px-6 py-3 backdrop-blur">
          <PageTitle />
          <div className="flex shrink-0 items-center gap-2">
            <KillSwitch />
            <LiveBadge />
            <ThemeSwitcher />
          </div>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>

        <footer className="border-t px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              <span className="font-heading font-semibold text-foreground">forge</span> · growth
              agent for{" "}
              <a
                href="https://videodb.io"
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                VideoDB
              </a>{" "}
              · metric: cost per activated developer
            </p>
            <div className="flex items-center gap-4">
              <span>Sense → Qualify → Craft → Human gate → Act → Observe</span>
              <a
                href="https://github.com/skalkii/forge"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
              >
                <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
                source
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
