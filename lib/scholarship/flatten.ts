import type { QAResponse, RequirementSection } from "./types";

function stringifyAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "";
  if (Array.isArray(answer)) {
    // A plain array of scalars (e.g. multi-select answers) — table-type
    // arrays of {question, answer} rows are handled separately in
    // flattenResponse so they don't collapse into this branch.
    return answer
      .map((v) => (typeof v === "object" ? "" : String(v)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof answer === "object") return JSON.stringify(answer);
  return String(answer);
}

function isQARow(value: unknown): value is QAResponse {
  return !!value && typeof value === "object" && "question" in value;
}

/** Recursively walks one response, handling both `nestedAnswers` and
 * answerType "table" rows (where `answer` is itself an array of
 * {question, answer} sub-rows) — both need the same flattening treatment. */
function flattenResponse(response: QAResponse, out: Map<string, string>) {
  const question = response.question?.trim().toLowerCase();
  if (question) {
    // "table" answers are structural (a list of sub-questions), not a
    // single displayable value — don't stringify the raw array over the
    // sub-rows' own entries.
    if (response.answerType !== "table") {
      out.set(question, stringifyAnswer(response.answer));
    }
  }

  if (response.answerType === "table" && Array.isArray(response.answer)) {
    for (const row of response.answer) {
      if (isQARow(row)) flattenResponse(row, out);
    }
  }

  if (Array.isArray(response.nestedAnswers)) {
    for (const nested of response.nestedAnswers) {
      flattenResponse(nested, out);
    }
  }
}

/** Flattens every section's Q&A (including nested/table rows) into a single
 * lowercased-question -> answer lookup, for the whole application. */
export function flattenAdditionalRequirements(
  sections: RequirementSection[] | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const section of sections ?? []) {
    for (const response of section.responses ?? []) {
      flattenResponse(response, out);
    }
  }
  return out;
}

/**
 * Case-insensitive substring match against the flattened question text.
 *
 * Different scholarship programs use different custom forms, so a field
 * might be phrased precisely on one form and missing entirely on another —
 * callers pass substrings from most to least specific (e.g. "employment
 * status" before the bare fallback "employment") to handle that. Each
 * substring is tried across *every* question before moving on to the next,
 * broader one — NOT the reverse. Checking all questions against all
 * substrings at once (as this used to do) let a broad fallback needle like
 * "employment" match some unrelated question ("Are you currently employed
 * abroad?", a section header, etc.) purely because it happened to appear
 * earlier in the form than the real "Employment status" question — pulling
 * in answers like a nationality or city value with no relation to the
 * field being extracted. Trying the precise needle first across the whole
 * form avoids that: the broad fallback only ever fires when the specific
 * question genuinely isn't present anywhere.
 */
export function findAnswer(
  flat: Map<string, string>,
  ...substrings: string[]
): string | null {
  for (const substring of substrings) {
    const needle = substring.toLowerCase();
    for (const [question, answer] of flat.entries()) {
      if (question.includes(needle)) {
        const trimmed = answer.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return null;
}
