import { KillSwitchToggle } from "@/components/kill-switch-toggle";
import { getKillSwitchState } from "@/lib/kill-switch";

/** R6 — global stop for all public actions, honored by guardrail, dispatcher, and operate tools. */
export async function KillSwitch() {
  const state = await getKillSwitchState();
  return (
    <KillSwitchToggle on={state.on} envForced={state.envForced} updatedBy={state.updatedBy} />
  );
}
