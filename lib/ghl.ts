const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// ─── Contacts ────────────────────────────────────────────────────────────────

export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  tags?: string[];
  dateAdded?: string;
  dateUpdated?: string;
  locationId?: string;
  source?: string;
  type?: string;
}

export interface ContactsResponse {
  contacts: GHLContact[];
  meta: {
    total: number;
    nextPageUrl?: string | null;
    startAfter?: number | null;
    startAfterId?: string | null;
    currentPage?: number;
    nextPage?: number | null;
    prevPage?: number | null;
  };
}

export interface GHLContactInput {
  locationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  customFields?: Array<{ id: string; field_value: string }>;
  tags?: string[];
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  name: string;
  subject?: string;
  body?: string;
  locationId?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

// ─── Pipelines & Opportunities ───────────────────────────────────────────────

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
}

export interface PipelinesResponse {
  pipelines: GHLPipeline[];
}

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  monetaryValue?: number;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  lastStageChangeAt?: string;
}

export interface GHLOpportunityInput {
  pipelineId: string;
  locationId: string;
  name: string;
  pipelineStageId: string;
  status?: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  contactId?: string;
  notes?: string;
}

export interface OpportunitiesResponse {
  opportunities: GHLOpportunity[];
  meta: {
    total: number;
    nextPageUrl?: string | null;
    startAfterId?: string | null;
    currentPage?: number;
    nextPage?: number | null;
    prevPage?: number | null;
  };
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

export interface GHLCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  model: string;
  locationId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ghlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
  };
}

async function ghlFetch(url: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...ghlHeaders(apiKey), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status} ${res.url}: ${body}`);
  }
  return res.json();
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function fetchContacts(
  locationId: string,
  apiKey: string,
  options: {
    limit?: number;
    startAfterId?: string;
    query?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<ContactsResponse> {
  const { limit = 20, startAfterId, query, startDate, endDate } = options;

  const params = new URLSearchParams({ locationId, limit: String(limit) });
  if (startAfterId) params.set("startAfterId", startAfterId);
  if (query) params.set("query", query);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  return ghlFetch(`${GHL_BASE_URL}/contacts/?${params}`, apiKey, {
    cache: "no-store" as RequestCache,
  });
}

export async function searchContactByEmail(
  locationId: string,
  apiKey: string,
  email: string
): Promise<GHLContact | null> {
  const params = new URLSearchParams({ locationId, limit: "1", query: email });
  const data: ContactsResponse = await ghlFetch(
    `${GHL_BASE_URL}/contacts/?${params}`,
    apiKey,
    { cache: "no-store" as RequestCache }
  );
  // Exact email match guard (query is a fuzzy search)
  const match = (data.contacts ?? []).find(
    (c) => c.email?.toLowerCase() === email.toLowerCase()
  );
  return match ?? null;
}

export async function createContact(
  apiKey: string,
  data: GHLContactInput
): Promise<GHLContact> {
  const res: { contact: GHLContact } = await ghlFetch(
    `${GHL_BASE_URL}/contacts/`,
    apiKey,
    { method: "POST", body: JSON.stringify(data) }
  );
  return res.contact;
}

export async function updateContact(
  contactId: string,
  apiKey: string,
  data: Partial<GHLContactInput>
): Promise<GHLContact> {
  const res: { contact: GHLContact } = await ghlFetch(
    `${GHL_BASE_URL}/contacts/${contactId}`,
    apiKey,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return res.contact;
}

// ─── Custom Fields ────────────────────────────────────────────────────────────

export async function fetchCustomFields(
  locationId: string,
  apiKey: string
): Promise<GHLCustomField[]> {
  const params = new URLSearchParams({ locationId });
  const data: { customFields: GHLCustomField[] } = await ghlFetch(
    `${GHL_BASE_URL}/locations/${locationId}/customFields?${params}`,
    apiKey,
    { cache: "no-store" as RequestCache }
  );
  return data.customFields ?? [];
}

// ─── Pipelines ────────────────────────────────────────────────────────────────

export async function fetchPipelines(
  locationId: string,
  apiKey: string
): Promise<PipelinesResponse> {
  const params = new URLSearchParams({ locationId });
  return ghlFetch(
    `${GHL_BASE_URL}/opportunities/pipelines?${params}`,
    apiKey,
    { cache: "no-store" as RequestCache }
  );
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export async function fetchOpportunities(
  locationId: string,
  apiKey: string,
  options: {
    limit?: number;
    startAfterId?: string;
    pipelineId?: string;
    stageId?: string;
    status?: string;
    contactId?: string;
  } = {}
): Promise<OpportunitiesResponse> {
  const { limit = 100, startAfterId, pipelineId, stageId, status, contactId } =
    options;

  const params = new URLSearchParams({
    location_id: locationId,
    limit: String(limit),
  });
  if (startAfterId) params.set("startAfterId", startAfterId);
  if (pipelineId) params.set("pipeline_id", pipelineId);
  if (stageId) params.set("pipeline_stage_id", stageId);
  if (status) params.set("status", status);
  if (contactId) params.set("contactId", contactId);

  return ghlFetch(
    `${GHL_BASE_URL}/opportunities/search?${params}`,
    apiKey,
    { cache: "no-store" as RequestCache }
  );
}

/** Fetch every opportunity in a pipeline by auto-paginating. */
export async function fetchAllOpportunities(
  locationId: string,
  apiKey: string,
  pipelineId?: string
): Promise<GHLOpportunity[]> {
  const all: GHLOpportunity[] = [];
  let cursor: string | undefined;

  do {
    const page = await fetchOpportunities(locationId, apiKey, {
      limit: 100,
      pipelineId,
      startAfterId: cursor,
    });
    all.push(...page.opportunities);
    cursor = page.meta.startAfterId ?? undefined;
  } while (cursor);

  return all;
}

/** Return opportunities linked to a specific contact in a pipeline. */
export async function fetchOpportunitiesByContact(
  locationId: string,
  apiKey: string,
  contactId: string,
  pipelineId?: string
): Promise<GHLOpportunity[]> {
  const data = await fetchOpportunities(locationId, apiKey, {
    contactId,
    pipelineId,
    limit: 10,
  });
  return data.opportunities ?? [];
}

export async function createOpportunity(
  apiKey: string,
  data: GHLOpportunityInput
): Promise<GHLOpportunity> {
  const res: { opportunity: GHLOpportunity } = await ghlFetch(
    `${GHL_BASE_URL}/opportunities/`,
    apiKey,
    { method: "POST", body: JSON.stringify(data) }
  );
  return res.opportunity;
}

export async function updateOpportunity(
  opportunityId: string,
  apiKey: string,
  data: Partial<GHLOpportunityInput>
): Promise<GHLOpportunity> {
  const res: { opportunity: GHLOpportunity } = await ghlFetch(
    `${GHL_BASE_URL}/opportunities/${opportunityId}`,
    apiKey,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return res.opportunity;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export async function createEmailTemplate(
  locationId: string,
  apiKey: string,
  template: { name: string; subject: string; body: string }
): Promise<EmailTemplate> {
  return ghlFetch(
    `${GHL_BASE_URL}/locations/${locationId}/emails/builder`,
    apiKey,
    { method: "POST", body: JSON.stringify(template) }
  );
}
