/**
 * sync-ghl-notion.ts
 * Reads opportunities from GoHighLevel and updates matching Notion records
 * with the current pipeline stage → Status and monetary value.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json sync-ghl-notion.ts
 *   npx ts-node --project tsconfig.scripts.json sync-ghl-notion.ts --dry-run
 *
 * Or via npm scripts:
 *   npm run sync:to-notion
 *   npm run sync:to-notion:dry
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import { fetchPipelines, fetchAllOpportunities } from "./lib/ghl";

// ─── Config ───────────────────────────────────────────────────────────────────

const NOTION_DATABASE_ID = "1ec71504-23f2-81ba-96cd-000b65b9c845";
const PIPELINE_NAME_FRAGMENT = "home services"; // case-insensitive match

const GHL_API_KEY = process.env.GHL_API_KEY!;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID!;
const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Reverse status mapping ───────────────────────────────────────────────────

/**
 * GHL pipeline stage name → Notion Status value.
 * When a stage name matches multiple Notion statuses, the most specific one wins.
 */
const STAGE_TO_NOTION_STATUS: Record<string, string> = {
  "New Lead": "Upcoming",
  Contacted: "Follow Up Booked",
  Engaged: "Long Term Follow Up",
  Qualified: "Follow Up Booked",
  Booked: "Follow Up Booked",
  "No Show": "No Show",
  "In Progress": "Follow Up Booked",
  "Job Complete": "Sale",
  Lost: "Failed Close",
};

// Valid Notion Status values (from database schema)
const VALID_NOTION_STATUSES = new Set([
  "Upcoming",
  "Follow Up Booked",
  "Need to Reschedule",
  "No Show",
  "Cancelled",
  "Long Term Follow Up",
  "Sale",
  "Failed Close",
]);

// ─── Notion helpers ───────────────────────────────────────────────────────────

interface NotionRecord {
  pageId: string;
  name: string;
  email: string | null;
  status: string | null;
  contractValue: number | null;
}

function richText(prop: any): string | null {
  const arr: any[] = prop?.rich_text ?? prop?.title ?? [];
  return arr[0]?.plain_text ?? null;
}

function parseNotionPage(page: PageObjectResponse): NotionRecord {
  const p = page.properties as Record<string, any>;
  return {
    pageId: page.id,
    name: richText(p["Name"]) ?? "Unknown",
    email: p["Email"]?.email ?? null,
    status: p["Status"]?.status?.name ?? null,
    contractValue: p["Contract Value"]?.number ?? null,
  };
}

async function fetchAllNotionRecords(notion: Client): Promise<NotionRecord[]> {
  const records: NotionRecord[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      ...(cursor ? { start_cursor: cursor } : {}),
      page_size: 100,
    });

    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        records.push(parseNotionPage(page as PageObjectResponse));
      }
    }

    cursor = res.next_cursor ?? undefined;
  } while (cursor);

  return records;
}

