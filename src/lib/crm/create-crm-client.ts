import type { CrmClient } from "./port";
import { createStubCrm } from "./stub-crm";
import { createTg4TravelCrm } from "./tg4travel/client";

/**
 * CRM_MODE=stub | tg4travel
 * Default stub for local/dev; set tg4travel with TG4TRAVEL_* vars for Partners API.
 */
export function createCrmClient(): CrmClient {
  const mode = process.env.CRM_MODE?.trim().toLowerCase() ?? "stub";
  if (mode === "tg4travel") {
    return createTg4TravelCrm();
  }
  return createStubCrm();
}
