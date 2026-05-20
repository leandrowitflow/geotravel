/**
 * Diagnose 131005 / token vs phone / WABA alignment.
 * Run: npm run whatsapp:debug-access
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const ver =
    process.env.WHATSAPP_GRAPH_API_VERSION?.trim().replace(/^v?/, "v") ||
    "v25.0";

  if (!token) {
    console.error("Set WHATSAPP_ACCESS_TOKEN in .env.local");
    process.exit(1);
  }

  console.log("=== Token (debug_token) ===\n");
  const appToken = appSecret
    ? await getJson(
        `https://graph.facebook.com/${ver}/oauth/access_token?client_id=${process.env.META_APP_ID ?? process.env.FACEBOOK_APP_ID ?? ""}&client_secret=${appSecret}&grant_type=client_credentials`,
        token,
      )
    : null;

  const dbg = await getJson(
    `https://graph.facebook.com/${ver}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
    token,
  );
  const data = dbg.json.data as Record<string, unknown> | undefined;
  if (data) {
    console.log("valid:", data.is_valid);
    console.log("expires_at:", data.expires_at, data.expires_at === 0 ? "(never)" : "");
    console.log("scopes:", (data.scopes as string[] | undefined)?.join(", ") ?? "—");
    const granular = data.granular_scopes as
      | Array<{ scope?: string; target_ids?: string[] }>
      | undefined;
    if (granular?.length) {
      console.log("granular_scopes:");
      for (const g of granular) {
        const ids = g.target_ids ?? [];
        console.log(
          `  ${g.scope}: ${ids.length ? ids.slice(0, 8).join(", ") : "(none — causes 131005 on send)"}${ids.length > 8 ? "…" : ""}`,
        );
      }
      const msgScope = granular.find(
        (g) => g.scope === "whatsapp_business_messaging",
      );
      if (msgScope && !(msgScope.target_ids?.length ?? 0)) {
        console.log(
          "\n⚠ whatsapp_business_messaging has ZERO assigned phone numbers.",
        );
        console.log(
          "  Fix: Business settings → Users → System users → [your user] → Assign assets →",
        );
        console.log(
          "  select the WhatsApp account AND tick the phone number for messaging (not management only).",
        );
      }
    }
  } else {
    console.log(JSON.stringify(dbg.json, null, 2));
  }

  const need = ["whatsapp_business_messaging", "whatsapp_business_management"];
  const scopes = (data?.scopes as string[] | undefined) ?? [];
  for (const s of need) {
    if (!scopes.includes(s)) {
      console.log(`\n⚠ Missing scope: ${s}`);
    }
  }

  console.log("\n=== Configured phone ===\n");
  if (!phoneId) {
    console.log("WHATSAPP_PHONE_NUMBER_ID not set");
  } else {
    const phone = await getJson(
      `https://graph.facebook.com/${ver}/${phoneId}?fields=display_phone_number,verified_name,quality_rating`,
      token,
    );
    if (phone.ok) {
      console.log("id:", phoneId);
      console.log("display:", phone.json.display_phone_number);
      console.log("verified_name:", phone.json.verified_name);
    } else {
      console.log("Cannot read phone", phoneId, "→", JSON.stringify(phone.json));
    }
  }

  console.log("\n=== WABA phone numbers (env WHATSAPP_BUSINESS_ACCOUNT_ID) ===\n");
  if (!wabaId) {
    console.log("WHATSAPP_BUSINESS_ACCOUNT_ID not set");
  } else {
    const phones = await getJson(
      `https://graph.facebook.com/${ver}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      token,
    );
    const list = (phones.json.data as Array<Record<string, string>>) ?? [];
    if (list.length === 0) {
      console.log(`WABA ${wabaId}: no phones (or no permission)`);
      if (phones.json.error) console.log(phones.json.error);
    } else {
      for (const p of list) {
        const mark = p.id === phoneId ? " ← WHATSAPP_PHONE_NUMBER_ID" : "";
        console.log(`${p.id}  ${p.display_phone_number ?? "—"}  ${p.verified_name ?? ""}${mark}`);
      }
    }
  }

  const madeinweb = "1276746624004701";
  if (wabaId !== madeinweb) {
    console.log(`\n=== Madeinweb WABA ${madeinweb} (lifecycle templates) ===\n`);
    const phones = await getJson(
      `https://graph.facebook.com/${ver}/${madeinweb}/phone_numbers?fields=id,display_phone_number,verified_name`,
      token,
    );
    const list = (phones.json.data as Array<Record<string, string>>) ?? [];
    if (list.length === 0) {
      console.log("no phones listed — add a number in WhatsApp Manager under Madeinweb");
    } else {
      for (const p of list) {
        console.log(`${p.id}  ${p.display_phone_number ?? "—"}  ${p.verified_name ?? ""}`);
      }
      console.log(
        "\nRecommended .env.local for production templates:",
        "\n  WHATSAPP_BUSINESS_ACCOUNT_ID=1276746624004701",
        "\n  WHATSAPP_PHONE_NUMBER_ID=<one of the ids above>",
      );
    }
  }

  console.log("\n=== Send probe (no message; checks POST permission) ===\n");
  if (phoneId && process.env.WHATSAPP_TEST_TO_E164) {
    const to = process.env.WHATSAPP_TEST_TO_E164.replace(/\D/g, "");
    const probe = await getJson(
      `https://graph.facebook.com/${ver}/${phoneId}/messages`,
      token,
    );
    // POST only — use fetch POST with invalid body to see error type
    const res = await fetch(
      `https://graph.facebook.com/${ver}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: { name: "hello_world", language: { code: "en_US" } },
        }),
      },
    );
    const body = await res.json();
    if (res.ok) {
      console.log("Test template send OK (hello_world) — token can send on this phone.");
    } else {
      const err = body as { error?: { message?: string; code?: number } };
      console.log("Send failed:", err.error?.message ?? body);
      console.log("code:", err.error?.code);
      if (err.error?.code === 131005) {
        console.log(
          "\n131005: Token is not allowed to send from this phone. Regenerate a System User token",
        );
        console.log(
          "and assign it to this WABA + phone in Business Settings → Users → System users → Assign assets.",
        );
      }
    }
  } else {
    console.log("Set WHATSAPP_TEST_TO_E164 to run a hello_world send probe.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
