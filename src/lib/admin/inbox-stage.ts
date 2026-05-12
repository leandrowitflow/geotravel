import type { OrchestrationState } from "@/lib/orchestration/state-machine";
import { ORCHESTRATION_STATES } from "@/lib/orchestration/state-machine";

export type InboxStageTone = "neutral" | "ok" | "warn" | "bad";

/** Human-readable funnel stage for the case inbox (maps DB orchestration_state). */
export function inboxStageFromOrchestration(state: string): {
  label: string;
  tone: InboxStageTone;
} {
  if (!isOrchestrationState(state)) {
    return { label: state.trim() || "—", tone: "neutral" };
  }
  switch (state) {
    case "awaiting_outreach":
      return { label: "Not sent", tone: "neutral" };
    case "identity_confirm":
      return { label: "First", tone: "neutral" };
    case "collect_missing":
    case "summarize_confirm":
      return { label: "Second", tone: "neutral" };
    case "crm_write_enrichment":
    case "awaiting_d1":
    case "d1_confirm":
      return { label: "Third", tone: "neutral" };
    case "closed":
    case "cancelled":
    case "commercial_eligible":
    case "consent_future_comms":
      return { label: "End", tone: "ok" };
    case "needs_human":
      return { label: "Needs human", tone: "warn" };
    default: {
      const _never: never = state;
      return { label: String(_never), tone: "neutral" };
    }
  }
}

function isOrchestrationState(s: string): s is OrchestrationState {
  return (ORCHESTRATION_STATES as readonly string[]).includes(s);
}
