import type {
  ScholarshipApiResponse,
  ScholarshipApiType,
  RegisteredRecord,
  AppliedOrDraftRecord,
} from "./types";

const BASE_URL = "https://scholarsbox.in/api/external/applications";
const PAGE_LIMIT = 100;

export type ScholarshipFilters = {
  search?: string;
  appliedStartDate?: string;
  appliedEndDate?: string;
  dueStartDate?: string;
  dueEndDate?: string;
  gender?: string;
  age?: string;
  familyIncome?: string;
};

async function fetchPage<T>(
  type: ScholarshipApiType,
  page: number,
  apiKey: string,
  filters?: ScholarshipFilters,
): Promise<ScholarshipApiResponse<T>> {
  const url = new URL(BASE_URL);
  url.searchParams.set("type", type);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_LIMIT));
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Scholarship API request failed (type=${type}, page=${page}): ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as ScholarshipApiResponse<T>;
}

/** Loops page -> page+1 until page > totalPages, per the API's pagination contract. */
export async function fetchAllRecords(
  type: "registered",
  apiKey: string,
  filters?: ScholarshipFilters,
): Promise<RegisteredRecord[]>;
export async function fetchAllRecords(
  type: "applied" | "draft",
  apiKey: string,
  filters?: ScholarshipFilters,
): Promise<AppliedOrDraftRecord[]>;
export async function fetchAllRecords(
  type: ScholarshipApiType,
  apiKey: string,
  filters?: ScholarshipFilters,
): Promise<(RegisteredRecord | AppliedOrDraftRecord)[]> {
  const all: (RegisteredRecord | AppliedOrDraftRecord)[] = [];
  let page = 1;
  while (true) {
    const json = await fetchPage<RegisteredRecord | AppliedOrDraftRecord>(
      type,
      page,
      apiKey,
      filters,
    );
    const records = type === "registered" ? (json.data.users ?? []) : (json.data.applications ?? []);
    all.push(...records);

    const totalPages = json.data.totalPages ?? 1;
    if (page >= totalPages || records.length === 0) break;
    page += 1;
  }
  return all;
}
