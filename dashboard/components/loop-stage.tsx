import type { LoopStage } from "@/components/nav-items";

/** Where each page sits on the Sense → Qualify → Craft → Gate → Act → Observe loop. */
const STAGE: Record<LoopStage, { label: string; cls: string; tip: string }> = {
  overview: {
    label: "Overview",
    cls: "bg-muted text-muted-foreground",
    tip: "A bird's-eye view across the whole loop.",
  },
  sense: {
    label: "1 · Sense",
    cls: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    tip: "Finding developers publicly stuck on problems VideoDB solves.",
  },
  qualify: {
    label: "2 · Qualify",
    cls: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
    tip: "Judging whether VideoDB is genuinely the best answer.",
  },
  craft: {
    label: "3 · Craft",
    cls: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    tip: "Writing a helpful reply from a pre-tested code example.",
  },
  gate: {
    label: "4 · Human gate",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    tip: "A person approves, edits, or rejects every reply before it posts.",
  },
  act: {
    label: "5 · Act",
    cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    tip: "Posting the approved reply, tagged so results can be traced.",
  },
  observe: {
    label: "6 · Observe",
    cls: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
    tip: "Measuring activations and cost, and learning from outcomes.",
  },
  ops: {
    label: "Operations",
    cls: "bg-stone-500/12 text-stone-700 dark:text-stone-300",
    tip: "Configuration, health, and the safety controls that keep a human in charge.",
  },
};

export function LoopStageChip({ stage }: { stage: LoopStage }) {
  const s = STAGE[stage];
  return (
    <span
      title={s.tip}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
