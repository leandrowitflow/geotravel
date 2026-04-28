import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const key = process.env.GEOTRAVEL_API_KEY?.trim();
  if (!key) {
    console.error("No GEOTRAVEL_API_KEY");
    process.exit(1);
  }
  const url =
    "https://wntjsuwvglchzlmrujdq.supabase.co/functions/v1/bookings-api?limit=200&offset=0";
  const res = await fetch(url, {
    headers: { "x-api-key": key, Accept: "application/json" },
    cache: "no-store",
  });
  const j = (await res.json()) as { data?: Record<string, unknown>[] };
  const rows = j.data ?? [];
  let withKey = 0;
  let withValue = 0;
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(row, "status")) withKey++;
    const s = row.status;
    if (s !== null && s !== undefined && String(s).trim() !== "") withValue++;
  }
  console.log(
    JSON.stringify(
      {
        httpOk: res.ok,
        rows: rows.length,
        rowsWithStatusProperty: withKey,
        rowsWithNonEmptyStatus: withValue,
        conclusion:
          withKey === 0
            ? "O campo status NAO vem na resposta (propriedade ausente)."
            : withValue === 0
              ? "A propriedade status existe mas esta sempre vazia/null nesta amostra."
              : "A propriedade status existe e tem valores em parte das linhas.",
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
