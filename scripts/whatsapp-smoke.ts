/**
 * Send a single WhatsApp Cloud API template (default: hello_world).
 * Mirrors Meta's curl example — read-only smoke for outbound config.
 *
 * Run: npm run whatsapp:smoke
 *
 * Requires in .env.local:
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_TEST_TO_E164  (digits only, no +)
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const to = process.env.WHATSAPP_TEST_TO_E164?.trim().replace(/^\+/, "");
  const verRaw =
    process.env.WHATSAPP_GRAPH_API_VERSION?.trim().replace(/^v?/, "v") ||
    "v25.0";
  const lang =
    process.env.WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE?.trim() || "en_US";
  const template =
    process.env.WHATSAPP_SMOKE_TEMPLATE?.trim() || "hello_world";

  if (!token || !phoneId || !to) {
    console.error(
      "Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_TEST_TO_E164 in .env.local",
    );
    process.exit(1);
  }

  const url = `https://graph.facebook.com/${verRaw}/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: template, language: { code: lang } },
  };

  console.log("POST", url);
  console.log("to:", to, "template:", template, "lang:", lang);
  console.log();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log("HTTP", res.status, res.statusText);
  console.log(text);

  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
