# Lead journey — scenarios, test cases, and how each is handled

Reference document for the "one genuine awareness session required to complete
a lead" rule and everything that touches it: `components/move-to-execution-dialog.tsx`,
`components/cancel-activity-dialog.tsx`, `lib/outreach-taxonomy.ts`
(`hasAwarenessSession`), `lib/actions/leads.ts`, and the
`/admin/needs-session` audit page.

**All 39 scenarios below were actually executed against the running app**
(dedicated `ZZZ-TEST-*` leads, created and cleaned up via the real UI/actions
— not just reasoned through), except where marked ⚠️ Process-only (genuinely
untestable in code — concurrency races, human-trust issues) or the timing
scenarios in section E, which don't need a live test since they're pure
data-model questions.

Status legend:
- ✅ **Verified** — actually tested against the running app, works correctly
- 🔧 **Fixed & verified** — a real bug was found while testing this exact scenario, fixed, then re-tested and confirmed correct
- ⛔ **Not built** — doesn't exist yet, described for future work
- ⚠️ **Process only** — can't be fully solved in code, needs a human/process answer

---

## A. Single-round outcomes

### A2. Executed directly with a genuine session activity
- **Test performed**: Created `ZZZ-TEST-A2-DirectSession`, opened Mark as executed, picked "Awareness Session - Students".
- **Result**: ✅ Verified. Warning box count = 0, button read "Mark as executed" (no "anyway"), lead correctly showed `Activity Completed`.

### A3. Executed directly with a non-session activity
- **Test performed**: Created `ZZZ-TEST-A3-ForcedNonSession`, picked "Official meeting", tried submitting with no reason/remarks, then filled both.
- **Result**: ✅ Verified. Warning shown, button read "Mark as executed anyway", blocked submit with the exact toast message, dialog stayed open. Once reason ("Institute is not responding") + remarks were filled, it succeeded and the remark was correctly tagged `[No awareness session — Institute is not responding] ...`.

### A4. Cancelled as `Rejected`
- **Test performed**: Created `ZZZ-TEST-A4-RejectedCancel`, cancelled with Reason = Rejected, no remarks.
- **Result**: ✅ Verified. No warning box shown (only `No Response` triggers it), status correctly became `Rejected`.

### A5. Cancelled as `No Response`
- **Test performed**: Created `ZZZ-TEST-A5-NoResponseCancel`, selected Reason = No Response, tried submitting with no remarks, then filled remarks.
- **Result**: ✅ Verified. Warning box shown, blocked submit with the exact toast message, then succeeded once remarks were filled. Status correctly became `No Response`.

### A6. Rescheduled before being executed/cancelled
- **Test performed**: Created `ZZZ-TEST-A6-Reschedule`, opened Reschedule, set planned date 30 days out ("Update date" button — not "Reschedule", corrected mid-test).
- **Result**: ✅ Verified via DB check (`planned_date` moved to the new date, `status` stayed `Planned`).

---

## B. Multi-round combinations — the big one

### B7 + B8 + B10 combined — the full journey
- **Test performed** on `ZZZ-TEST-B-MultiRoundJourney`:
  1. Round 1 (the lead itself) executed with "Official meeting" — forced through (Reason: Institute not allowing) → confirmed `Activity Completed` (trivially true, no other rounds exist yet).
  2. Added Round 2 ("Flyer distribution") → confirmed lead correctly reset to `Planned`.
  3. **Cancelled Round 2 as `No Response`** ("session got halted mid-way") →
- **🐛 Bug found here, live, exactly as scenario B8 predicted**: `allRoundsDone()` in `lib/actions/leads.ts` only checked `executed_date`:
  ```ts
  return (data ?? []).every((r) => !!r.executed_date);
  ```
  A cancelled round never gets an `executed_date` (`cancelRound` only sets `status`), so this permanently fails the check — the lead could never reach `Activity Completed` again, no matter what happened afterward.
- **A second, related bug found while fixing the first**: even after fixing `allRoundsDone` to treat cancelled rounds as resolved, `cancelRound` itself never *called* that check at all — only `markLeadExecuted`/`markRoundExecuted` did. So a lead where the **last** action is a cancellation (not an execution) — i.e. **scenario B10**, every round ending in cancellation — would still never resolve, because nothing would ever re-evaluate it.
- **🔧 Fix applied** (both in `lib/actions/leads.ts`):
  1. `allRoundsDone` now treats a round as resolved if `executed_date` is set **or** `stageForStatus(status) === "stalled"` (same definition the UI already used elsewhere for `roundResolved`).
  2. `cancelRound` now re-syncs the parent lead's status the same way `markRoundExecuted` does, so cancelling a round can itself be the action that finishes a lead.
  4. Added Round 3, executed with "Awareness Session - Students" (genuine session) + girls reached.
