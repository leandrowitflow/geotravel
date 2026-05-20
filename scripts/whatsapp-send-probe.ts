/**
 * Try hello_world to one or more E.164 destinations; prints Meta error per number.
 * Run: npm run whatsapp:send-probe
 * Or: WHATSAPP_PROBE_TO=351966915976,351930478387 npm run whatsapp:send-probe
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function sendTo(toDigits: string, token: string, phoneId: string, ver: string) {
  const url = `https://graph.facebook.com/${ver}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits.replace(/\D/g, ""),
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    }),
  });
  const json = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message: string; code?: number; error_subcode?: number };
  };
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const ver =
    process.env.WHATSAPP_GRAPH_API_VERSION?.trim().replace(/^v?/, "v") ||
    "v25.0";
  const list =
    process.env.WHATSAPP_PROBE_TO?.trim() ||
    "351966915976,351930478387";

  if (!token || !phoneId) {
    console.error("Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID");
    process.exit(1);
  }

  const dbg = await fetch(
    `https://graph.facebook.com/${ver}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
  );
  const dbgJson = (await dbg.json()) as {
    data?: {
      is_valid?: boolean;
      expires_at?: number;
      granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
    };
  };
  const msgScope = dbgJson.data?.granular_scopes?.find(
    (g) => g.scope === "whatsapp_business_messaging",
  );
  console.log("Token valid:", dbgJson.data?.is_valid);
  console.log(
    "Messaging phones:",
    msgScope?.target_ids?.length
      ? msgScope.target_ids.join(", ")
      : "(none — 131005 on any send)",
  );
  console.log("From phone_id:", phoneId);
  console.log();

  for (const raw of list.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    const digits = raw.replace(/\D/g, "");
    console.log(`--- To ${digits} (+${digits}) hello_world en_US ---`);
    const r = await sendTo(digits, token, phoneId, ver);
    if (r.ok) {
      console.log("OK", r.json.messages?.[0]?.id ?? r.json);
    } else {
      const e = r.json.error;
      console.log("FAIL", e?.message ?? r.json);
      if (e?.code != null) console.log("code:", e.code, "subcode:", e.error_subcode);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
