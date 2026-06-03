/**
 * Fetch Infobip delivery report for a messageId.
 * Run: npx tsx scripts/infobip-sms-report.ts <messageId>
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

function baseUrl(): string {
  const raw = process.env.INFOBIP_BASE_URL?.trim();
  if (!raw) throw new Error("INFOBIP_BASE_URL missing");
  const trimmed = raw.replace(/\/$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function main() {
  const messageId = process.argv[2]?.trim();
  if (!messageId) {
    console.error("Usage: npx tsx scripts/infobip-sms-report.ts <messageId>");
    process.exit(1);
  }
  const key = process.env.INFOBIP_API_KEY?.trim();
  if (!key) {
    console.error("INFOBIP_API_KEY missing");
    process.exit(1);
  }
  const url = `${baseUrl()}/sms/3/reports?messageId=${encodeURIComponent(messageId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `App ${key}`, Accept: "application/json" },
  });
  const text = await res.text();
  console.log("HTTP", res.status);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
