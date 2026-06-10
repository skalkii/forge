"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { requeueCandidate } from "@/app/(app)/errors/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-amber-600/40 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400"
    >
      {pending ? "re-queuing…" : "Re-queue candidate"}
    </button>
  );
}

export function RequeueButton({ candidateId }: { candidateId: string }) {
  const actorRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={requeueCandidate}
      onSubmit={(e) => {
        const actor = window.prompt(
          "Re-queue this failed candidate? The dispatcher will start a fresh touch run — every gate (guardrail, review) applies again.\n\nYour name (audit-logged):",
        );
        if (!actor || actor.trim().length === 0) {
          e.preventDefault();
          return;
        }
        actorRef.current!.value = actor.trim();
      }}
      title="Puts the candidate back in the dispatch queue; only works while its status is 'failed'."
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="actor" ref={actorRef} />
      <SubmitButton />
    </form>
  );
}
