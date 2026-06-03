/**
 * Try to configure Infobip HTTP forward for inbound SMS on the purchased number.
 * Portal setup is still the reliable path — this script attempts the Resources API.
 *
 *   npx tsx scripts/infobip-setup-inbound-forward.ts
 *   npx tsx scripts/infobip-setup-inbound-forward.ts --dry-run
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

function infobipBaseUrl(): string | null {
  const raw = process.env.INFOBIP_BASE_URL?.trim();
  if (!raw) return null;
  const trimmed = raw.replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resolveWebhookUrl(): string {
  const explicit = process.env.INFOBIP_INBOUND_WEBHOOK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("Set NEXT_PUBLIC_APP_URL or INFOBIP_INBOUND_WEBHOOK_URL");
  }
  return `${base}/api/webhooks/infobip/sms`;
}

async function infobipFetch(path: string, init?: RequestInit) {
  const baseUrl = infobipBaseUrl();
  const apiKey = process.env.INFOBIP_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new Error("INFOBIP_BASE_URL and INFOBIP_API_KEY required");
  }
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* keep text */
  }
  return { res, json, text };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const numberId = process.env.INFOBIP_SMS_NUMBER_ID?.trim();
  const forwardUrl = resolveWebhookUrl();

  console.log("Target webhook:", forwardUrl);
  if (!numberId) {
    console.error(
      "Set INFOBIP_SMS_NUMBER_ID in .env.local (portal number id, e.g. 5A8FA1DE61F37DF29AA8D4A8795C20A3).",
    );
    console.error("Then run: npx tsx scripts/infobip-setup-inbound-forward.ts");
    process.exit(1);
  }

  const payloads = [
    {
      label: "resources inbound (HTTP_FORWARD)",
      path: `/resources/1/inbound-message-configurations`,
      body: {
        resourceId: numberId,
        channel: "SMS",
        forwarding: {
          type: "HTTP_FORWARD",
          url: forwardUrl,
          httpMethod: "POST",
          contentType: "application/json",
          rendererType: "MO_JSON_2",
        },
      },
    },
    {
      label: "number configuration inbound",
      path: `/numbers/1/numbers/${numberId}/sms/1/inbound`,
      body: {
        forwardingAction: "HTTP_FORWARD",
        url: forwardUrl,
        httpMethod: "POST",
        contentType: "application/json",
        rendererType: "MO_JSON_2",
      },
    },
  ];

  if (dryRun) {
    console.log("\nDry run — would try:");
    for (const p of payloads) {
      console.log(`  POST ${p.path}`, JSON.stringify(p.body, null, 2));
    }
    return;
  }

  for (const p of payloads) {
    console.log(`\nTrying ${p.label} …`);
    const { res, json, text } = await infobipFetch(p.path, {
      method: "POST",
      body: JSON.stringify(p.body),
    });
    console.log("Status:", res.status);
    if (res.ok) {
      console.log("Success:", json);
      console.log(
        "\nSend a test SMS to your Infobip number, then check Vercel logs for [infobip sms webhook].",
      );
      return;
    }
    console.log("Response:", typeof json === "object" ? json : text);
  }

  console.error(
    "\nAPI auto-setup did not succeed. Configure manually in Infobip portal (see infobip-inbound-check.ts output).",
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
