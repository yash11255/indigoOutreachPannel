import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { stageForStatus, STAGE_ORDER, STAGE_LABELS } from "../types";

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
      Rejected: "stalled",
    };
    for (const [status, stage] of Object.entries(expected)) {
      assert.equal(stageForStatus(status), stage, `status "${status}" should map to "${stage}"`);
    }
  });

  test("falls back to planned for an unrecognized status", () => {
    assert.equal(stageForStatus("Some Unknown Status"), "planned");
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
