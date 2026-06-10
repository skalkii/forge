"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { toggleKillSwitch } from "@/lib/kill-switch";

function ToggleButton({ on }: { on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={
        on
          ? "Kill-switch is ON — all public actions are blocked. Click to re-arm."
          : "Kill-switch is off — click to stop every public action immediately (R6)."
      }
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        on
          ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <span className={`size-2 rounded-full ${on ? "bg-rose-500 animate-pulse" : "bg-slate-400"}`} />
      Kill-switch: {pending ? "…" : on ? "ON" : "off"}
    </button>
  );
}

export function KillSwitchToggle({
  on,
  envForced,
  updatedBy,
}: {
  on: boolean;
  envForced: boolean;
  updatedBy: string | null;
}) {
  const actorRef = useRef<HTMLInputElement>(null);

  if (envForced) {
    return (
      <span
        title="KILL_SWITCH=true in the environment — the env override wins; unset it to control from here."
        className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"
      >
        <span className="size-2 rounded-full bg-rose-500" />
        Kill-switch: forced ON by env
      </span>
    );
  }

  return (
    <form
      action={toggleKillSwitch}
      onSubmit={(e) => {
        const verb = on
          ? "Re-arm public actions? Approved touches will be able to post again."
          : "Engage the kill-switch? Every public action stops immediately.";
        const actor = window.prompt(`${verb}\n\nYour name (audit-logged):`);
        if (!actor || actor.trim().length === 0) {
          e.preventDefault();
          return;
        }
        actorRef.current!.value = actor.trim();
      }}
      title={updatedBy ? `last changed by ${updatedBy}` : undefined}
    >
      <input type="hidden" name="next" value={on ? "off" : "on"} />
      <input type="hidden" name="actor" ref={actorRef} />
      <ToggleButton on={on} />
    </form>
  );
}
