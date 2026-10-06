import assert from "node:assert/strict";
import test from "node:test";
import { enquiryPropertyPayload } from "../src/modules/crm/crm.property-payload.ts";
import type { CrmEnquiry } from "../src/modules/crm/crm.types.ts";

const record = {
  assignedToUserId: "EMP-1",
  customer: "CUSTOMER-1",
  enquiryDate: "2026-09-01",
  enquiryGroup: "Service",
  messages: [
    { comment: "", id: "message-1" },
    { comment: "Call book", id: "message-2" }
  ],
  mobile: "9000000000",
  priority: "normal",
  schedules: [{ scheduledOn: "2026-09-03" }],
  status: "new",
  statusDetails: "Existing status details",
  title: "Service",
  workspace: "Call request"
} as CrmEnquiry;

test("New to Closed does not resubmit blank historical comments", () => {
  const before = structuredClone(record);
  const payload = enquiryPropertyPayload(record, { status: "closed" });

  assert.equal(payload.status, "closed");
  assert.equal(payload.messages.length, 0);
  assert.equal(payload.statusDetails, record.statusDetails);
  assert.deepEqual(record, before);
});

test("property edits do not resubmit oversized comment history", () => {
  const withHistory = {
    ...record,
    messages: Array.from({ length: 101 }, () => ({
      ...record.messages[0]!,
      comment: "x".repeat(10_001)
    }))
  };
  const payload = enquiryPropertyPayload(withHistory, { priority: "high" });

  assert.equal(payload.messages.length, 0);
  assert.equal(payload.priority, "high");
  assert.equal(payload.status, "new");
  assert.equal(payload.assignedToUserId, record.assignedToUserId);
  assert.deepEqual(payload.schedules, [{ scheduledOn: "2026-09-03" }]);
});

test("property edits preserve the selected live status without pairing it", () => {
  for (const status of ["won", "lost", "hold-for-approval", "reopen"]) {
    assert.equal(enquiryPropertyPayload(record, { status }).status, status);
  }
  const payload = enquiryPropertyPayload(record, {
    assignedToUserId: null,
    enquiryGroup: "Follow"
  });
  assert.equal(payload.assignedToUserId, null);
  assert.equal(payload.enquiryGroup, "Follow");
});

test("schedule date edits replace the live enquiry schedule", () => {
  const payload = enquiryPropertyPayload(record, {
    schedules: [{ scheduledOn: "2026-09-22" }]
  });

  assert.deepEqual(payload.schedules, [{ scheduledOn: "2026-09-22" }]);
  assert.equal(payload.enquiryDate, record.enquiryDate);
});
