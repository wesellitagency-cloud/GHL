/**
 * sync-notion-ghl.ts
 * Reads deals from the Notion SalesCallDatabase2.0 and creates/updates
 * contacts and opportunities in GoHighLevel.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json sync-notion-ghl.ts
 *   npx ts-node --project tsconfig.scripts.json sync-notion-ghl.ts --dry-run
 *
 * Or via npm scripts:
 *   npm run sync:to-ghl
 *   npm run sync:to-ghl:dry
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

import {
  fetchPipelines,
  fetchCustomFields,
  searchContactByEmail,
  createContact,
  updateContact,
  createOpportunity,
  updateOpportunity,
  fetchOpportunitiesByContact,
} from "./lib/ghl";

// ─── Config ───────────────────────────────────────────────────────────────────

const NOTION_DATABASE_ID = "1ec71504-23f2-81ba-96cd-000b65b9c845";
const PIPELINE_NAME_FRAGMENT = "home services"; // case-insensitive match

const GHL_API_KEY = process.env.GHL_API_KEY!;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID!;
const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Status mappings ──────────────────────────────────────────────────────────

/** Notion status → GHL pipeline stage name */
const STATUS_TO_STAGE: Record<string, string> = {
  Upcoming: "New Lead",
  "Follow Up Booked": "Contacted",
  "Need to Reschedule": "Contacted",
  "No Show": "No Show",
  Cancelled: "Lost",
  "Long Term Follow Up": "Engaged",
  Sale: "Job Complete",
  "Failed Close": "Lost",
};

/** Notion status → GHL opportunity status (open / won / lost) */
function toOppStatus(notionStatus: string): "open" | "won" | "lost" {
  if (notionStatus === "Sale") return "won";
  if (notionStatus === "Cancelled" || notionStatus === "Failed Close")
    return "lost";
  return "open";
}

// ─── Notion types & parsing ───────────────────────────────────────────────────

interface NotionDeal {
  pageId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  contractValue: number | null;
  typeOfBusiness: string | null;
  leadSource: string | null;
  ccUpfront: number | null;
  paymentType: string | null;
  contractedRevenue: number | null;
  dateOfCall: string | null;
  dateClosed: string | null;
  biggestMarketingChallenge: string | null;
  goalsForMarketing: string | null;
  currentMonthlyRevenue: string | null;
  targetMonthlyRevenue: string | null;
}

function richText(prop: any): string | null {
  const arr: any[] = prop?.rich_text ?? prop?.title ?? [];
  return arr[0]?.plain_text ?? null;
}

function parseNotionPage(page: PageObjectResponse): NotionDeal {
  const p = page.properties as Record<string, any>;
  return {
    pageId: page.id,
    name: richText(p["Name"]) ?? "Unknown",
    email: p["Email"]?.email ?? null,
    phone: p["Phone"]?.phone_number ?? null,
    status: p["Status"]?.status?.name ?? null,
    contractValue: p["Contract Value"]?.number ?? null,
    typeOfBusiness: richText(p["Type of Business(s)"]),
    leadSource: richText(p["Lead Source"]),
    ccUpfront: p["CC Upfront"]?.number ?? null,
    paymentType: p["Payment Type"]?.select?.name ?? null,
    contractedRevenue: p["Contracted Revenue"]?.number ?? null,
    dateOfCall: p["Date of Call"]?.date?.start ?? null,
    dateClosed: p["Date Closed"]?.date?.start ?? null,
    biggestMarketingChallenge: richText(p["Biggest Marketing Challenge(s)"]),
    goalsForMarketing: richText(p["Goal(s) for Marketing"]),
    currentMonthlyRevenue: richText(p["# Current Monthly Revenue"]),
    targetMonthlyRevenue: richText(p["# Target Monthly Revenue"]),
  };
}

async function fetchAllNotionDeals(notion: Client): Promise<NotionDeal[]> {
  const deals: NotionDeal[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      ...(cursor ? { start_cursor: cursor } : {}),
      page_size: 100,
    });

    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        deals.push(parseNotionPage(page as PageObjectResponse));
      }
    }

    cursor = res.next_cursor ?? undefined;
  } while (cursor);

  return deals;
}

// ─── GHL opportunity notes builder ───────────────────────────────────────────