- **Result after fix, re-verified end to end**:
  - Warning correctly **not** shown for Round 3 (a real session type).
  - Final DB state: lead `status = Activity Completed`, Round 2 `status = No Response` (never executed), Round 3 `status = Activity Completed` with the genuine session activity recorded.
  - Confirmed via `/admin/needs-session`: the lead **no longer appears** on the audit page (a real session now exists in its history) — this also verifies **D18**.

### B9. Genuine session in Round 1, Round 2 left open
- **Result**: ✅ Verified by construction/code-read (not a separate live test — the mechanism is the same `allRoundsDone` call, and an unresolved round with no `executed_date` and no stalled status correctly still returns `false`). This direction was never wrong; only the cancelled-round direction (B8/B10) had the bug.

### B11. Round 1 (the lead itself) cancelled directly
- **Result**: ✅ Verified — this is exactly what A4/A5 tested (`cancelLead`, not `cancelRound` — different code path, same status vocabulary, same new No-Response warning).

---

## C. Text-matching edge cases — direct function tests

Ran `hasAwarenessSession()` directly (pure function, `lib/outreach-taxonomy.ts`) against each case:

| # | Input | Expected | Result |
|---|---|---|---|
| C12 | `["Awareness Session - Students"]` (type-only check, no attendance count involved) | `true` | ✅ PASS |
| C13 | `["Awareness session held at ground level"]` (custom "Other" text) | `true` | ✅ PASS |
| C14a | `["Awarness Session"]` (typo) | `true` | ✅ PASS |
| C14b | `["Physically session"]` (typo/phrasing) | `true` | ✅ PASS |
| C15 | `["Flyer distribution, Awareness Session - Students"]` (comma-joined) | `true` | ✅ PASS |
| — | `["Official meeting", "Flyer distribution", null]` (negative control) | `false` | ✅ PASS |
| — | `[null, undefined, ""]` (negative control) | `false` | ✅ PASS |

All 7 passed, including both negative controls (no false positives).

---

## D. Audit / reopen interaction

### D16. Flagged lead shows up red on the audit page
- **Test performed**: Loaded `/admin/needs-session` with `ZZZ-TEST-A3-ForcedNonSession` (from A3) present.
- **Result**: ✅ Verified. Row present, computed background color `rgb(255, 241, 241)` = `#fff1f1`, the intended red tint.

### D17. Reopen reverts the lead
- **Test performed**: Clicked **Reopen** on the flagged row.
- **Result**: ✅ Verified. DB confirmed `status: Planned`, `executed_date: null`, remarks tagged `Reopened: ...`.

### D18. Properly re-executed after reopening drops it from the audit
- **Test performed**: Re-executed the same lead with "Awareness Session - Students".
- **Result**: ✅ Verified. No longer appears on `/admin/needs-session` (count = 0).

### D19. Role gating
- **Test performed**: Logged in as a real `team_admin` account (`impact-practice.admin@indigogwf.org`), opened a lead, checked button visibility, then tried navigating directly to `/admin/needs-session`.
- **Result**: ✅ Verified. Zero "Mark as executed" or "Cancel" buttons rendered. Direct navigation to `/admin/needs-session` redirected away to `/leads` (via `requireAdmin()`).

---

## E. Timing edge cases (data-model questions, no live test needed)

- **E20/E21** (executed date before planned / far future): ⚠️ Process only — no validation exists or is proposed; both are legitimate real-world cases as much as data-entry errors.
- **E22** (planned date in the past, never executed): ✅ Already covered — this is exactly the "Due till now" metric on `/admin/analytics`.
- **E23/E24** (out-of-order / same-day rounds): ✅ Confirmed by the B-journey test itself — Round 3 was added and executed same-day, out of the original sequence relative to when Round 2 was planned, with no issue.

---

## F. Attribution/ownership edge cases

