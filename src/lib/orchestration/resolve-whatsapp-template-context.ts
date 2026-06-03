import { assertNoError, takeRows } from "@/db/supabase-helpers";
import type { CollectedDataJson } from "@/db/schema";
import {
  buildWhatsappTemplateConversationContext,
  parseStoredOutboundTemplatePhase,
  resolvePhaseFromMetaTemplateName,
  type WhatsappTemplateConversationContext,
  type WhatsappTemplateConversationPhase,
} from "@/lib/geotravel/whatsapp-template-ai-context";
import { isGeotravelWhatsappLifecycleTemplate } from "@/lib/geotravel/select-booking-whatsapp-template";
import type { SupabaseClient } from "@supabase/supabase-js";

function phaseFromCollectedData(
  collected: CollectedDataJson | null | undefined,
): WhatsappTemplateConversationPhase | null {
  const raw = collected?.last_whatsapp_lifecycle_phase?.trim();
  if (!raw) return null;
  const resolved = resolvePhaseFromMetaTemplateName(raw);
  if (resolved !== "unknown") return resolved;
  if (isGeotravelWhatsappLifecycleTemplate(raw)) return raw;
  return null;
}

/**
 * Last lifecycle template context for AI replies — from case collected_data or latest outbound WhatsApp/SMS.
 */
export async function resolveMessagingTemplateContextForCase(
  caseId: string,
  collectedData: CollectedDataJson | null | undefined,
  sb: SupabaseClient,
): Promise<WhatsappTemplateConversationContext | null> {
  const fromCollected = phaseFromCollectedData(collectedData);
  if (fromCollected && fromCollected !== "unknown") {
    return buildWhatsappTemplateConversationContext({
      phase: fromCollected,
      metaTemplateName: collectedData?.last_whatsapp_lifecycle_phase ?? null,
    });
  }

  const rows = takeRows<{ body: string; metadata: Record<string, unknown> | null }>(
    "last outbound messaging for template context",
    await sb
      .from("messages")
      .select("body,metadata")
      .eq("case_id", caseId)
      .eq("direction", "outbound")
      .in("channel", ["whatsapp", "sms"])
      .order("created_at", { ascending: false })
      .limit(5),
  );

  for (const row of rows) {
    const metaPhase = row.metadata?.lifecycle_phase;
    if (typeof metaPhase === "string" && metaPhase.trim()) {
      const phase = resolvePhaseFromMetaTemplateName(metaPhase);
      if (phase !== "unknown") {
        return buildWhatsappTemplateConversationContext({
          phase,
          metaTemplateName:
            typeof row.metadata?.meta_template_name === "string"
              ? row.metadata.meta_template_name
              : metaPhase,
        });
      }
    }
    const parsed = parseStoredOutboundTemplatePhase(row.body);
    if (parsed) {
      return buildWhatsappTemplateConversationContext({
        phase: parsed,
        metaTemplateName: parsed,
      });
    }
  }

  return null;
}

/** @deprecated Use resolveMessagingTemplateContextForCase */
export const resolveWhatsappTemplateContextForCase =
  resolveMessagingTemplateContextForCase;

export function mergeLastWhatsappLifecyclePhase(
  collected: CollectedDataJson | null | undefined,
  phase: string,
): CollectedDataJson {
  const prev = collected?.lifecycle_phases_sent ?? [];
  const phases = [...new Set([...prev, phase])];
  return {
    ...(collected ?? {}),
    last_whatsapp_lifecycle_phase: phase,
    lifecycle_phases_sent: phases,
  };
}
