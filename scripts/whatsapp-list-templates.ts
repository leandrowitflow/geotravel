/**
 * List WhatsApp message templates on your WABA (name + language API codes).
 * Use output to set WHATSAPP_BOOKING_CONFIRM_TEMPLATE_NAME / _LANGUAGE.
 *
 * Run: npm run whatsapp:list-templates
 * Optional: WHATSAPP_TEMPLATE_FILTER=welcome npm run whatsapp:list-templates
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type TemplateRow = {
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  id?: string;
};

async function main() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  const verRaw =
    process.env.WHATSAPP_GRAPH_API_VERSION?.trim().replace(/^v?/, "v") ||
    "v25.0";
  const filter = process.env.WHATSAPP_TEMPLATE_FILTER?.trim().toLowerCase();

  if (!token || !wabaId) {
    console.error(
      "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID in .env.local",
    );
    process.exit(1);
  }

  const fields = "name,language,status,category,id";
  let url: string | null =
    `https://graph.facebook.com/${verRaw}/${wabaId}/message_templates?limit=100&fields=${fields}`;
  const rows: TemplateRow[] = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      data?: TemplateRow[];
      paging?: { next?: string };
      error?: { message: string; code?: number };
    };
    if (!res.ok) {
      console.error("HTTP", res.status, JSON.stringify(json, null, 2));
      process.exit(1);
    }
    rows.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }

  const filtered = filter
    ? rows.filter((r) => r.name?.toLowerCase().includes(filter))
    : rows;

  if (filtered.length === 0) {
    console.log(
      filter
        ? `No templates matching filter "${filter}" (${rows.length} total on WABA).`
        : "No templates returned.",
    );
    if (filter) {
      console.log(
        "\nNote: “Qualidade pendente” in WhatsApp Manager does not block sends — if booking_confirmation works,",
      );
      console.log(
        "the API simply does not have this template name on this WABA yet (different account, spelling, or not propagated).",
      );
    }
    process.exit(0);
  }

  console.log(
    `Templates on WABA ${wabaId}${filter ? ` (filter: ${filter})` : ""}:\n`,
  );
  console.log("name\tlanguage\tstatus\tcategory");
  for (const r of filtered.sort((a, b) =>
    `${a.name ?? ""}:${a.language ?? ""}`.localeCompare(
      `${b.name ?? ""}:${b.language ?? ""}`,
    ),
  )) {
    console.log(
      [r.name, r.language, r.status, r.category].map((c) => c ?? "—").join("\t"),
    );
  }

  const lifecycle = [
    "welcome_1",
    "welcome_2",
    "data",
    "canceled",
    "satisfaction",
  ] as const;
  const approvedByName = new Map<string, string>();
  for (const r of rows) {
    if (r.status === "APPROVED" && r.name && r.language) {
      approvedByName.set(r.name, r.language);
    }
  }
  const missing = lifecycle.filter((n) => !approvedByName.has(n));
  const present = lifecycle.filter((n) => approvedByName.has(n));
  if (present.length > 0) {
    console.log("\nLifecycle templates on this WABA (app sends phase → same Meta name):");
    for (const n of present) {
      console.log(`  ${n} → language ${approvedByName.get(n)}`);
    }
  }
  if (missing.length > 0) {
    console.log(
      "\nLifecycle templates NOT returned by API for this WABA (sends will 132001 until listed here):",
      missing.join(", "),
    );
    console.log(
      "  If they show as active in WhatsApp Manager, confirm WHATSAPP_BUSINESS_ACCOUNT_ID matches that account.",
    );
    console.log(
      "  Temporary workaround: WHATSAPP_LIFECYCLE_FALLBACK_TEMPLATE=booking_confirmation in .env.local",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