async function updateNotionRecord(
  notion: Client,
  pageId: string,
  notionStatus: string,
  monetaryValue: number | null
) {
  const properties: Record<string, any> = {
    Status: { status: { name: notionStatus } },
  };
  if (monetaryValue != null) {
    properties["Contract Value"] = { number: monetaryValue };
  }

  await notion.pages.update({ page_id: pageId, properties });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  const missing = (
    ["GHL_API_KEY", "GHL_LOCATION_ID", "NOTION_API_KEY"] as const
  ).filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌  Missing env vars: ${missing.join(", ")}`);
    console.error("    Add them to .env.local and try again.");
    process.exit(1);
  }

  console.log("━".repeat(56));
  console.log("  GoHighLevel → Notion Reverse Sync");
  if (DRY_RUN) console.log("  🔍  DRY RUN — no changes will be written to Notion");
  console.log("━".repeat(56) + "\n");

  const notion = new Client({ auth: NOTION_API_KEY });

  // ── 1. Fetch GHL pipeline + stage map ──────────────────────────────────────
  console.log("📊  Fetching GHL pipelines…");
  const { pipelines } = await fetchPipelines(GHL_LOCATION_ID, GHL_API_KEY);
  const pipeline = pipelines.find((p) =>
    p.name.toLowerCase().includes(PIPELINE_NAME_FRAGMENT)
  );
  if (!pipeline) {
    const names = pipelines.map((p) => `"${p.name}"`).join(", ");
    console.error(
      `❌  No pipeline matching "${PIPELINE_NAME_FRAGMENT}" found.\n` +
        `    Available pipelines: ${names || "(none)"}`
    );
    process.exit(1);
  }
  console.log(`    Using pipeline: "${pipeline.name}" (${pipeline.id})`);

  // Build stageId → stage name map
  const stageIdToName = new Map<string, string>(
    pipeline.stages.map((s) => [s.id, s.name])
  );
  console.log(
    `    Stages: ${pipeline.stages
      .sort((a, b) => a.position - b.position)
      .map((s) => s.name)
      .join(" → ")}\n`
  );

  // ── 2. Fetch all GHL opportunities ─────────────────────────────────────────
  console.log("🔄  Fetching all GHL opportunities (paginated)…");
  const opportunities = await fetchAllOpportunities(
    GHL_LOCATION_ID,
    GHL_API_KEY,
    pipeline.id
  );
  console.log(`    ${opportunities.length} opportunities fetched\n`);

  // ── 3. Fetch all Notion records ─────────────────────────────────────────────
  console.log("📋  Fetching Notion database…");
  const notionRecords = await fetchAllNotionRecords(notion);
  console.log(`    ${notionRecords.length} records found\n`);

  // Build lookup maps: email → record, name (lowercase) → record
  const byEmail = new Map<string, NotionRecord>();
  const byName = new Map<string, NotionRecord>();
  for (const r of notionRecords) {
    if (r.email) byEmail.set(r.email.toLowerCase(), r);
    byName.set(r.name.toLowerCase(), r);
  }

  // ── 4. Match each GHL opportunity to a Notion record and update ─────────────
  let matched = 0,
    unmatched = 0,
    skipped = 0,
    errors = 0;

  for (const opp of opportunities) {
    const stageName = stageIdToName.get(opp.pipelineStageId) ?? "";
    const notionStatus = STAGE_TO_NOTION_STATUS[stageName];

    if (!notionStatus || !VALID_NOTION_STATUSES.has(notionStatus)) {
      console.log(
        `⚠   "${opp.name}" — GHL stage "${stageName}" has no Notion status mapping, skipped`
      );
      skipped++;
      continue;
    }

    // Try to match by contact email first, then by opportunity/contact name
    const contactEmail = opp.contact?.email?.toLowerCase();
    const contactName = opp.contact?.name?.toLowerCase() ?? opp.name.toLowerCase();

    const notionRecord =
      (contactEmail ? byEmail.get(contactEmail) : undefined) ??
      byName.get(contactName);

    if (!notionRecord) {
      console.log(
        `🔍  "${opp.name}" — no matching Notion record` +
          ` (email: ${opp.contact?.email ?? "—"}, name: ${opp.contact?.name ?? opp.name})`
      );
      unmatched++;
      continue;
    }

    const monetaryValue = opp.monetaryValue ?? null;
    const statusChanged = notionRecord.status !== notionStatus;
    const valueChanged =
      monetaryValue != null && notionRecord.contractValue !== monetaryValue;

    if (!statusChanged && !valueChanged) {
      console.log(
        `⏭   "${notionRecord.name}" — already up to date` +
          ` (${notionStatus}${monetaryValue != null ? `, $${monetaryValue.toLocaleString()}` : ""})`
      );
      skipped++;
      continue;
    }

    const changes: string[] = [];
    if (statusChanged)
      changes.push(`Status: "${notionRecord.status ?? "—"}" → "${notionStatus}"`);
    if (valueChanged)
      changes.push(
        `Contract Value: $${notionRecord.contractValue?.toLocaleString() ?? "—"} → $${monetaryValue!.toLocaleString()}`
      );

    try {
      if (!DRY_RUN) {
        await updateNotionRecord(
          notion,
          notionRecord.pageId,
          notionStatus,
          valueChanged ? monetaryValue : null
        );
      }
      console.log(`✅  "${notionRecord.name}" — ${changes.join(", ")}`);
      matched++;
    } catch (err) {
      console.error(
        `❌  "${notionRecord.name}" — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      errors++;
    }
  }

  console.log("\n" + "━".repeat(56));
  console.log(
    `  ✅ Updated   : ${matched}\n` +
      `  ⏭  Skipped   : ${skipped}\n` +
      `  🔍 Unmatched : ${unmatched}\n` +
      `  ❌ Errors    : ${errors}`
  );
  if (DRY_RUN) console.log("\n  (Dry run — nothing was written to Notion)");
  console.log("━".repeat(56));
}

main().catch((e) => {
  console.error("\n❌  Fatal error:", e);
  process.exit(1);
});
