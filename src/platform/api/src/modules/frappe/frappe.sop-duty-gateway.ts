import { AppError } from "@codexsun/framework/errors";
import { frappeConnectionContract, frappeRequest } from "./frappe.service.js";
import type {
  FrappeConnectionCredentials,
  FrappeLiveSopDuty,
  FrappeLiveSopDutyGatewayFactory,
  FrappeLiveSopReport
} from "./frappe.types.js";

const assignmentDoctype = "SOP Assigned";
const itemDoctype = "SOP Item";
const reportingDoctype = "SOP Reporting";

type AssignmentDocument = { index?: number | string; sop_item?: string };
type ItemDocument = {
  department?: string;
  frequency?: string;
  name?: string;
  sop_name?: string;
  steps?: string;
};
type ReportingDocument = {
  actions?: string;
  creation?: string;
  date?: string;
  name?: string;
  sop_item?: string;
};

export const frappeLiveSopDutyGatewayContract: FrappeLiveSopDutyGatewayFactory = (context) => {
  async function connection() {
    const value = await frappeConnectionContract({
      database: context.database,
      userId: context.userId
    }).get();
    if (!value?.enabled)
      throw AppError.conflict("Enable the Frappe connection before opening Duties.");
    if (!value.authenticatedUser) {
      throw AppError.conflict(
        "This user's Frappe API credentials must be verified once before opening Duties."
      );
    }
    return value;
  }

  return {
    async createReport(input) {
      const target = await connection();
      const response = await frappeRequest<{ data?: ReportingDocument }>(
        target,
        `/api/resource/${encodeURIComponent(reportingDoctype)}`,
        {
          body: JSON.stringify({
            actions: input.actions.trim(),
            date: localDate(),
            sop_item: requiredName(input.sopItem),
            user: requiredName(contextEmployee(context))
          }),
          method: "POST"
        }
      );
      if (!response.data?.name) throw AppError.conflict("Frappe did not return the SOP report.");
      return toReport(response.data);
    },

    async list(employee) {
      const target = await connection();
      const assignments = await listDocuments<AssignmentDocument>(
        target,
        assignmentDoctype,
        ["sop_item", "index"],
        [["user", "=", requiredName(employee)]]
      );
      const sopItems = [
        ...new Set(assignments.map((assignment) => assignment.sop_item?.trim()).filter(Boolean))
      ];
      if (!sopItems.length) return [];

      const [items, reports] = await Promise.all([
        listDocuments<ItemDocument>(
          target,
          itemDoctype,
          ["name", "sop_name", "department", "frequency", "steps"],
          [["name", "in", sopItems]]
        ),
        listDocuments<ReportingDocument>(
          target,
          reportingDoctype,
          ["name", "sop_item", "date", "actions", "creation"],
          [
            ["user", "=", requiredName(employee)],
            ["sop_item", "in", sopItems]
          ]
        )
      ]);
      const itemByName = new Map(
        items.flatMap((item) => (item.name?.trim() ? [[item.name.trim(), item]] : []))
      );
      const reportsByItem = new Map<string, FrappeLiveSopReport[]>();
      for (const report of reports) {
        const sopItem = report.sop_item?.trim();
        if (!sopItem) continue;
        reportsByItem.set(sopItem, [...(reportsByItem.get(sopItem) ?? []), toReport(report)]);
      }
      return assignments
        .flatMap((assignment) => {
          const sopItem = assignment.sop_item?.trim();
          const item = sopItem ? itemByName.get(sopItem) : undefined;
          if (!sopItem || !item) return [];
          return [
            {
              department: item.department?.trim() ?? "",
              frequency: frequency(item.frequency),
              index: Number(assignment.index ?? 0),
              reports: (reportsByItem.get(sopItem) ?? []).sort((left, right) =>
                right.createdAt.localeCompare(left.createdAt)
              ),
              sopItem,
              sopName: item.sop_name?.trim() || sopItem,
              steps: item.steps?.trim() ?? ""
            }
          ];
        })
        .sort(
          (left, right) => left.index - right.index || left.sopName.localeCompare(right.sopName)
        );
    }
  };
};

async function listDocuments<T>(
  connection: FrappeConnectionCredentials,
  doctype: string,
  fields: string[],
  filters: unknown[]
) {
  const query = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    limit_page_length: "500",
    order_by: "creation desc"
  });
  const response = await frappeRequest<{ data?: T[] }>(
    connection,
    `/api/resource/${encodeURIComponent(doctype)}?${query}`
  );
  return response.data ?? [];
}

function contextEmployee(context: { employee?: string | null }) {
  return context.employee?.trim() ?? "";
}

function requiredName(value: string) {
  const name = value.trim();
  if (!name)
    throw AppError.conflict(
      "The signed-in Frappe user must be linked to an Employee before using Duties."
    );
  return name;
}

function frequency(value?: string): FrappeLiveSopDuty["frequency"] {
  return value === "Weekly" || value === "Monthly" || value === "Yearly" ? value : "Daily";
}

function toReport(document: ReportingDocument): FrappeLiveSopReport {
  return {
    actions: plainText(document.actions ?? ""),
    createdAt: timestamp(document.creation),
    date: document.date?.slice(0, 10) ?? localDate(),
    name: document.name?.trim() ?? "SOP report"
  };
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<\/(?:div|li|p)>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function timestamp(value?: string) {
  const normalized = value?.includes("T") ? value : value?.replace(" ", "T");
  const date = normalized ? new Date(`${normalized}+05:30`) : new Date();
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
