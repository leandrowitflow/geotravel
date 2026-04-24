import type { CrmConfirmationWrite, CrmEnrichmentWrite } from "@/lib/contracts/crm-writeback";

export type CrmWriteResult =
  | { ok: true }
  | { ok: false; error: string };

export interface CrmClient {
  writeEnrichment(payload: CrmEnrichmentWrite): Promise<CrmWriteResult>;
  writeConfirmation(payload: CrmConfirmationWrite): Promise<CrmWriteResult>;
}