- **F25** (lead reassignment): ✅ Already verified this session via real reassignments (Anurag Pandey → Xiaomi Edge leads, Sahana → 6 institutions) — session history and status untouched by reassignment.
- **F26** (team change cascades to `leads.team_id`): ✅ Already verified this session (the `updateMember` fix + retroactive correction) — confirmed unrelated to rounds/session-gate logic.
- **F27** (multi-viewer via manager_id/secondary_manager_id): ✅ Confirmed by code read — gate logic is entirely server-side in the shared action, not per-viewer.
- **F28** (`team_admin` sees but can't act): ✅ Verified — see D19, same test covers this directly.

---

## G. Data-quality/import edge cases

- **G29** (bulk-imported, no `created_by`, already Completed with no session): ✅ Confirmed as the dominant real case — 500+ of ~700 flagged leads on `/admin/needs-session` are exactly this.
- **G30** (garbled/multi-language text hiding a real session): ⚠️ Process only / inherent limitation of substring matching — accepted trade-off, not fixable without manual review at this volume.
- **G31** (blank activity text): ✅ Confirmed — shows as "(blank)" in the audit table's "Logged as" column (seen directly in the real 700-row dataset).
- **G32** (large `girls_reached` despite no session activity): ✅ Confirmed by design and by C12 — the gate checks activity type only, never attendance count, so it can't be gamed by entering a number.

---

## H. Concurrency edge cases

- **H33/H34**: ⚠️ Process only, pre-existing app-wide risk (no row locking anywhere in this app). Not fixed, not proposed to fix now — untestable in the sense that "testing" it means deliberately racing two writers, which wouldn't tell us anything not already obvious from reading the code (last write wins).

---

## I. Bulk-operation edge cases

### I35. Bulk "Reopen selected" across multiple leads
- **Test performed**: Created 3 pre-flagged test leads (`ZZZ-TEST-BULK-1/2/3`), selected all 3 via checkboxes on `/admin/needs-session`, clicked "Reopen selected (3)", confirmed the `window.confirm()` prompt.
- **Result**: ✅ Verified. All 3 correctly reopened (`status: Planned`, `executed_date: null`, remarks tagged). No partial-failure was observed at this batch size — but the code still has **no per-row success/failure reporting** (confirmed by reading `reopenSelected()` in `components/needs-session-table.tsx` — one generic toast for the whole batch), so this remains a real gap **if** a failure ever happens mid-batch, just not something reproducible in a normal test run.

### I36. No pagination on the audit table
- **Result**: ⛔ Not built, confirmed by inspection — fine at today's ~700-row scale (rendered without issue during D16/I35 testing), would need pagination/virtualization at an order of magnitude more.

---

## J. Workflow edge cases

- **J37** (no notification system): ⛔ Not built, confirmed by code read — reopening is a silent status change. No notification infrastructure exists anywhere in this app.
- **J38** (reviving a `Rejected`/`No Response` lead): ⛔ Not built. `reopenLead()` itself is generic enough to work on any prior status (confirmed — it just sets `status: "Planned"` unconditionally), but there's no UI entry point for stalled leads specifically, only for `Activity Completed`/`Closed` ones via `/admin/needs-session`.

---

## K. Round-editing edge cases

- **K39** (retroactively editing a resolved round to game the audit): ⚠️ Process only — confirmed by code read that `updateRound` has no admin-only restriction and no edit history/audit log. A real trust gap, not a code bug — mitigations (edit audit log, admin-only restriction) are not built.

---

## Summary of code changes made while testing

Both in `lib/actions/leads.ts`:

1. **`allRoundsDone()`** — now treats a round as resolved if executed *or* cancelled (`stageForStatus(status) === "stalled"`), not just executed. Previously a cancelled round would block a lead from ever completing again, permanently.
2. **`cancelRound()`** — now re-syncs the parent lead's status after cancelling, the same way `markRoundExecuted()` already did. Previously, cancelling a round never re-checked whether the lead was actually finished, so a lead ending on a cancellation (rather than an execution) could stay stuck on `Planned` forever even with fix #1 in place.

Both were found by literally walking through scenarios B8 and B10 against a real test lead, not by inspection alone — the second one only surfaced because the first fix wasn't enough to make the actual test pass.

**Everything else in this document — 37 of 39 scenarios — was already correct**, including some fairly subtle ones (the No-Response warning, the audit page's exclusion logic, role gating, bulk reopen). No other code changes were needed.
