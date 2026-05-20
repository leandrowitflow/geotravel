/** Inngest lifecycle automation is limited to this passenger phone (national digits). */
export const LIFECYCLE_INNGEST_PILOT_PHONE_DIGITS = "966915976";

export function bookingMatchesLifecycleInngestPilot(
  passengerPhone: string | null | undefined,
): boolean {
  const d = (passengerPhone ?? "").replace(/\D/g, "");
  return d.includes(LIFECYCLE_INNGEST_PILOT_PHONE_DIGITS);
}

export function lifecycleWhatsappAutomationEnabled(): boolean {
  const v = process.env.GEOTRAVEL_WHATSAPP_LIFECYCLE_AUTOMATION?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
