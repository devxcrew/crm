import type { CrmEnquiry, CrmEnquirySavePayload } from "./crm.types";

export function enquiryPropertyPayload(
  record: CrmEnquiry,
  patch: Partial<
    Pick<
      CrmEnquirySavePayload,
      "assignedToUserId" | "enquiryGroup" | "priority" | "schedules" | "status"
    >
  >
): CrmEnquirySavePayload {
  return {
    assignedToUserId: record.assignedToUserId,
    customer: record.customer,
    enquiryDate: record.enquiryDate,
    enquiryGroup: record.enquiryGroup,
    // The update gateway preserves comments; their dedicated endpoint owns message changes.
    messages: [],
    mobile: record.mobile,
    priority: record.priority,
    schedules: record.schedules.map(({ scheduledOn }) => ({ scheduledOn })),
    status: record.status,
    statusDetails: record.statusDetails,
    title: record.title,
    workspace: record.workspace,
    ...patch
  };
}
