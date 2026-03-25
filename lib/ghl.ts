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

// ─── Functions ────────────────────────────────────────────────────────────────

function ghlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
  };
}

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

  const res = await fetch(`${GHL_BASE_URL}/contacts/?${params}`, {
    headers: ghlHeaders(apiKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchPipelines(
  locationId: string,
  apiKey: string
): Promise<PipelinesResponse> {
  const params = new URLSearchParams({ locationId });
  const res = await fetch(`${GHL_BASE_URL}/opportunities/pipelines?${params}`, {
    headers: ghlHeaders(apiKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchOpportunities(
  locationId: string,
  apiKey: string,
  options: {
    limit?: number;
    startAfterId?: string;
    pipelineId?: string;
    stageId?: string;
    status?: string;
  } = {}
): Promise<OpportunitiesResponse> {
  const { limit = 100, startAfterId, pipelineId, stageId, status } = options;

  // GHL v2 opportunities/search uses snake_case location_id
  const params = new URLSearchParams({ location_id: locationId, limit: String(limit) });
  if (startAfterId) params.set("startAfterId", startAfterId);
  if (pipelineId) params.set("pipeline_id", pipelineId);
  if (stageId) params.set("pipeline_stage_id", stageId);
  if (status) params.set("status", status);

  const res = await fetch(`${GHL_BASE_URL}/opportunities/search?${params}`, {
    headers: ghlHeaders(apiKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function createEmailTemplate(
  locationId: string,
  apiKey: string,
  template: { name: string; subject: string; body: string }
): Promise<EmailTemplate> {
  const res = await fetch(`${GHL_BASE_URL}/locations/${locationId}/emails/builder`, {
    method: "POST",
    headers: ghlHeaders(apiKey),
    body: JSON.stringify(template),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  return res.json();
}
