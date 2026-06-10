"use client";

// Stub until the DB-backed KILL_SWITCH flag lands (Phase H). Always shows
// armed/off state and cannot be toggled yet.
export function KillSwitch() {
  return (
    <button
      type="button"
      disabled
      title="Kill-switch — wired to the DB flag in a later commit"
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground opacity-70"
    >
      <span className="size-2 rounded-full bg-slate-400" />
      Kill-switch: off
    </button>
  );
}
