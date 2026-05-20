import { assertNoError } from "@/db/supabase-helpers";
import {
  allowsOperationalEnrichmentForPhase,
  type WhatsappTemplateConversationPhase,
} from "@/lib/geotravel/whatsapp-template-ai-context";
import { serviceSupabase } from "@/lib/supabase/service-role";
import {
  assertTransition,
  canTransition,
  type OrchestrationState,
} from "./state-machine";

/**
 * After sending welcome/data templates, move the case into a state where inbound
 * replies trigger field collection (not silent early-exit).
 */
export async function advanceCaseForOperationalTemplateSend(
  caseId: string,
  lifecyclePhase: WhatsappTemplateConversationPhase | undefined,
): Promise<void> {
  if (!lifecyclePhase || !allowsOperationalEnrichmentForPhase(lifecyclePhase)) {
    return;
  }

  const sb = serviceSupabase();
  const res = await sb
    .from("cases")
    .select("orchestration_state, case_status")
    .eq("id", caseId)
    .maybeSingle();
  if (res.error || !res.data) return;

  let state = res.data.orchestration_state as OrchestrationState;

  if (state === "closed" || state === "cancelled") {
    assertNoError(
      "case reopen for operational template",
      await sb
        .from("cases")
        .update({
          case_status: "active",
          orchestration_state: "collect_missing",
          closed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId),
    );
    return;
  }

  if (
    state === "awaiting_outreach" &&
    canTransition(state, "identity_confirm")
  ) {
    assertTransition(state, "identity_confirm");
    assertNoError(
      "case awaiting_outreach -> identity_confirm",
      await sb
        .from("cases")
        .update({
          orchestration_state: "identity_confirm",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId),
    );
    state = "identity_confirm";
  }

  if (
    state === "identity_confirm" &&
    canTransition(state, "collect_missing")
  ) {
    assertTransition(state, "collect_missing");
    assertNoError(
      "case identity_confirm -> collect_missing",
      await sb
        .from("cases")
        .update({
          orchestration_state: "collect_missing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId),
    );
    return;
  }

  if (canTransition(state, "collect_missing")) {
    assertTransition(state, "collect_missing");
    assertNoError(
      "case -> collect_missing for template reply",
      await sb
        .from("cases")
        .update({
          orchestration_state: "collect_missing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId),
    );
  }
}
