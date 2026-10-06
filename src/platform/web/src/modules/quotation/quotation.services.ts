import { apiGet, apiPost, apiPut } from "../../shared/api/platform-api";
import type { Quotation, QuotationReferences, QuotationSavePayload } from "./quotation.types";

const path = "/quotations";

function enquiryQuery(enquiry: string) {
  return new URLSearchParams({ enquiry }).toString();
}

export function listQuotations(enquiry: string) {
  return apiGet<Quotation[]>(`${path}?${enquiryQuery(enquiry)}`);
}

export function listQuotationReferences() {
  return apiGet<QuotationReferences>(`${path}/references`);
}

export function getQuotation(name: string, enquiry: string) {
  return apiGet<Quotation>(`${path}/${encodeURIComponent(name)}?${enquiryQuery(enquiry)}`);
}

export function createQuotation(enquiry: string, payload: QuotationSavePayload) {
  return apiPost<Quotation>(`${path}?${enquiryQuery(enquiry)}`, payload);
}

export function updateQuotation(name: string, enquiry: string, payload: QuotationSavePayload) {
  return apiPut<Quotation>(`${path}/${encodeURIComponent(name)}?${enquiryQuery(enquiry)}`, payload);
}
