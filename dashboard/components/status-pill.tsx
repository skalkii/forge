/** Candidate lifecycle, in pipeline order — drives filter chips and pill colors. */
export const CANDIDATE_STATUSES = [
  "queued",
  "enriching",
  "qualifying",
  "crafting",
  "review",
  "approved",
  "posted",
  "activated",
  "rejected",
  "dropped",
  "failed",
];

const PILL: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  enriching: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  qualifying: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  crafting: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  posted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  activated: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  dropped: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const HINT: Record<string, string> = {
  queued: "waiting for the dispatcher to start a touch run",
  enriching: "gathering extra context (Exa/Parallel)",
  qualifying: "strong model judging whether VideoDB genuinely fits",
  crafting: "selecting a snippet template and drafting the reply",
  review: "draft suspended at the human gate — a reviewer decides",
  approved: "reviewer approved; act step is posting",
  posted: "reply posted publicly with disclosure + UTM link",
  activated: "attributed to a first successful API call",
  rejected: "reviewer rejected the draft",
  dropped: "qualify said VideoDB is not genuinely the answer",
  failed: "errored or blocked by the spam guardrail",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      title={HINT[status] ?? status}
      className={`rounded px-1.5 py-0.5 font-medium ${PILL[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
