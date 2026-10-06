import { AppError } from "@codexsun/framework/errors";
import { frappeConnectionContract, frappeRequest } from "./frappe.service.js";
import type {
  FrappeConnectionCredentials,
  FrappeLiveStaffRequest,
  FrappeLiveStaffRequestComment,
  FrappeLiveStaffRequestGatewayFactory,
  FrappeLiveStaffRequestSavePayload
} from "./frappe.types.js";

const doctype = "Staff Request";
const fields = ["name", "employee", "request_type", "date", "days", "details", "creation", "modified"];

type StaffRequestDocument = {
  creation?: string;
  date?: string;
  days?: number | string;
  details?: string;
  employee?: string;
  modified?: string;
  name?: string;
  request_type?: string;
};

type CommentDocument = {
  content?: string;
  creation?: string;
  name?: string;
  owner?: string;
};

export const frappeLiveStaffRequestGatewayContract: FrappeLiveStaffRequestGatewayFactory = (
  context
) => {
  async function connection() {
    const value = await frappeConnectionContract({
      database: context.database,
      userId: context.userId
    }).get();
    if (!value?.enabled) throw AppError.conflict("Enable the Frappe connection before opening HR.");
    if (!value.authenticatedUser) {
      throw AppError.conflict(
        "This user's Frappe API credentials must be verified once before opening HR."
      );
    }
    return value;
  }

  async function requestComments(target: FrappeConnectionCredentials, names: string[]) {
    if (!names.length) return new Map<string, FrappeLiveStaffRequestComment[]>();
    const query = new URLSearchParams({
      fields: JSON.stringify(["name", "reference_name", "content", "owner", "creation"]),
      filters: JSON.stringify([
        ["reference_doctype", "=", doctype],
        ["reference_name", "in", names],
        ["comment_type", "=", "Comment"]
      ]),
      limit_page_length: "500",
      order_by: "creation asc"
    });
    const response = await frappeRequest<{ data?: Array<CommentDocument & { reference_name?: string }> }>(
      target,
      `/api/resource/Comment?${query}`
    );
    const comments = new Map<string, FrappeLiveStaffRequestComment[]>();
    for (const document of response.data ?? []) {
      const reference = document.reference_name?.trim();
      if (!reference) continue;
      const current = comments.get(reference) ?? [];
      current.push(toComment(document));
      comments.set(reference, current);
    }
    return comments;
  }

  async function hydrate(name: string, seed?: StaffRequestDocument) {
    const target = await connection();
    const document =
      seed ??
      (
        await frappeRequest<{ data?: StaffRequestDocument }>(
          target,
          `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(requiredName(name))}`
        )
      ).data;
    if (!document?.name) throw AppError.notFound("The Staff Request was not found in Frappe.");
    const comments = await requestComments(target, [document.name]);
    return toStaffRequest(document, comments.get(document.name) ?? []);
  }

  return {
    async addApprovalComment(name, content) {
      const target = await connection();
      const requestName = requiredName(name);
      await frappeRequest<{ data?: CommentDocument }>(target, "/api/resource/Comment", {
        body: JSON.stringify({
          comment_type: "Comment",
          content,
          reference_doctype: doctype,
          reference_name: requestName
        }),
        method: "POST"
      });
      return hydrate(requestName);
    },

    async create(employee, input) {
      const target = await connection();
      const response = await frappeRequest<{ data?: StaffRequestDocument }>(
        target,
        `/api/resource/${encodeURIComponent(doctype)}`,
        { body: JSON.stringify(toPayload(employee, input)), method: "POST" }
      );
      if (!response.data?.name) throw AppError.conflict("Frappe did not return the new Staff Request.");
      return hydrate(response.data.name, response.data);
    },

    async get(name) {
      return hydrate(name);
    },

    async list(input) {
      const target = await connection();
      const filters = input.employee ? [["employee", "=", input.employee]] : [];
      const requests: StaffRequestDocument[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const query = new URLSearchParams({
          fields: JSON.stringify(fields),
          filters: JSON.stringify(filters),
          limit_page_length: "500",
          limit_start: String(offset),
          order_by: "creation desc"
        });
        const response = await frappeRequest<{ data?: StaffRequestDocument[] }>(
          target,
          `/api/resource/${encodeURIComponent(doctype)}?${query}`
        );
        const page = response.data ?? [];
        requests.push(...page);
        hasMore = page.length === 500;
        offset += page.length;
      }
      const names = requests.flatMap((request) => (request.name ? [request.name] : []));
      const comments = await requestComments(target, names);
      return requests
        .filter((request): request is StaffRequestDocument & { name: string } => Boolean(request.name))
        .map((request) => toStaffRequest(request, comments.get(request.name) ?? []));
    },

    async update(name, employee, input) {
      const target = await connection();
      const requestName = requiredName(name);
      const response = await frappeRequest<{ data?: StaffRequestDocument }>(
        target,
        `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(requestName)}`,
        { body: JSON.stringify(toPayload(employee, input)), method: "PUT" }
      );
      return hydrate(requestName, response.data);
    }
  };
};

function requiredName(value: string) {
  const name = value.trim();
  if (!name) throw AppError.validation("A Staff Request name is required.");
  return name;
}

function toPayload(employee: string, input: FrappeLiveStaffRequestSavePayload) {
  return {
    date: input.date,
    days: input.days,
    details: input.details,
    employee,
    request_type: input.requestType
  };
}

function toStaffRequest(
  document: StaffRequestDocument,
  comments: FrappeLiveStaffRequestComment[]
): FrappeLiveStaffRequest {
  const name = document.name?.trim();
  const employee = document.employee?.trim();
  const requestType = document.request_type?.trim();
  const date = document.date?.slice(0, 10);
  if (!name || !employee || !requestType || !date) {
    throw AppError.conflict("Frappe returned an incomplete Staff Request.");
  }
  return {
    comments,
    createdAt: timestamp(document.creation),
    date,
    days: Number(document.days ?? 0),
    details: document.details?.trim() ?? "",
    employee,
    modifiedAt: timestamp(document.modified),
    name,
    requestType
  };
}

function toComment(document: CommentDocument): FrappeLiveStaffRequestComment {
  return {
    content: document.content?.trim() ?? "",
    createdAt: timestamp(document.creation),
    createdBy: document.owner?.trim() ?? "Unknown",
    name: document.name?.trim() ?? "comment"
  };
}

function timestamp(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
