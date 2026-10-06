import { crmEnquiryStatusOptions } from "./crm.options";
import type { CrmEnquiry, CrmEnquiryStatusFilter } from "./crm.types";

export type CrmEnquiryListFilter = CrmEnquiryStatusFilter | "unassigned";

export function buildCrmEnquiryListFilters(
  statuses: Array<{ label: string; value: string }> = crmEnquiryStatusOptions
): Array<{ id: CrmEnquiryListFilter; label: string }> {
  return [
    { id: "all", label: "All calls" },
    { id: "unassigned", label: "Unassigned" },
    { id: "active", label: "Active" },
    { id: "hold", label: "Hold" },
    { id: "other", label: "New group" },
    { id: "in-progress", label: "In progress" },
    { id: "closed", label: "Closed" },
    ...statuses.map(({ label, value }) => ({ id: value, label }))
  ];
}

export const crmEnquiryListFilters = buildCrmEnquiryListFilters();

export function enquiryFilterFromUrl(): CrmEnquiryListFilter {
  if (typeof window === "undefined") return "all";
  const value = new URLSearchParams(window.location.search).get("status");
  return crmEnquiryListFilters.some((filter) => filter.id === value)
    ? (value as CrmEnquiryListFilter)
    : "all";
}

export function matchesEnquiryFilter(record: CrmEnquiry, filter: CrmEnquiryListFilter) {
  return filter === "unassigned" ? !record.assignedTo : matchesStatusFilter(record, filter);
}

export function countEnquiriesForFilter(records: CrmEnquiry[], filter: CrmEnquiryListFilter) {
  return records.filter((record) => matchesEnquiryFilter(record, filter)).length;
}

function matchesStatusFilter(record: CrmEnquiry, filter: CrmEnquiryStatusFilter) {
  if (filter === "all") return true;
  if (filter === "active") return record.statusGroup !== "closed";
  if (filter === "closed") return record.statusGroup === "closed";
  if (filter === "hold") return record.statusGroup === "hold";
  if (filter === "in-progress")
    return record.statusGroup === "hold" || record.statusGroup === "pending";
  if (filter === "other") return record.statusGroup === "new";
  return record.status === filter;
}
