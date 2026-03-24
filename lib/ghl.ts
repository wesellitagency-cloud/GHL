const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

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

export interface EmailTemplate {
  id: string;
  name: string;
  subject?: string;
  body?: string;
  locationId?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

export async function createEmailTemplate(
  locationId: string,
  apiKey: string,
  template: {
    name: string;
    subject: string;
    body: string;
  }
): Promise<EmailTemplate> {
  const res = await fetch(
    `${GHL_BASE_URL}/locations/${locationId}/emails/builder`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: GHL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        body: template.body,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchContacts(
  locationId: string,
  apiKey: string,
  options: {
    limit?: number;
    startAfterId?: string;
    query?: string;
  } = {}
): Promise<ContactsResponse> {
  const { limit = 20, startAfterId, query } = options;

  const params = new URLSearchParams({
    locationId,
    limit: String(limit),
  });

  if (startAfterId) params.set("startAfterId", startAfterId);

  if (query) params.set("query", query);

  const res = await fetch(`${GHL_BASE_URL}/contacts/?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_API_VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API error ${res.status}: ${body}`);
  }

  return res.json();
}
