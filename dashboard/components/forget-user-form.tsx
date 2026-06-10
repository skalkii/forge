"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { forgetUserAction } from "@/app/(app)/settings/data/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-rose-600/40 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-400"
    >
      {pending ? "deleting…" : "Forget user"}
    </button>
  );
}

export function ForgetUserForm() {
  const actorRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={forgetUserAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        const username = usernameRef.current?.value.trim();
        if (!username) {
          e.preventDefault();
          return;
        }
        const actor = window.prompt(
          `Permanently delete ALL data for GitHub user "${username}"?\n\nSignals cascade through candidates, touches, and outcomes — this cannot be undone and is audit-logged.\n\nYour name:`,
        );
        if (!actor || actor.trim().length === 0) {
          e.preventDefault();
          return;
        }
        actorRef.current!.value = actor.trim();
      }}
    >
      <input
        ref={usernameRef}
        type="text"
        name="username"
        required
        placeholder="github-username"
        className="w-48 rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      <input type="hidden" name="actor" ref={actorRef} />
      <SubmitButton />
    </form>
  );
}
