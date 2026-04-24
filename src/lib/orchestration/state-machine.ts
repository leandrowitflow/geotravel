/**
 * Goal-driven state machine — not an open chat.
 * Transitions are explicit; AI only chooses copy within the current step.
 */

export const ORCHESTRATION_STATES = [
  "awaiting_outreach",
  "identity_confirm",
  "collect_missing",
  "summarize_confirm",
  "crm_write_enrichment",
  "awaiting_d1",
  "d1_confirm",
  "consent_future_comms",
  "commercial_eligible",
  "closed",
  "cancelled",
  "needs_human",
] as const;

export type OrchestrationState = (typeof ORCHESTRATION_STATES)[number];

export const TERMINAL_STATES: OrchestrationState[] = [
  "closed",
  "cancelled",
  "needs_human",
];

export function isTerminalState(s: OrchestrationState): boolean {
  return TERMINAL_STATES.includes(s);
}

/** Allowed transitions (from -> to[]) */
export const TRANSITIONS: Record<OrchestrationState, OrchestrationState[]> = {
  awaiting_outreach: ["identity_confirm", "cancelled", "needs_human"],
  identity_confirm: ["collect_missing", "awaiting_d1", "cancelled", "needs_human"],
  collect_missing: ["summarize_confirm", "collect_missing", "needs_human"],
  summarize_confirm: ["crm_write_enrichment", "collect_missing", "needs_human"],
  crm_write_enrichment: ["awaiting_d1", "needs_human"],
  awaiting_d1: ["d1_confirm", "closed"],
  d1_confirm: ["consent_future_comms", "closed"],
  consent_future_comms: ["commercial_eligible", "closed"],
  commercial_eligible: ["closed"],
  closed: [],
  cancelled: [],
  needs_human: ["closed", "collect_missing"],
};

export function canTransition(
  from: OrchestrationState,
  to: OrchestrationState,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: OrchestrationState,
  to: OrchestrationState,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition ${from} -> ${to}`);
  }
}
