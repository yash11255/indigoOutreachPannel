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

/** Case-insensitive substring match against the flattened question text —
 * returns the first matching answer, or null if nothing matched or the
 * matched answer was blank. */
export function findAnswer(
  flat: Map<string, string>,
  ...substrings: string[]
): string | null {
  const needles = substrings.map((s) => s.toLowerCase());
  for (const [question, answer] of flat.entries()) {
    if (needles.some((n) => question.includes(n))) {
      return answer.trim() || null;
    }
  }
  return null;
}
