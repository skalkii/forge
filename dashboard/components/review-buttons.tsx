"use client";

import { useFormStatus } from "react-dom";

export function ReviewButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        name="decision"
        value="approved"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="submit"
        name="decision"
        value="rejected"
        disabled={pending}
        className="rounded-md border border-rose-600/40 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-400"
      >
        Reject
      </button>
      {pending ? (
        <span className="text-xs text-muted-foreground">resuming the workflow run…</span>
      ) : null}
    </div>
  );
}
