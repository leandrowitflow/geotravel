import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/require-staff";
import {
  buildSyntheticTestWelcomeBooking,
  resolveGeotravelTestWelcomeTargetE164,
} from "@/lib/geotravel/admin-test-welcome-booking";
import { executeGeotravelWelcomeSend } from "@/lib/geotravel/execute-geotravel-welcome-send";

/**
 * Staff-only: send the same welcome / template flow as “WhatsApp confirm” to the
 * configured test number (default +351913535544). Set GEOTRAVEL_TEST_WELCOME_E164 to override.
 */
export async function POST() {
  await requireStaff();
  const to = resolveGeotravelTestWelcomeTargetE164();
  if (!to) {
    return NextResponse.json({ error: "invalid_test_phone" }, { status: 400 });
  }
  const booking = buildSyntheticTestWelcomeBooking(to);
  const result = await executeGeotravelWelcomeSend(booking);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    test: true,
    caseId: result.caseId,
    channel: result.channel,
    providerMessageId: result.providerMessageId,
    templateUsed: result.templateUsed,
    templateName: result.templateName,
    templateLanguageSent: result.templateLanguageSent,
    firstNameUsed: result.firstNameUsed,
    whatsappFallbackToSms: result.whatsappFallbackToSms,
    whatsappAttemptError: result.whatsappAttemptError,
    whatsappRecoveryHint: result.whatsappRecoveryHint,
    destinationE164: result.destinationE164,
    smsProviderMeta: result.smsProviderMeta,
  });
}
