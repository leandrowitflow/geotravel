/**
 * Show body/button variable placeholders per template on the configured WABA.
 * Run: npm run whatsapp:template-params
 * Optional: WHATSAPP_TEMPLATE_PARAMS_NAME=welcome_1
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Component = {
  type?: string;
  text?: string;
  format?: string;
  buttons?: unknown[];
  example?: { body_text?: string[][] };
};

type TemplateRow = {
  name?: string;
  language?: string;
  status?: string;
  components?: Component[];
};

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  const only = process.env.WHATSAPP_TEMPLATE_PARAMS_NAME?.trim();
  const ver =
    process.env.WHATSAPP_GRAPH_API_VERSION?.trim().replace(/^v?/, "v") ||
    "v25.0";

  if (!token || !wabaId) {
    console.error("Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID");
    process.exit(1);
  }

  const fields = "name,language,status,components";
  let url: string | null =
    `https://graph.facebook.com/${ver}/${wabaId}/message_templates?limit=100&fields=${fields}`;
  const rows: TemplateRow[] = [];

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as {
      data?: TemplateRow[];
      paging?: { next?: string };
      error?: { message: string };
    };
    if (!res.ok) {
      console.error(JSON.stringify(json, null, 2));
      process.exit(1);
    }
    rows.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }

  const filtered = only
    ? rows.filter((r) => r.name === only)
    : rows.filter((r) =>
        [
          "welcome_1",
          "welcome_2",
          "data",
          "canceled",
          "satisfaction",
          "booking_confirmation",
        ].includes(r.name ?? ""),
      );

  for (const t of filtered.sort((a, b) =>
    `${a.name}:${a.language}`.localeCompare(`${b.name}:${b.language}`),
  )) {
    console.log(`\n=== ${t.name} (${t.language}) ${t.status ?? ""} ===`);
    for (const c of t.components ?? []) {
      if (c.type !== "BODY" || !c.text) continue;
      console.log("BODY:", c.text.replace(/\n/g, " "));
      const vars = [...c.text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      const positional = [...c.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
      if (vars.length) console.log("  named vars:", vars.join(", "));
      if (positional.length) console.log("  positional:", positional.join(", "));
      if (!vars.length && !positional.length) console.log("  (no variables)");
      if (c.example?.body_text?.[0]) {
        console.log("  example values:", c.example.body_text[0].join(" | "));
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