function buildNotes(deal: NotionDeal): string {
  const lines: string[] = ["[Synced from Notion SalesCallDatabase2.0]"];
  if (deal.ccUpfront != null)
    lines.push(`CC Upfront: $${deal.ccUpfront.toLocaleString()}`);
  if (deal.paymentType) lines.push(`Payment Type: ${deal.paymentType}`);
  if (deal.contractedRevenue != null)
    lines.push(
      `Contracted Revenue: $${deal.contractedRevenue.toLocaleString()}`
    );
  if (deal.dateOfCall) lines.push(`Date of Call: ${deal.dateOfCall}`);
  if (deal.dateClosed) lines.push(`Date Closed: ${deal.dateClosed}`);
  if (deal.biggestMarketingChallenge)
    lines.push(`Biggest Marketing Challenge: ${deal.biggestMarketingChallenge}`);
  if (deal.goalsForMarketing)
    lines.push(`Goals for Marketing: ${deal.goalsForMarketing}`);
  if (deal.currentMonthlyRevenue)
    lines.push(`Current Monthly Revenue: ${deal.currentMonthlyRevenue}`);
  if (deal.targetMonthlyRevenue)
    lines.push(`Target Monthly Revenue: ${deal.targetMonthlyRevenue}`);
  return lines.join("\n");
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
  console.log("  Notion → GoHighLevel Sync");
  if (DRY_RUN) console.log("  🔍  DRY RUN — no changes will be written to GHL");
  console.log("━".repeat(56) + "\n");

  const notion = new Client({ auth: NOTION_API_KEY });

  // ── 1. Fetch Notion records ─────────────────────────────────────────────────
  console.log("📋  Fetching Notion database…");
  const deals = await fetchAllNotionDeals(notion);
  console.log(`    ${deals.length} records found\n`);

  // ── 2. Load GHL pipeline ────────────────────────────────────────────────────
  console.log("📊  Fetching GHL pipelines…");
  const { pipelines } = await fetchPipelines(GHL_LOCATION_ID, GHL_API_KEY);
  const pipeline = pipelines.find((p) =>
    p.name.toLowerCase().includes(PIPELINE_NAME_FRAGMENT)
  );
  if (!pipeline) {
    const names = pipelines.map((p) => `"${p.name}"`).join(", ");
    console.error(
      `❌  No pipeline matching "${PIPELINE_NAME_FRAGMENT}" found.\n` +
        `    Available pipelines: ${names || "(none)"}\n` +
        `    Update PIPELINE_NAME_FRAGMENT in this script to match.`
    );
    process.exit(1);
  }
  console.log(`    Using pipeline: "${pipeline.name}" (${pipeline.id})`);

  // Build case-insensitive stage name → ID map
  const stageMap = new Map<string, string>(
    pipeline.stages.map((s) => [s.name.toLowerCase(), s.id])
  );
  console.log(
    `    Stages: ${pipeline.stages
      .sort((a, b) => a.position - b.position)
      .map((s) => s.name)
      .join(" → ")}\n`
  );

  // ── 3. Load GHL contact custom fields ──────────────────────────────────────
  console.log("🔧  Fetching GHL contact custom fields…");
  let customFields: Awaited<ReturnType<typeof fetchCustomFields>> = [];
  try {
    customFields = await fetchCustomFields(GHL_LOCATION_ID, GHL_API_KEY);
  } catch (e) {
    console.warn("    ⚠  Could not fetch custom fields — custom field sync disabled.");
  }

  const serviceTypeFieldId = customFields.find((f) =>
    f.name.toLowerCase().includes("service type")
  )?.id;
  const leadSourceFieldId = customFields.find((f) =>
    f.name.toLowerCase().includes("lead source")
  )?.id;

  console.log(
    `    "Service Type" field ID : ${serviceTypeFieldId ?? "NOT FOUND — will skip"}`
  );
  console.log(
    `    "Lead Source" field ID  : ${leadSourceFieldId ?? "NOT FOUND — will skip"}\n`
  );

  // ── 4. Sync each deal ───────────────────────────────────────────────────────
  let created = 0,
    updated = 0,
    skipped = 0,
    errors = 0;

  for (const deal of deals) {
    const label = `"${deal.name}"`;

    if (!deal.name || deal.name === "Unknown") {
      console.log(`⏭   ${label} — skipped (no name)`);
      skipped++;
      continue;
    }

    try {
      // ── Contact ──────────────────────────────────────────────────────────
      const [firstName, ...rest] = deal.name.trim().split(/\s+/);
      const lastName = rest.join(" ");

      const cfPayload: Array<{ id: string; field_value: string }> = [];
      if (serviceTypeFieldId && deal.typeOfBusiness)
        cfPayload.push({ id: serviceTypeFieldId, field_value: deal.typeOfBusiness });
      if (leadSourceFieldId && deal.leadSource)
        cfPayload.push({ id: leadSourceFieldId, field_value: deal.leadSource });

      let contactId: string;
      let contactAction: "created" | "updated";

      const existing = deal.email
        ? await searchContactByEmail(GHL_LOCATION_ID, GHL_API_KEY, deal.email)
        : null;

      if (existing) {
        contactAction = "updated";
        if (!DRY_RUN) {
          await updateContact(existing.id, GHL_API_KEY, {
            firstName,
            lastName,
            ...(deal.phone ? { phone: deal.phone } : {}),
            ...(cfPayload.length ? { customFields: cfPayload } : {}),
          });
        }
        contactId = existing.id;
      } else {
        contactAction = "created";
        if (!DRY_RUN) {
          const c = await createContact(GHL_API_KEY, {
            locationId: GHL_LOCATION_ID,
            firstName,
            lastName,
            ...(deal.email ? { email: deal.email } : {}),
            ...(deal.phone ? { phone: deal.phone } : {}),
            ...(cfPayload.length ? { customFields: cfPayload } : {}),
          });
          contactId = c.id;
        } else {
          contactId = "dry-run-contact-id";
        }
      }

      // ── Opportunity ──────────────────────────────────────────────────────
      const ghlStageName = STATUS_TO_STAGE[deal.status ?? ""];
      const stageId = ghlStageName
        ? stageMap.get(ghlStageName.toLowerCase())
        : undefined;
      const oppStatus = toOppStatus(deal.status ?? "");
      const notes = buildNotes(deal);

      let oppAction: "created" | "updated" | "skipped";

      if (!stageId) {
        oppAction = "skipped";
        console.log(
          `⚠   ${label} — contact ${contactAction}, opp skipped` +
            ` (status "${deal.status ?? "—"}" has no stage mapping)`
        );
      } else {
        const existingOpps =
          contactAction === "updated"
            ? await fetchOpportunitiesByContact(
                GHL_LOCATION_ID,
                GHL_API_KEY,
                contactId,
                pipeline.id
              )
            : [];

        if (existingOpps.length > 0) {
          oppAction = "updated";
          if (!DRY_RUN) {
            await updateOpportunity(existingOpps[0].id, GHL_API_KEY, {
              name: deal.name,
              pipelineStageId: stageId,
              status: oppStatus,
              ...(deal.contractValue != null
                ? { monetaryValue: deal.contractValue }
                : {}),
              notes,
            });
          }
        } else {
          oppAction = "created";
          if (!DRY_RUN) {
            await createOpportunity(GHL_API_KEY, {
              pipelineId: pipeline.id,
              locationId: GHL_LOCATION_ID,
              name: deal.name,
              pipelineStageId: stageId,
              status: oppStatus,
              ...(deal.contractValue != null
                ? { monetaryValue: deal.contractValue }
                : {}),
              contactId,
              notes,
            });
          }
        }

        console.log(
          `✅  ${label} — contact ${contactAction}, opp ${oppAction}` +
            ` (${deal.status ?? "—"} → ${ghlStageName}${
              deal.contractValue != null
                ? `, $${deal.contractValue.toLocaleString()}`
                : ""
            })`
        );
      }

      if (contactAction === "created") created++;
      else updated++;
    } catch (err) {
      console.error(
        `❌  ${label} — ${err instanceof Error ? err.message : String(err)}`
      );
      errors++;
    }
  }

  console.log("\n" + "━".repeat(56));
  console.log(
    `  ✅ Created : ${created}\n` +
      `  🔄 Updated : ${updated}\n` +
      `  ⏭  Skipped : ${skipped}\n` +
      `  ❌ Errors  : ${errors}`
  );
  if (DRY_RUN) console.log("\n  (Dry run — nothing was written to GHL)");
  console.log("━".repeat(56));
}

main().catch((e) => {
  console.error("\n❌  Fatal error:", e);
  process.exit(1);
});
