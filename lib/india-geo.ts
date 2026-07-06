/** Normalizes a state name for matching between our `leads.state` values and the map's `st_nm` property (which spells out "and" instead of "&"). */
function rawNormalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Misspellings/abbreviations seen in the source data that would otherwise silently drop a state's leads off the map entirely. */
const STATE_ALIASES: Record<string, string> = {
  chattisgarh: "chhattisgarh",
  karanataka: "karnataka",
  madhyapradesh: "madhya pradesh",
  mp: "madhya pradesh",
  "uttar pardesh": "uttar pradesh",
  up: "uttar pradesh",
  uttrakhand: "uttarakhand",
  wb: "west bengal",
};

export function normalizeStateName(name: string | null | undefined): string {
  if (!name) return "";
  const normalized = rawNormalize(name);
  return STATE_ALIASES[normalized] ?? normalized;
}

/**
 * Common city names in `leads.district_city` that don't match their official
 * district name at all (e.g. "Guwahati" is a city in Kamrup Metropolitan
 * district, not a district itself). Keyed by normalized city name; value is
 * the normalized official district name to match against.
 */
const CITY_TO_DISTRICT_ALIASES: Record<string, string> = {
  guwahati: "kamrup metropolitan",
  silchar: "cachar",
  tezpur: "sonitpur",
  shillong: "east khasi hills",
  bhubaneswar: "khordha",
  itanagar: "papum pare",
  mangaluru: "dakshina kannada",
  mysore: "mysuru",
  tumkur: "tumakuru",
  gurgaon: "gurugram",
  "bengaluru region": "bengaluru urban",
  "urban bengaluru": "bengaluru urban",
  "rural bengaluru": "bengaluru rural",
};

function normalizeFreeText(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Finds the single best-matching official district for a free-text
 * `district_city` value, out of the candidate district names for that state.
 * Returns null if nothing matches. Never returns more than one district, so
 * callers don't double-count a lead across multiple districts (e.g. a naive
 * "Kanpur" substring match against both "Kanpur Nagar" and "Kanpur Dehat", or
 * the false-positive "Agra" inside "Prayagraj").
 */
export function findMatchingDistrict(
  districtCity: string | null | undefined,
  candidateDistricts: string[],
): string | null {
  if (!districtCity) return null;
  const cityNorm = normalizeFreeText(districtCity);
  if (!cityNorm) return null;

  const aliased = CITY_TO_DISTRICT_ALIASES[cityNorm];
  const targetNorm = aliased ?? cityNorm;

  const exact = candidateDistricts.find((d) => normalizeFreeText(d) === targetNorm);
  if (exact) return exact;

  const targetFirstWord = targetNorm.split(" ")[0];
  const candidates = candidateDistricts.filter(
    (d) => normalizeFreeText(d).split(" ")[0] === targetFirstWord,
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const urban = candidates.find((c) => /urban/i.test(c));
  if (urban) return urban;
  return [...candidates].sort()[0];
}
