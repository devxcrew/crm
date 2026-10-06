import { useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Card, CardContent } from "@codexsun/ui/components/card";
import { WorkspaceDatePicker } from "@codexsun/ui/workspace/date-picker";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import {
  useCrmContributorsReportQuery,
  useCrmReportQuery,
  useCrmStatusReportQuery,
  useCrmUsersQuery
} from "./crm.hooks";
import { useCrmOptionLists } from "./crm.options";
import type {
  CrmEnquiryStatusFilter,
  CrmReport,
  CrmReportName,
  CrmUserReference
} from "./crm.types";

type Filters = { assignedToEmployee: string; fromDate: string; group: string; toDate: string };
type ReportTab = CrmReportName | "contributors" | "status";
type EnquiryDestination = {
  assignedToEmployee?: string;
  createdByEmployee?: string;
  enquiryGroup?: string;
  fromDate?: string;
  status: CrmEnquiryStatusFilter;
  toDate?: string;
};
const emptyFilters: Filters = { assignedToEmployee: "", fromDate: "", group: "", toDate: "" };

export function CrmReports({
  onOpenEnquiries
}: {
  onOpenEnquiries: (filters: EnquiryDestination) => void;
}) {
  const [reportTab, setReportTab] = useState<ReportTab>("list-in-status");
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const matrixReport = reportTab === "list-in-status" || reportTab === "owner-status";
  const report = reportTab === "owner-status" ? "owner-status" : "list-in-status";
  const matrixQuery = useCrmReportQuery(report, filters, matrixReport);
  const contributorsQuery = useCrmContributorsReportQuery(filters, reportTab === "contributors");
  const statusQuery = useCrmStatusReportQuery(filters, reportTab === "status");
  const users = useCrmUsersQuery();
  const crmOptions = useCrmOptionLists();
  const isFetching =
    matrixQuery.isFetching || contributorsQuery.isFetching || statusQuery.isFetching;
  const resetFilters = () => {
    setDraft({ ...emptyFilters });
    setFilters({ ...emptyFilters });
  };
  const refresh = () => {
    if (matrixReport) void matrixQuery.refetch();
    if (reportTab === "contributors") void contributorsQuery.refetch();
    if (reportTab === "status") void statusQuery.refetch();
  };
  return (
    <WorkspacePage
      actions={
        <Button disabled={isFetching} onClick={refresh} type="button" variant="outline">
          <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} /> Refresh
        </Button>
      }
      description="Live enquiry reports from Frappe. Select a count to open its related enquiries."
      technicalName="page.crm.reports"
      title="Enquiry reports"
    >
      <div className="flex flex-wrap gap-2">
        <ReportButton
          active={reportTab === "list-in-status"}
          onClick={() => setReportTab("list-in-status")}
        >
          List-In wise status
        </ReportButton>
        <ReportButton
          active={reportTab === "owner-status"}
          onClick={() => setReportTab("owner-status")}
        >
          Owner wise status
        </ReportButton>
        <ReportButton
          active={reportTab === "contributors"}
          onClick={() => setReportTab("contributors")}
        >
          Contributors
        </ReportButton>
        <ReportButton active={reportTab === "status"} onClick={() => setReportTab("status")}>
          Status
        </ReportButton>
      </div>
      <Card className="shadow-sm">
        <CardContent className="flex min-w-0 gap-3 overflow-x-auto p-4">
          <DateFilters draft={draft} onChange={setDraft} />
          {matrixReport ? (
            report === "list-in-status" ? (
              <WorkspaceLookup
                allowTextValue={false}
                className="min-w-64 flex-1"
                loading={users.isFetching}
                onValueChange={(assignedToEmployee) =>
                  setDraft((value) => ({ ...value, assignedToEmployee }))
                }
                options={(users.data ?? []).map((user) => ({
                  description: user.email,
                  label: user.name,
                  value: user.id
                }))}
                placeholder="Assigned to"
                showAllOptionsOnFocus
                value={draft.assignedToEmployee}
              />
            ) : (
              <WorkspaceLookup
                allowTextValue={false}
                className="min-w-64 flex-1"
                onValueChange={(group) => setDraft((value) => ({ ...value, group }))}
                options={crmOptions.groups}
                placeholder="List in"
                showAllOptionsOnFocus
                value={draft.group}
              />
            )
          ) : (
            <div className="min-w-64 flex-1" />
          )}
          <Button className="shrink-0" onClick={() => setFilters(draft)} type="button">
            Apply filters
          </Button>
          <Button className="shrink-0" onClick={resetFilters} type="button" variant="outline">
            <RotateCcw className="size-4" /> Reset
          </Button>
        </CardContent>
      </Card>
      {matrixReport ? (
        <MatrixReport
          query={matrixQuery}
          report={report}
          filters={filters}
          users={users.data ?? []}
          onOpenEnquiries={onOpenEnquiries}
        />
      ) : null}
      {reportTab === "contributors" ? (
        <ContributorsReport
          query={contributorsQuery}
          filters={filters}
          onOpenEnquiries={onOpenEnquiries}
        />
      ) : null}
      {reportTab === "status" ? (
        <StatusReport query={statusQuery} filters={filters} onOpenEnquiries={onOpenEnquiries} />
      ) : null}
    </WorkspacePage>
  );
}

function ReportButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick} type="button" variant={active ? "default" : "outline"}>
      {children}
    </Button>
  );
}
function DateFilters({
  draft,
  onChange
}: {
  draft: Filters;
  onChange: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  return (
    <>
      <div className="min-w-44">
        <WorkspaceDatePicker
          ariaLabel="From date"
          onValueChange={(fromDate) => onChange((value) => ({ ...value, fromDate }))}
          placeholder="From date"
          value={draft.fromDate}
        />
      </div>
      <div className="min-w-44">
        <WorkspaceDatePicker
          ariaLabel="To date"
          onValueChange={(toDate) => onChange((value) => ({ ...value, toDate }))}
          placeholder="To date"
          value={draft.toDate}
        />
      </div>
    </>
  );
}
function MatrixReport({
  filters,
  onOpenEnquiries,
  query,
  report,
  users
}: {
  filters: Filters;
  onOpenEnquiries: (filters: EnquiryDestination) => void;
  query: ReturnType<typeof useCrmReportQuery>;
  report: CrmReportName;
  users: CrmUserReference[];
}) {
  if (query.isError) return <ReportError error={query.error} />;
  return query.data ? (
    <ReportTable
      appliedFilters={filters}
      onOpenEnquiries={onOpenEnquiries}
      report={query.data}
      reportName={report}
      users={users}
    />
  ) : null;
}
function ContributorsReport({
  filters,
  onOpenEnquiries,
  query
}: {
  filters: Filters;
  onOpenEnquiries: (filters: EnquiryDestination) => void;
  query: ReturnType<typeof useCrmContributorsReportQuery>;
}) {
  if (query.isError) return <ReportError error={query.error} />;
  return query.data ? (
    <SummaryTable
      heading="Created by"
      rows={query.data.map((row) => ({
        count: row.count,
        label: row.name,
        onOpen: () =>
          onOpenEnquiries(withDates(filters, { createdByEmployee: row.employee, status: "all" }))
      }))}
    />
  ) : null;
}
function StatusReport({
  filters,
  onOpenEnquiries,
  query
}: {
  filters: Filters;
  onOpenEnquiries: (filters: EnquiryDestination) => void;
  query: ReturnType<typeof useCrmStatusReportQuery>;
}) {
  if (query.isError) return <ReportError error={query.error} />;
  return query.data ? (
    <SummaryTable
      heading="Status"
      rows={query.data.map((row) => ({
        count: row.count,
        label: statusLabel(row.status),
        onOpen: () => onOpenEnquiries(withDates(filters, { status: row.status }))
      }))}
    />
  ) : null;
}
function ReportError({ error }: { error: unknown }) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "The Frappe report could not be loaded."}
      </CardContent>
    </Card>
  );
}
function SummaryTable({
  heading,
  rows
}: {
  heading: string;
  rows: Array<{ count: number; label: string; onOpen: () => void }>;
}) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="overflow-x-auto p-3">
        <table className="w-full min-w-max border-collapse border border-border text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              <th className="border border-border px-4 py-3 text-left font-medium">{heading}</th>
              <th className="border border-border px-4 py-3 text-right font-medium">Enquiries</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border border-border px-4 py-3">{row.label}</td>
                <td className="border border-border px-4 py-3 text-right">
                  {row.count ? (
                    <button
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={row.onOpen}
                      type="button"
                    >
                      {row.count}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  className="border border-border px-4 py-8 text-center text-muted-foreground"
                  colSpan={2}
                >
                  No enquiries match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
function withDates(filters: Filters, destination: EnquiryDestination): EnquiryDestination {
  return {
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...destination,
    ...(filters.toDate ? { toDate: filters.toDate } : {})
  };
}
function ReportTable({
  appliedFilters,
  onOpenEnquiries,
  report,
  reportName,
  users
}: {
  appliedFilters: Filters;
  onOpenEnquiries: (filters: EnquiryDestination) => void;
  report: CrmReport;
  reportName: CrmReportName;
  users: CrmUserReference[];
}) {
  const [sort, setSort] = useState<{ direction: "asc" | "desc"; fieldname: string } | null>(null);
  const totalRows = report.rows.filter(isTotalRow);
  const rows = report.rows
    .filter((row) => !isTotalRow(row))
    .sort((left, right) => compareRows(left, right, sort));
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="overflow-x-auto p-3">
        <table className="w-full min-w-max border-collapse border border-border text-sm">
          <thead className="bg-muted/70 text-center text-muted-foreground">
            <tr>
              <th className="border border-border px-2 py-3 font-medium">#</th>
              {report.columns.map((column) => (
                <th
                  className={`border border-border px-4 py-3 font-medium ${isIdentityColumn(column.label) ? "text-left" : ""}`}
                  key={column.fieldname}
                >
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() =>
                      setSort((current) => ({
                        direction:
                          current?.fieldname === column.fieldname && current.direction === "asc"
                            ? "desc"
                            : "asc",
                        fieldname: column.fieldname
                      }))
                    }
                    type="button"
                  >
                    {column.label}
                    {sort?.fieldname === column.fieldname ? (
                      sort.direction === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows, ...totalRows].map((row, index) => (
              <tr className={isTotalRow(row) ? "bg-muted/70 font-medium" : undefined} key={index}>
                <td className="border border-border px-2 py-3 text-center text-muted-foreground">
                  {isTotalRow(row) ? "" : index + 1}
                </td>
                {report.columns.map((column) => (
                  <td
                    className={`border border-border px-4 py-3 text-center ${isIdentityColumn(column.label) ? "text-left" : ""}`}
                    key={column.fieldname}
                  >
                    <MatrixValue
                      appliedFilters={appliedFilters}
                      column={column}
                      onOpenEnquiries={onOpenEnquiries}
                      report={report}
                      reportName={reportName}
                      row={row}
                      users={users}
                    />
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  className="border border-border px-4 py-8 text-center text-muted-foreground"
                  colSpan={Math.max(report.columns.length + 1, 1)}
                >
                  No report rows match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
function MatrixValue({
  appliedFilters,
  column,
  onOpenEnquiries,
  report,
  reportName,
  row,
  users
}: {
  appliedFilters: Filters;
  column: CrmReport["columns"][number];
  onOpenEnquiries: (filters: EnquiryDestination) => void;
  report: CrmReport;
  reportName: CrmReportName;
  row: Record<string, number | string | null>;
  users: CrmUserReference[];
}) {
  const value = row[column.fieldname];
  const status = reportStatusFilter(column.label);
  const identity = report.columns.find((candidate) => isIdentityColumn(candidate.label));
  const identityValue = identity ? String(row[identity.fieldname] ?? "") : "";
  if (typeof value !== "number" || value <= 0 || !status) return value ?? "—";
  const scopedRow = !isTotalRow(row);
  const destination = withDates(appliedFilters, {
    ...(reportName === "list-in-status" && identityValue && scopedRow
      ? { enquiryGroup: identityValue }
      : {}),
    ...(reportName === "owner-status" && scopedRow
      ? { assignedToEmployee: employeeIdForReport(identityValue, users) }
      : {}),
    status
  });
  return (
    <button
      className="font-medium text-primary underline-offset-2 hover:underline"
      onClick={() => onOpenEnquiries(destination)}
      type="button"
    >
      {value}
    </button>
  );
}
function employeeIdForReport(value: string, users: CrmUserReference[]) {
  return value.trim().toLowerCase() === "(unassigned)"
    ? "__unassigned__"
    : (users.find((user) => user.name === value)?.id ?? value);
}
function statusLabel(value: string) {
  return value.replace(/-/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
function reportStatusFilter(label: string): CrmEnquiryStatusFilter | null {
  const filters: Record<string, CrmEnquiryStatusFilter> = {
    hold: "hold",
    "hold for approval": "hold-for-approval",
    "hold for job-out": "hold-for-job-out",
    "hold for spares": "hold-for-spares",
    "in progress": "in-progress",
    "long hold": "long-hold",
    lost: "lost",
    new: "new",
    open: "open",
    other: "other",
    "re-open": "reopen",
    total: "all",
    won: "won"
  };
  return filters[label.trim().toLowerCase()] ?? null;
}
function compareRows(
  left: Record<string, number | string | null>,
  right: Record<string, number | string | null>,
  sort: { direction: "asc" | "desc"; fieldname: string } | null
) {
  if (!sort) return 0;
  const a = left[sort.fieldname] ?? "";
  const b = right[sort.fieldname] ?? "";
  const comparison =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true });
  return sort.direction === "asc" ? comparison : -comparison;
}
function isIdentityColumn(label: string) {
  return ["assigned to", "list in"].includes(label.trim().toLowerCase());
}
function isTotalRow(row: Record<string, number | string | null>) {
  return Object.values(row).some(
    (value) => typeof value === "string" && value.trim().toLowerCase() === "total"
  );
}
