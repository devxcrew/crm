import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { toast } from "@codexsun/ui/components/sonner";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableHeaderCell,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel,
  workspaceTableRowClass
} from "@codexsun/ui/workspace/table";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { HrStaffRequestForm } from "./hr.form";
import { useHrStaffRequestMutations, useHrStaffRequestsQuery } from "./hr.hooks";
import type { HrStaffRequest, HrStaffRequestSavePayload, HrStaffRequestView } from "./hr.types";

export function HrStaffRequestWorkspace({
  canApprove,
  canCreate,
  canUpdate,
  view
}: {
  canApprove: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  view: HrStaffRequestView;
}) {
  const query = useHrStaffRequestsQuery(view);
  const mutations = useHrStaffRequestMutations();
  const [editing, setEditing] = useState<HrStaffRequest | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const records = useMemo(() => filterRequests(query.data ?? [], search), [query.data, search]);
  const totalPages = Math.max(1, Math.ceil(records.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = records.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => setPage(1), [search, view]);

  async function edit(record: HrStaffRequest) {
    try {
      setEditing(await mutations.get.mutateAsync(record.name));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The Staff Request could not be loaded.");
    }
  }

  async function approve(record: HrStaffRequest) {
    try {
      const updated = await mutations.approve.mutateAsync(record.name);
      toast.success("Request approved", { description: `${updated.name} now includes your approval comment.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The Staff Request could not be approved.");
    }
  }

  async function save(value: HrStaffRequestSavePayload) {
    try {
      const saved = editing
        ? await mutations.update.mutateAsync({ name: editing.name, payload: value })
        : await mutations.create.mutateAsync(value);
      toast.success(editing ? "Request updated" : "Request sent", { description: saved.name });
      setEditing(undefined);
    } catch {}
  }

  if (editing !== undefined) {
    const error = mutations.create.error ?? mutations.update.error;
    return (
      <WorkspacePage
        description="Staff Requests are stored on the connected Frappe site."
        technicalName="page.hr.request.form"
        title="HR request"
      >
        <HrStaffRequestForm
          {...(error instanceof Error ? { error: error.message } : {})}
          loading={mutations.create.isPending || mutations.update.isPending}
          onCancel={() => setEditing(undefined)}
          onSubmit={(value) => void save(value)}
          record={editing}
        />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage
      actions={
        view === "my" ? (
          <div className="flex items-center gap-2">
            {canCreate ? (
              <Button onClick={() => setEditing(null)} type="button">
                <Plus className="size-4" /> New request
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
      description={
        view === "all"
          ? "Review live Staff Requests. Approvals are recorded as Frappe comments."
          : "Create and track your live Staff Requests."
      }
      technicalName={`page.hr.request.${view}`}
      title={view === "all" ? "All requests" : "My requests"}
    >
      <WorkspaceFilters
        onSearchValueChange={setSearch}
        searchPlaceholder="Search request, type, date, or details"
        searchValue={search}
      />
      <WorkspaceTablePanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                <WorkspaceTableHeaderCell>Request</WorkspaceTableHeaderCell>
                {view === "all" ? <WorkspaceTableHeaderCell>Employee</WorkspaceTableHeaderCell> : null}
                <WorkspaceTableHeaderCell>Type</WorkspaceTableHeaderCell>
                <WorkspaceTableHeaderCell>Date</WorkspaceTableHeaderCell>
                <WorkspaceTableHeaderCell>Days</WorkspaceTableHeaderCell>
                <WorkspaceTableHeaderCell>Details</WorkspaceTableHeaderCell>
                <WorkspaceTableHeaderCell>Approval</WorkspaceTableHeaderCell>
                <WorkspaceTableHeaderCell className="w-32 text-right">Action</WorkspaceTableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr className={workspaceTableRowClass} key={record.name}>
                  <td className="border-b px-4 py-3 font-medium">{record.name}</td>
                  {view === "all" ? <td className="border-b px-4 py-3">{record.employee}</td> : null}
                  <td className="border-b px-4 py-3">{record.requestType}</td>
                  <td className="border-b px-4 py-3">{formatDate(record.date)}</td>
                  <td className="border-b px-4 py-3 text-center tabular-nums">{record.days}</td>
                  <td className="max-w-80 truncate border-b px-4 py-3" title={record.details}>{record.details}</td>
                  <td className="border-b px-4 py-3">
                    {record.approvals.length ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="size-4" /> Approved</span>
                    ) : <span className="text-muted-foreground">Pending</span>}
                  </td>
                  <td className="border-b px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate && !record.approvals.length ? (
                        <Button aria-label={`Edit ${record.name}`} onClick={() => void edit(record)} size="icon" type="button" variant="outline"><Pencil className="size-4" /></Button>
                      ) : null}
                      {canApprove && !record.approvals.length ? (
                        <Button onClick={() => void approve(record)} type="button" variant="outline">Approve</Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleRecords.length ? (
          query.isFetching ? (
            <WorkspaceTableLoadingState />
          ) : (
            <WorkspaceTableEmptyState>
              No Staff Requests found.
            </WorkspaceTableEmptyState>
          )
        ) : null}
      </WorkspaceTablePanel>
      <WorkspacePagination
        onNextPage={() => setPage((value) => Math.min(totalPages, value + 1))}
        onPageChange={setPage}
        onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
        onRowsPerPageChange={(value) => { setRowsPerPage(value); setPage(1); }}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        showingLabel={buildShowingLabel(currentPage, rowsPerPage, records.length)}
        singularLabel="request"
        totalCount={records.length}
        totalPages={totalPages}
      />
    </WorkspacePage>
  );
}

function filterRequests(records: HrStaffRequest[], search: string) {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return records;
  return records.filter((record) =>
    [record.name, record.employee, record.requestType, record.date, record.details]
      .join(" ")
      .toLocaleLowerCase()
      .includes(term)
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}
