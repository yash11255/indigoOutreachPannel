import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { str, num, isoDate, normalizeStatus, joinRemarks } from "../migrate-helpers";

describe("str", () => {
  test("trims whitespace", () => {
    assert.equal(str("  Hello  "), "Hello");
  });
  test("returns null for empty/whitespace-only strings", () => {
    assert.equal(str("   "), null);
    assert.equal(str(""), null);
  });
  test("returns null for null/undefined", () => {
    assert.equal(str(null), null);
    assert.equal(str(undefined), null);
  });
  test("stringifies numbers", () => {
    assert.equal(str(42), "42");
  });
});

describe("num", () => {
  test("passes through numbers", () => {
    assert.equal(num(42), 42);
  });
  test("extracts a number from a string with trailing text", () => {
    assert.equal(num("25 sessions- offline"), 25);
  });
  test("extracts negative and decimal numbers", () => {
    assert.equal(num("-3.5 units"), -3.5);
  });
  test("returns null when no number is present", () => {
    assert.equal(num("yes"), null);
    assert.equal(num(""), null);
    assert.equal(num(null), null);
  });
});

describe("isoDate", () => {
  test("formats a Date as YYYY-MM-DD", () => {
    assert.equal(isoDate(new Date("2026-07-08T00:00:00.000Z")), "2026-07-08");
  });
  test("returns null for non-Date values", () => {
    assert.equal(isoDate("2026-07-08"), null);
    assert.equal(isoDate(null), null);
    assert.equal(isoDate(undefined), null);
  });
  test("rounds away sub-day float drift instead of flooring to the previous day", () => {
    // Google Sheets exports sometimes store a date serial a few seconds shy
    // of midnight (e.g. 23:59:50) instead of exact midnight.
    assert.equal(isoDate(new Date("2026-06-14T18:29:50.000Z")), "2026-06-15");
  });
  test("keeps the same day for drift just after midnight", () => {
    assert.equal(isoDate(new Date("2026-06-15T00:00:10.000Z")), "2026-06-15");
  });
  test("parses a day-first D/M/YYYY string Excel left as free text", () => {
    assert.equal(isoDate("30/6/2026"), "2026-06-30");
  });
  test("parses a zero-padded DD/MM/YYYY string", () => {
    assert.equal(isoDate("05/07/2026"), "2026-07-05");
  });
  test("returns null for an out-of-range day-first string", () => {
    assert.equal(isoDate("32/13/2026"), null);
  });
});

describe("normalizeStatus", () => {
  test("passes through an exact canonical status", () => {
    assert.deepEqual(normalizeStatus("Activity Completed"), {
      status: "Activity Completed",
      note: null,
    });
  });
  test("is case-insensitive on exact matches", () => {
    assert.deepEqual(normalizeStatus("activity completed"), {
      status: "Activity Completed",
      note: null,
    });
  });
  test("defaults to Planned for empty input", () => {
    assert.deepEqual(normalizeStatus(null), { status: "Planned", note: null });
    assert.deepEqual(normalizeStatus(""), { status: "Planned", note: null });
  });
  test("guesses Activity Completed from free text, keeping a note", () => {
    const result = normalizeStatus("Collaterals & Information Shared - completed successfully");
    assert.equal(result.status, "Activity Completed");
    assert.match(result.note!, /Original status:/);
  });
  test("guesses Rejected from free text", () => {
    assert.equal(normalizeStatus("Institution rejected our request").status, "Rejected");
  });
  test("prefers Approval Awaited over Approved when both words present", () => {
    assert.equal(normalizeStatus("Approval awaited from state dept").status, "Approval Awaited");
  });
  test("falls back to Planned for unrecognized free text", () => {
    const result = normalizeStatus("Some totally unrelated remark");
    assert.equal(result.status, "Planned");
    assert.match(result.note!, /Original status: Some totally unrelated remark/);
  });
});

describe("joinRemarks", () => {
  test("joins non-null parts with a separator", () => {
    assert.equal(joinRemarks("a", null, "b"), "a | b");
  });
  test("returns null when every part is null or empty", () => {
    assert.equal(joinRemarks(null, null), null);
    assert.equal(joinRemarks("", null), null);
  });
});
