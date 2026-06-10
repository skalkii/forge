const sections = [
  { href: "/signals", label: "Signals" },
  { href: "/candidates", label: "Candidates" },
  { href: "/drafts", label: "Drafts" },
  { href: "/runs", label: "Runs" },
  { href: "/snippets", label: "Snippets" },
  { href: "/strategy", label: "Strategy" },
  { href: "/experiments", label: "Experiments" },
  { href: "/costs", label: "Costs" },
  { href: "/errors", label: "Errors" },
  { href: "/settings", label: "Settings" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-lg font-semibold tracking-tight">forge</h1>
          <span className="text-sm text-muted-foreground">VideoDB Growth Agent</span>
        </div>
        <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
          offline
        </span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-muted-foreground">
          Dashboard shell. Panels land module by module — nothing is wired yet.
        </p>
        <nav className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sections.map((s) => (
            <div
              key={s.href}
              className="rounded-lg border bg-card px-4 py-6 text-sm text-card-foreground opacity-60"
            >
              <div className="font-medium">{s.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">soon</div>
            </div>
          ))}
        </nav>
      </main>
    </div>
  );
}
