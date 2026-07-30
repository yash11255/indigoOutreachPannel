import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  hasAwarenessSession,
  OUTREACH_ACTIVITIES,
  AWARENESS_SESSION_ACTIVITIES,
} from "../outreach-taxonomy";

describe("hasAwarenessSession", () => {
  test("recognizes RTO session as a genuine awareness session", () => {
    assert.equal(hasAwarenessSession(["RTO session"]), true);
    assert.equal(hasAwarenessSession(["rto session"]), true);
  });

  test("still recognizes every other existing session type", () => {
    assert.equal(hasAwarenessSession(["Awareness Session - Students"]), true);
    assert.equal(hasAwarenessSession(["Community awareness meeting"]), true);
    assert.equal(hasAwarenessSession(["Webinar session"]), true);
  });

  test("does not treat lower-touch outreach as a session", () => {
    assert.equal(hasAwarenessSession(["WhatsApp circulation"]), false);
    assert.equal(hasAwarenessSession(["Official email"]), false);
    assert.equal(hasAwarenessSession(["Notice board display"]), false);
  });

  test("matches inside a comma-joined multi-value string", () => {
    assert.equal(hasAwarenessSession(["Flyer distribution, RTO session"]), true);
  });

  test("every AWARENESS_SESSION_ACTIVITIES entry is also in OUTREACH_ACTIVITIES", () => {
    for (const activity of AWARENESS_SESSION_ACTIVITIES) {
      assert.ok(
        OUTREACH_ACTIVITIES.includes(activity),
        `"${activity}" is marked as a session type but missing from the selectable activity list`,
      );
    }
  });
});
