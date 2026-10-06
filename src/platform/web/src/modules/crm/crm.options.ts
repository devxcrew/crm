import type { CrmEnquiryStatus } from "./crm.types";
import { useCrmOptionsQuery } from "./crm.hooks";

export const crmEnquiryListInOptions = [
  "Stores",
  "DELL",
  "ASUS",
  "Spares",
  "MBO",
  "Service",
  "On-site",
  "Remote - AnyDesk",
  "Follow",
  "LogicX",
  "Admin"
].map((value) => ({ label: value, value }));

export const crmEnquiryStatusOptions = [
  { label: "New", value: "new" },
  { label: "Open", value: "open" },
  { label: "Hold for Approval", value: "hold-for-approval" },
  { label: "Hold for Spares", value: "hold-for-spares" },
  { label: "Hold for Job-Out", value: "hold-for-job-out" },
  { label: "Long Hold", value: "long-hold" },
  { label: "Escalation", value: "escalation" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
  { label: "Re-open", value: "reopen" }
] satisfies Array<{ label: string; value: CrmEnquiryStatus }>;

export function useCrmOptionLists() {
  const query = useCrmOptionsQuery();
  return {
    groups: query.data?.groups ?? crmEnquiryListInOptions,
    statuses: query.data?.statuses ?? crmEnquiryStatusOptions
  };
}
