import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stageForStatus, STAGE_ORDER, STAGE_LABELS, effectiveStage } from "../types";

describe("stageForStatus", () => {
  test("maps every canonical status to a stage", () => {
    const expected: Record<string, string> = {
      Planned: "planned",
      "Contact Details Pending": "planned",
      "Contact Identified": "planned",
      "Outreach Request sent": "outreach_sent",
      "Approval Awaited": "outreach_sent",
      Approved: "outreach_sent",
      "Activity Scheduled": "scheduled",
      "Activity Completed": "completed",
      Closed: "completed",
      "No Response": "stalled",
      Rejected: "completed",
    };
    for (const [status, stage] of Object.entries(expected)) {
      assert.equal(stageForStatus(status), stage, `status "${status}" should map to "${stage}"`);
    }
  });

  test("falls back to planned for an unrecognized status", () => {
    assert.equal(stageForStatus("Some Unknown Status"), "planned");
  });
});

describe("effectiveStage", () => {
  const TODAY = "2026-07-24";
  const base = {
    executed_date: null as string | null,
    planned_activity: null as string | null,
    activity_undertaken: null as string | null,
  };

  test("an untouched round exactly 2 days overdue is still its raw stage", () => {
    const lead = { ...base, status: "Planned", planned_date: "2026-07-22" };
    assert.equal(effectiveStage(lead, [], TODAY), "planned");
  });

  test("an untouched round 3 days overdue displays as stalled", () => {
    const lead = { ...base, status: "Planned", planned_date: "2026-07-21" };
    assert.equal(effectiveStage(lead, [], TODAY), "stalled");
  });

  test("a round not yet due (future planned_date) is unaffected", () => {
    const lead = { ...base, status: "Outreach Request sent", planned_date: "2026-08-01" };
    assert.equal(effectiveStage(lead, [], TODAY), "outreach_sent");
  });

  test("already-resolved statuses are never reclassified, no matter how overdue", () => {
    const rejected = { ...base, status: "Rejected", planned_date: "2026-01-01" };
    assert.equal(effectiveStage(rejected, [], TODAY), "completed");
    const noResponse = { ...base, status: "No Response", planned_date: "2026-01-01" };
    assert.equal(effectiveStage(noResponse, [], TODAY), "stalled");
    const completed = {
      ...base,
      status: "Activity Completed",
      executed_date: "2026-07-01",
      planned_date: "2026-01-01",
    };
    assert.equal(effectiveStage(completed, [], TODAY), "completed");
  });

  test("checks the current pending round's planned_date once round 1 is executed", () => {
    const lead = { ...base, status: "Activity Scheduled", executed_date: "2026-07-01", planned_date: "2026-06-01" };
    const overdueRound = [
      {
        status: "Activity Scheduled",
        executed_date: null,
        planned_date: "2026-07-10",
        sequence_no: 2,
        title: null,
        activity_undertaken: null,
      },
    ];
    assert.equal(effectiveStage(lead, overdueRound, TODAY), "stalled");
  });

  test("a resolved later round doesn't drag the lead into stalled", () => {
    const lead = { ...base, status: "Activity Scheduled", executed_date: "2026-07-01", planned_date: "2026-06-01" };
    const rejectedRound = [
      {
        status: "Rejected",
        executed_date: null,
        planned_date: "2026-06-10",
        sequence_no: 2,
        title: null,
        activity_undertaken: null,
      },
    ];
    assert.equal(effectiveStage(lead, rejectedRound, TODAY), "scheduled");
  });

  test("a Planned lead whose latest activity is outreach-only (not a session) shows as Outreach Sent", () => {
    const lead = { ...base, status: "Planned", planned_date: "2026-07-24", planned_activity: "WhatsApp circulation" };
    assert.equal(effectiveStage(lead, [], TODAY), "outreach_sent");
  });

  test("a lead with a genuine awareness session planned shows as scheduled regardless of literal status", () => {
    const lead = {
      ...base,
      status: "Planned",
      planned_date: "2026-07-24",
      planned_activity: "Awareness Session - Students",
    };
    assert.equal(effectiveStage(lead, [], TODAY), "scheduled");

    const outreachSentStatus = { ...lead, status: "Outreach Request sent" };
    assert.equal(effectiveStage(outreachSentStatus, [], TODAY), "scheduled");
  });

  test("a Planned lead with no activity chosen yet stays Planned", () => {
    const lead = { ...base, status: "Planned", planned_date: "2026-07-24" };
    assert.equal(effectiveStage(lead, [], TODAY), "planned");
  });

  test("outreach-only reclassification also checks the current pending later round", () => {
    const lead = { ...base, status: "Planned", executed_date: "2026-07-01", planned_date: "2026-06-01" };
    const rounds = [
      {
        status: "Planned",
        executed_date: null,
        planned_date: "2026-07-24",
        sequence_no: 2,
        title: "Email circulation",
        activity_undertaken: null,
      },
    ];
    assert.equal(effectiveStage(lead, rounds, TODAY), "outreach_sent");
  });
});

describe("STAGE_ORDER / STAGE_LABELS", () => {
  test("every stage in STAGE_ORDER has a label", () => {
    for (const stage of STAGE_ORDER) {
      assert.ok(STAGE_LABELS[stage], `missing label for stage "${stage}"`);
    }
  });

  test("STAGE_ORDER has no duplicates", () => {
    assert.equal(new Set(STAGE_ORDER).size, STAGE_ORDER.length);
  });
});
