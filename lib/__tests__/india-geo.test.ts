import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeStateName, findMatchingDistrict } from "../india-geo";

describe("normalizeStateName", () => {
  test("treats '&' and 'and' as equivalent", () => {
    assert.equal(normalizeStateName("Jammu & Kashmir"), normalizeStateName("Jammu and Kashmir"));
  });
  test("is case-insensitive", () => {
    assert.equal(normalizeStateName("Andhra Pradesh"), normalizeStateName("ANDHRA PRADESH"));
  });
  test("collapses punctuation/whitespace differences", () => {
    assert.equal(
      normalizeStateName("Dadra & Nagar Haveli and Daman & Diu"),
      normalizeStateName("Dadra and Nagar Haveli and Daman and Diu"),
    );
  });
  test("returns empty string for null/undefined", () => {
    assert.equal(normalizeStateName(null), "");
    assert.equal(normalizeStateName(undefined), "");
  });

  test("resolves known misspellings/abbreviations to the canonical state", () => {
    assert.equal(normalizeStateName("Chattisgarh"), normalizeStateName("Chhattisgarh"));
    assert.equal(normalizeStateName("Karanataka"), normalizeStateName("Karnataka"));
    assert.equal(normalizeStateName("MadhyaPradesh"), normalizeStateName("Madhya Pradesh"));
    assert.equal(normalizeStateName("MP"), normalizeStateName("Madhya Pradesh"));
    assert.equal(normalizeStateName("Uttar Pardesh"), normalizeStateName("Uttar Pradesh"));
    assert.equal(normalizeStateName("Uttrakhand"), normalizeStateName("Uttarakhand"));
    assert.equal(normalizeStateName("WB"), normalizeStateName("West Bengal"));
  });
});

describe("findMatchingDistrict", () => {
  const UP_DISTRICTS = ["Agra", "Prayagraj", "Kanpur Nagar", "Kanpur Dehat", "Lucknow"];

  test("matches an exact district name", () => {
    assert.equal(findMatchingDistrict("Lucknow", UP_DISTRICTS), "Lucknow");
  });

  test("is case-insensitive on exact matches", () => {
    assert.equal(findMatchingDistrict("lucknow", UP_DISTRICTS), "Lucknow");
  });

  test("does not false-positive-match a substring across word boundaries", () => {
    // "Agra" must not match "Prayagraj" just because the letters appear inside it.
    assert.equal(findMatchingDistrict("Agra", UP_DISTRICTS), "Agra");
  });

  test("resolves an ambiguous first-word match to exactly one district, never both", () => {
    const result = findMatchingDistrict("Kanpur", UP_DISTRICTS);
    assert.ok(result === "Kanpur Nagar" || result === "Kanpur Dehat");
  });

  test("prefers the Urban variant when ambiguous between Urban/Rural", () => {
    assert.equal(
      findMatchingDistrict("Bengaluru", ["Bengaluru Urban", "Bengaluru Rural"]),
      "Bengaluru Urban",
    );
  });

  test("applies known city-to-district aliases", () => {
    assert.equal(
      findMatchingDistrict("Guwahati", ["Kamrup Metropolitan", "Kamrup", "Nagaon"]),
      "Kamrup Metropolitan",
    );
    assert.equal(
      findMatchingDistrict("Bengaluru Region", ["Bengaluru Urban", "Bengaluru Rural"]),
      "Bengaluru Urban",
    );
  });

  test("returns null when nothing matches", () => {
    assert.equal(findMatchingDistrict("Kerala", UP_DISTRICTS), null);
  });

  test("returns null for empty/null input", () => {
    assert.equal(findMatchingDistrict(null, UP_DISTRICTS), null);
    assert.equal(findMatchingDistrict("", UP_DISTRICTS), null);
  });
});
