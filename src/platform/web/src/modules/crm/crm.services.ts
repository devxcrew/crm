import { apiDelete, apiGet, apiPost, apiPut } from "../../shared/api/platform-api";
import type {
  CrmCustomerReference,
  CrmEnquiry,
  CrmEnquiryAttachmentCreatePayload,
  CrmEnquiryCallCreatePayload,
  CrmEnquiryEmailCreatePayload,
  CrmEnquiryMessageCreatePayload,
  CrmEnquiryMobileMatch,
  CrmEnquiryNoteCreatePayload,
  CrmEnquiryOverview,
  CrmEnquiryOptions,
  CrmEnquiryPriority,
  CrmReport,
  CrmReportName,
  CrmEnquiryReference,
  CrmEnquirySavePayload,
  CrmEnquiryStatusFilter,
  CrmEnquiryTaskCreatePayload,
  CrmEnquiryView,
  CrmJobSavePayload,
  CrmUserReference
} from "./crm.types";

const path = "/crm/enquiries";

export function listCrmEnquiries(input: {
  assignedToEmployee?: string;
  createdByEmployee?: string;
  enquiryId?: string;
  enquiryGroup?: string;
  fromDate?: string;
  priority?: CrmEnquiryPriority;
  search?: string;
  status?: CrmEnquiryStatusFilter;
  toDate?: string;
  view: CrmEnquiryView;
}) {
  const query = new URLSearchParams({ view: input.view });
  if (input.assignedToEmployee) query.set("assignedToEmployee", input.assignedToEmployee);
  if (input.createdByEmployee) query.set("createdByEmployee", input.createdByEmployee);
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.enquiryId) query.set("enquiryId", String(input.enquiryId));
  if (input.enquiryGroup) query.set("enquiryGroup", input.enquiryGroup);
  if (input.fromDate) query.set("fromDate", input.fromDate);
  if (input.priority) query.set("priority", input.priority);
  if (input.status) query.set("status", input.status);
  if (input.toDate) query.set("toDate", input.toDate);
  return apiGet<CrmEnquiry[]>(`${path}?${query}`);
}

export function getCrmEnquiryOverview() {
  return apiGet<CrmEnquiryOverview>(`${path}/overview`);
}

export function getCrmEnquiryOptions() {
  return apiGet<CrmEnquiryOptions>(`${path}/options`);
}

export function getCrmReport(
  name: CrmReportName,
  filters: { assignedToEmployee?: string; fromDate?: string; group?: string; toDate?: string }
) {
  const query = new URLSearchParams();
  if (filters.fromDate) query.set("fromDate", filters.fromDate);
  if (filters.toDate) query.set("toDate", filters.toDate);
  if (filters.assignedToEmployee) query.set("assignedToEmployee", filters.assignedToEmployee);
  if (filters.group) query.set("group", filters.group);
  const suffix = query.size ? `?${query}` : "";
  return apiGet<CrmReport>(`${path}/reports/${name}${suffix}`);
}

export function getCrmContributorsReport(filters: { fromDate?: string; toDate?: string }) {
  return getCrmReportRows<import("./crm.types").CrmContributorReportRow>("contributors", filters);
}

export function getCrmStatusReport(filters: { fromDate?: string; toDate?: string }) {
  return getCrmReportRows<import("./crm.types").CrmStatusReportRow>("status", filters);
}

function getCrmReportRows<T>(
  name: "contributors" | "status",
  filters: { fromDate?: string; toDate?: string }
) {
  const query = new URLSearchParams();
  if (filters.fromDate) query.set("fromDate", filters.fromDate);
  if (filters.toDate) query.set("toDate", filters.toDate);
  const suffix = query.size ? `?${query}` : "";
  return apiGet<T[]>(`${path}/reports/${name}${suffix}`);
}

export function getCrmEnquiry(name: string) {
  return apiGet<CrmEnquiry>(`${path}/${encodeURIComponent(name)}`);
}

export function receiveCrmEnquiryAssignment(name: string) {
  return apiPost<CrmEnquiry>(`${path}/${encodeURIComponent(name)}/assignment-receipt`, {});
}

export function listCrmEnquiryMobileMatches(mobile: string) {
  const query = new URLSearchParams({ mobile });
  return apiGet<CrmEnquiryMobileMatch[]>(`${path}/mobile-matches?${query}`);
}

export function createCrmEnquiry(payload: CrmEnquirySavePayload) {
  return apiPost<CrmEnquiry>(path, payload);
}

export function updateCrmEnquiry(id: string, payload: CrmEnquirySavePayload) {
  return apiPut<CrmEnquiry>(`${path}/${id}`, payload);
}

export function suspendCrmEnquiry(id: string) {
  return apiPost<CrmEnquiry>(`${path}/${id}/suspend`, {});
}

export function restoreCrmEnquiry(id: string) {
  return apiPost<CrmEnquiry>(`${path}/${id}/restore`, {});
}

export function forceDeleteCrmEnquiry(id: string) {
  return apiDelete<CrmEnquiry>(`${path}/${id}/force`);
}

export function addCrmEnquiryMessage(id: string, payload: CrmEnquiryMessageCreatePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/messages`, payload);
}

export function suspendCrmEnquiryMessage(id: string, messageId: string) {
  return apiPost<CrmEnquiry>(`${path}/${id}/messages/${messageId}/suspend`, {});
}

export function startCrmEnquiryJob(id: string) {
  return apiPost<CrmEnquiry>(`${path}/${id}/jobs/start`, {});
}

export function stopCrmEnquiryJob(id: string, jobName: string) {
  return apiPost<CrmEnquiry>(`${path}/${id}/jobs/${encodeURIComponent(jobName)}/stop`, {});
}

export function createCrmEnquiryJob(id: string, payload: CrmJobSavePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/jobs`, payload);
}

export function updateCrmEnquiryJob(id: string, jobName: string, payload: CrmJobSavePayload) {
  return apiPut<CrmEnquiry>(`${path}/${id}/jobs/${encodeURIComponent(jobName)}`, payload);
}

export function addCrmEnquiryEmail(id: string, payload: CrmEnquiryEmailCreatePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/emails`, payload);
}

export function addCrmEnquiryCall(id: string, payload: CrmEnquiryCallCreatePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/calls`, payload);
}

export function addCrmEnquiryTask(id: string, payload: CrmEnquiryTaskCreatePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/tasks`, payload);
}

export function addCrmEnquiryNote(id: string, payload: CrmEnquiryNoteCreatePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/notes`, payload);
}

export function addCrmEnquiryAttachment(id: string, payload: CrmEnquiryAttachmentCreatePayload) {
  return apiPost<CrmEnquiry>(`${path}/${id}/attachments`, payload);
}

export function listCrmUserReferences() {
  return apiGet<CrmUserReference[]>(`${path}/user-references`);
}

export function listCrmCustomerReferences(search = "") {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  const suffix = query.size ? `?${query}` : "";
  return apiGet<CrmCustomerReference[]>(`${path}/customer-references${suffix}`);
}

export function listCrmEnquiryReferences() {
  return apiGet<CrmEnquiryReference[]>(`${path}/references`);
}
