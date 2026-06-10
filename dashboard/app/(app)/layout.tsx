import { Nav } from "@/components/nav";
import { LiveBadge } from "@/components/live-badge";
import { KillSwitch } from "@/components/kill-switch";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-52 shrink-0 flex-col border-r">
        <div className="px-5 py-4">
          <div className="font-heading text-lg font-semibold tracking-tight">forge</div>
          <div className="text-xs text-muted-foreground">VideoDB Growth Agent</div>
        </div>
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-2 border-b px-6 py-3">
          <KillSwitch />
          <LiveBadge />
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
