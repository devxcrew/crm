# Live Frappe Request Handling

## Scope

CRM reads and writes CRM, Estimate, Quotation, iShop, and Frappe reference data through live
Frappe requests. It does not store Frappe business records locally.

## Shared transport

Use `frappeRequest` in `src/platform/api/src/modules/frappe/frappe.service.ts` for every normal
Frappe API request. Do not add module-specific `fetch` calls for Frappe business data.

The helper sends the signed-in user's verified Frappe credentials. It reads the complete response
before it parses JSON. Do not truncate the response text before parsing it.

Large list responses can exceed 64 KB. Truncating them produces invalid JSON and can make a valid
Frappe response look like an empty result. This previously caused My Calls to show no enquiries.

## Connection handshake

The authentication handshake has a separate 64 KB limit. It only reads a small username response.
Keep that limit because it does not apply to Frappe business data.

## Troubleshooting an empty list

1. Run the equivalent Frappe request with the signed-in user's saved credential.
2. Confirm the employee code and request filter.
3. Check the response status and returned record count.
4. Check that the shared transport parses the complete response.
5. Check the module status filter only after the transport returns records.
