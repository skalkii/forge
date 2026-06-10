import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <div className="mb-6">
          <h1 className="font-heading text-lg font-semibold tracking-tight">forge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review queue access token required.
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
      </div>
    </div>
  );
}
