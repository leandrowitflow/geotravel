/**
 * Verify Infobip inbound webhook + optional local AI pipeline smoke.
 *
 *   npx tsx scripts/infobip-inbound-check.ts
 *   npx tsx scripts/infobip-inbound-check.ts --probe-only
 *   npx tsx scripts/infobip-inbound-check.ts --webhook https://geotravel-eta.vercel.app/api/webhooks/infobip/sms
 */
import { config } from "dotenv";
import {
  isPublicHttpsWebhookUrl,
  resolveInfobipInboundWebhookUrl,
} from "../src/lib/messaging/infobip-inbound-webhook-url";

config({ path: ".env.local" });
config();

function resolveWebhookUrl(): string {
  const argIdx = process.argv.indexOf("--webhook");
  if (argIdx >= 0 && process.argv[argIdx + 1]) {
    const url = process.argv[argIdx + 1]!.trim().replace(/\/$/, "");
    if (!isPublicHttpsWebhookUrl(url)) {
      throw new Error(
        `Not a valid Infobip webhook URL (must be public https): ${url}`,
      );
    }
    return url;
  }
  return resolveInfobipInboundWebhookUrl();
}

async function probeWebhook(url: string) {
  console.log("\n=== Webhook GET ===");
  const getRes = await fetch(url);
  const getJson = await getRes.json().catch(() => ({}));
  console.log("Status:", getRes.status, getJson);

  console.log("\n=== Webhook POST (MO_JSON_2 sample) ===");
  const mo = {
    results: [
      {
        from: "966915976",
        to: process.env.INFOBIP_SMS_SENDER?.replace(/\D/g, "") ?? "351923250271",
        cleanText: "ping inbound check",
        messageId: `probe-${Date.now()}`,
      },
    ],
    messageCount: 1,
    pendingMessageCount: 0,
  };
  const postRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mo),
  });
  const postJson = await postRes.json().catch(() => ({}));
  console.log("Status:", postRes.status, postJson);
  if (postRes.ok && (postJson as { processed?: number }).processed === 0) {
    console.warn(
      "Webhook accepted POST but processed=0 — check Vercel logs for pipeline errors (unknown_contact, missing OPENAI_API_KEY, etc.).",
    );
  }
}

async function localPipelineSmoke() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.log("\n=== Local pipeline ===");
    console.log("Skipped — SUPABASE_SERVICE_ROLE_KEY not set.");
    return;
  }
  console.log("\n=== Local pipeline (simulate-sms-inbound) ===");
  const { smsTestToE164 } = await import("../src/lib/messaging/sms-test-destination");
  const { processInboundMessaging } = await import(
    "../src/lib/orchestration/process-inbound-message"
  );
  const from = smsTestToE164();
  const result = await processInboundMessaging({
    channel: "sms",
    fromE164: from,
    body: "Quantas malas temos?",
    providerMessageId: `local-check-${Date.now()}`,
  });
  console.log("from:", from, "result:", result);
  if (!result.ok) {
    console.error(
      "Pipeline failed. Send SMS · welcome_1 from /admin/bookings for the pilot phone first.",
    );
    process.exit(1);
  }
  console.log("OK — check pilot phone for AI SMS reply.");
}

function printInfobipPortalSteps(webhookUrl: string) {
  const sender =
    process.env.INFOBIP_SMS_SENDER?.trim() ||
    process.env.INFOBIP_SMS_NUMBER?.trim() ||
    "351923250271";
  console.log("\n=== Infobip portal (required for real handset MO) ===");
  console.log(
    "Numbers default is Follow subscription — without MO routing, replies stay in Infobip logs only.",
  );
  console.log("\nOption A (recommended):");
  console.log(`  Channels and Numbers → +${sender.replace(/\D/g, "")} → SMS`);
  console.log("  Default keyword → Forward to HTTP");
  console.log(`  POST ${webhookUrl}`);
  console.log("  Format: MO_JSON_2");
  console.log("\nOption B:");
  console.log("  Developer Tools → Subscriptions Management → SMS");
  console.log("  Event: Inbound message (INBOUND_MESSAGE), format MO_JSON_2");
  console.log(`  Notification profile webhook: ${webhookUrl}`);
  console.log("  Number SMS default: Follow subscription (must match subscription)");
}

async function main() {
  const probeOnly = process.argv.includes("--probe-only");
  const webhookUrl = resolveWebhookUrl();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl?.includes("localhost")) {
    console.warn(
      "Note: NEXT_PUBLIC_APP_URL is localhost — Infobip cannot use that. Using production webhook URL below.",
    );
  }
  console.log("Inbound webhook (paste this in Infobip):", webhookUrl);

  await probeWebhook(webhookUrl);
  printInfobipPortalSteps(webhookUrl);

  if (!probeOnly) {
    await localPipelineSmoke();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
