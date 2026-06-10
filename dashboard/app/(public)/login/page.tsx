import { Flame, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Flame className="size-5" />
            </span>
            <div>
              <h1 className="font-heading text-lg font-semibold leading-tight tracking-tight">
                forge
              </h1>
              <p className="text-[11px] text-muted-foreground">VideoDB Growth Agent</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            This dashboard is the only path to public posting, so it stays locked. Enter the
            review-queue access token to continue.
          </p>
        </div>
        <form method="POST" action="/api/login" className="space-y-4">
          <input
            type="password"
            name="token"
            placeholder="Access token"
            autoComplete="off"
            autoFocus
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
          {error ? (
            <p className="text-sm text-rose-500" role="alert">
              Invalid token.
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Enter
          </Button>
        </form>
        <p className="mt-5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Every public action requires a human reviewer.
        </p>
      </div>
    </div>
  );
}
