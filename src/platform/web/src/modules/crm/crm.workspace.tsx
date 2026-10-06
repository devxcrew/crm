import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "@codexsun/ui/components/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@codexsun/ui/components/alert-dialog";
import { Button } from "@codexsun/ui/components/button";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { CrmForm } from "./crm.form";
import { matchesEnquiryFilter, type CrmEnquiryListFilter } from "./crm.enquiry-filters";
import { useCrmEnquiriesQuery, useCrmEnquiryMutations, useCrmUsersQuery } from "./crm.hooks";
import { CrmList } from "./crm.list";
import { useCrmOptionLists } from "./crm.options";
import { CrmShow } from "./crm.show";
import { getCrmEnquiry, receiveCrmEnquiryAssignment } from "./crm.services";
import type {
  CrmEnquiry,
  CrmEnquiryColumnId,
  CrmEnquiryColumnVisibility,
  CrmEnquiryMobileMatch,
  CrmEnquiryPriority,
  CrmEnquirySavePayload,
  CrmEnquiryStatusFilter,
  CrmEnquiryView
} from "./crm.types";
import type { WorkspaceFilterOption } from "@codexsun/ui/workspace/types";

type PendingAction = {
  record: CrmEnquiry;
  type: "force-delete";
};

type EnquirySort = {
  column: CrmEnquiryColumnId;
  direction: "asc" | "desc";
};

const viewDetails: Record<CrmEnquiryView, { description: string; title: string }> = {
  all: { description: "Every live Frappe enquiry across the CRM.", title: "All Enquiries" },
  assigned: { description: "Enquiries assigned to your user account.", title: "My Job" },
  created: { description: "Enquiries created by your account.", title: "My Calls" },
  open: {
    description: "Active unresolved enquiries not assigned to any user.",
    title: "Open Enquiry"
  }
};

const enquiryColumnOptions: Array<{ id: CrmEnquiryColumnId; label: string }> = [
  { id: "id", label: "ID" },
  { id: "mobile", label: "Mobile" },
  { id: "customer", label: "Customer" },
  { id: "title", label: "Enquiry details" },
  { id: "enquiryGroup", label: "List in" },
  { id: "dueDate", label: "Due date" },
  { id: "createdBy", label: "User" },
  { id: "assignedTo", label: "Assigned to" },
  { id: "priority", label: "Priority" },
  { id: "status", label: "Status" }
];

function allEnquiryColumnsVisible(): CrmEnquiryColumnVisibility {
  return Object.fromEntries(
    enquiryColumnOptions.map((column) => [column.id, true])
  ) as CrmEnquiryColumnVisibility;
}

function defaultEnquiryColumnVisibility(): CrmEnquiryColumnVisibility {
  return {
    ...allEnquiryColumnsVisible(),
    mobile: false
  };
}

function usesAllStatusesByDefault(view: CrmEnquiryView) {
  return view === "all" || view === "created";
}

export function CrmWorkspace({
  canAssign,
  canCreate,
  canCreateEstimate,
  canCreateQuotation,
  canForceDelete,
  canManageJobs,
  canMobileLookup,
  canRefresh,
  canUpdateEstimate,
  canUpdateQuotation,
  onCreate,
  onSearchValueChange,
  searchValue,
  showActivity,
  showProperties,
  canUpdate,
  view
}: {
  canAssign: boolean;
  canCreate: boolean;
  canCreateEstimate: boolean;
  canCreateQuotation: boolean;
  canForceDelete: boolean;
  canManageJobs: boolean;
  canMobileLookup: boolean;
  canRefresh: boolean;
  canSuspend: boolean;
  canUpdate: boolean;
  canUpdateEstimate: boolean;
  canUpdateQuotation: boolean;
  onCreate: () => void;
  onSearchValueChange: (value: string) => void;
  searchValue: string;
  showActivity: boolean;
  showProperties: boolean;
  view: CrmEnquiryView;
}) {
  const showAllStatuses = usesAllStatusesByDefault(view);
  const reportFilters = reportFiltersFromUrl(showAllStatuses ? "all" : "active");
  const [statusFilter, setStatusFilter] = useState<CrmEnquiryListFilter>(reportFilters.status);
  const [visibleColumns, setVisibleColumns] = useState<CrmEnquiryColumnVisibility>(
    defaultEnquiryColumnVisibility
  );
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [sort, setSort] = useState<EnquirySort>({ column: "id", direction: "desc" });
  const [editing, setEditing] = useState<CrmEnquiry | null | undefined>(undefined);
  const [viewing, setViewing] = useState<CrmEnquiry | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const enquiryScope = {
    view,
    ...(reportFilters.assignedToEmployee
      ? { assignedToEmployee: reportFilters.assignedToEmployee }
      : {}),
    ...(reportFilters.createdByEmployee
      ? { createdByEmployee: reportFilters.createdByEmployee }
      : {}),
    ...(reportFilters.enquiryGroup ? { enquiryGroup: reportFilters.enquiryGroup } : {}),
    ...(reportFilters.fromDate ? { fromDate: reportFilters.fromDate } : {}),
    ...(reportFilters.priority ? { priority: reportFilters.priority } : {}),
    ...(reportFilters.toDate ? { toDate: reportFilters.toDate } : {}),
    ...(searchValue ? { search: searchValue } : {})
  };
  const isUnassignedFilter = statusFilter === "unassigned";
  const query = useCrmEnquiriesQuery({
    ...enquiryScope,
    ...(isUnassignedFilter ? { assignedToEmployee: "__unassigned__" } : {}),
    status: isUnassignedFilter ? "all" : statusFilter
  });
  const statusCountsQuery = useCrmEnquiriesQuery({ ...enquiryScope, status: "all" });
  const users = useCrmUsersQuery();
  const crmOptions = useCrmOptionLists();
  const mutations = useCrmEnquiryMutations();
  const details = viewDetails[view];
  const pageDescription = reportScopeDescription(
    details.description,
    reportFilters,
    users.data ?? []
  );
  const initialLoading = query.data === undefined && query.isFetching;
  const records = query.data ?? [];
  const statusFilterOptions = buildStatusFilterOptions(
    view === "all" || view === "created",
    statusCountsQuery.data,
    crmOptions.statuses
  );
  const sortedRecords = [...records].sort((left, right) => compareEnquiries(left, right, sort));
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = sortedRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const viewingIndex = viewing ? records.findIndex((record) => record.id === viewing.id) : -1;
  const nextViewing =
    viewingIndex >= 0 && viewingIndex < records.length - 1 ? records[viewingIndex + 1] : undefined;

  async function loadRecord(record: CrmEnquiry, target: "edit" | "view") {
    try {
      const live =
        target === "view" && view === "assigned"
          ? await receiveCrmEnquiryAssignment(record.frappeName)
          : await getCrmEnquiry(record.frappeName);
      if (target === "edit") setEditing(live);
      else {
        setViewing(live);
        if (record.hasUnreadAssignment) await query.refetch();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The live Frappe enquiry could not be loaded."
      );
    }
  }

  useEffect(() => {
    const route = recordRouteFromUrl();
    if (!route || (route.target === "edit" && !canUpdate)) return;
    let active = true;
    void (
      view === "assigned"
        ? receiveCrmEnquiryAssignment(route.frappeName)
        : getCrmEnquiry(route.frappeName)
    )
      .then((record) => {
        if (!active) return;
        if (route.target === "edit") setEditing(record);
        else setViewing(record);
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast.error(
          error instanceof Error ? error.message : "The live Frappe enquiry could not be loaded."
        );
      });
    return () => {
      active = false;
    };
  }, [canUpdate, view]);

  async function openMobileMatch(match: CrmEnquiryMobileMatch) {
    try {
      setViewing(await getCrmEnquiry(match.frappeName));
      setEditing(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The live Frappe enquiry could not be loaded."
      );
    }
  }

  useEffect(
    () => setPage(1),
    [
      view,
      searchValue,
      statusFilter,
      reportFilters.assignedToEmployee,
      reportFilters.enquiryGroup,
      reportFilters.fromDate,
      reportFilters.toDate
    ]
  );

  async function save(value: CrmEnquirySavePayload) {
    try {
      const saved = editing
        ? await mutations.update.mutateAsync({ id: editing.frappeName, payload: value })
        : await mutations.create.mutateAsync(value);
      toast.success(`Enquiry ${editing ? "updated" : "created"}`, {
        description: `#${saved.id} · ${saved.title}`
      });
      setEditing(undefined);
      clearRecordRoute();
    } catch {}
  }

  async function act(action: PendingAction) {
    try {
      const record = await mutations.forceDelete.mutateAsync(action.record);
      toast.success("Enquiry permanently deleted", {
        description: `#${record.id} · ${record.title}`
      });
      setPendingAction(null);
      if (viewing?.id === record.id) setViewing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The enquiry action failed.");
    }
  }

  if (viewing) {
    return (
      <CrmShow
        canAssign={canAssign}
        canCreateEstimate={canCreateEstimate}
        canCreateQuotation={canCreateQuotation}
        canManageJobs={canManageJobs}
        canUpdate={canUpdate}
        canUpdateEstimate={canUpdateEstimate}
        canUpdateQuotation={canUpdateQuotation}
        showActivity={showActivity}
        showProperties={showProperties}
        onBack={() => {
          setViewing(null);
          clearRecordRoute();
        }}
        {...(nextViewing ? { onNext: () => void loadRecord(nextViewing, "view") } : {})}
        onRecordChange={setViewing}
        record={viewing}
        view={view === "all" ? "open" : view}
      />
    );
  }

  return (
    <WorkspacePage
      actions={
        canRefresh || canCreate ? (
          <div className="flex items-center gap-2">
            {canRefresh ? (
              <Button
                className="h-9 rounded-md"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} /> Refresh
              </Button>
            ) : null}
            {canCreate ? (
              <Button
                className="h-9 rounded-md"
                disabled={users.isLoading || !users.data?.length}
                onClick={onCreate}
                type="button"
              >
                <Plus className="size-4" /> New enquiry
              </Button>
            ) : null}
          </div>
        ) : null
      }
      description={pageDescription}
      technicalName={`page.crm.enquiry.${view}`}
      title={details.title}
    >
      <WorkspaceFilters
        columnOptions={enquiryColumnOptions
          .filter(
            (column) =>
              !(view === "assigned" && column.id === "assignedTo") &&
              !(view === "created" && column.id === "createdBy")
          )
          .map((column) => ({
            ...column,
            checked: visibleColumns[column.id],
            onCheckedChange: (checked) =>
              setVisibleColumns((current) => ({ ...current, [column.id]: checked }))
          }))}
        filterOptions={statusFilterOptions}
        filterValue={statusFilter}
        onFilterValueChange={(value) => {
          setStatusFilter(value as CrmEnquiryListFilter);
          setPage(1);
        }}
        onSearchValueChange={onSearchValueChange}
        onShowAllColumns={() => setVisibleColumns(allEnquiryColumnsVisible())}
        searchPlaceholder="Search ID, enquiry details, phone, or customer"
        searchValue={searchValue}
      />
      <CrmList
        error={query.isError}
        loading={initialLoading}
        maskNewCalls={view === "assigned"}
        {...(canForceDelete
          ? {
              onForceDelete: (record) => setPendingAction({ record, type: "force-delete" as const })
            }
          : {})}
        {...(canUpdate ? { onSelect: (record) => void loadRecord(record, "edit") } : {})}
        {...(view === "assigned" || view === "created"
          ? { onRowClick: (record) => void loadRecord(record, "view") }
          : {})}
        onView={(record) => void loadRecord(record, "view")}
        onSort={(column) =>
          setSort((current) => ({
            column,
            direction: current.column === column && current.direction === "asc" ? "desc" : "asc"
          }))
        }
        records={visibleRecords}
        sort={sort}
        visibleColumns={{
          ...visibleColumns,
          assignedTo: view === "assigned" ? false : visibleColumns.assignedTo,
          createdBy: view === "created" ? false : visibleColumns.createdBy
        }}
      />
      {query.data !== undefined ? (
        <WorkspacePagination
          page={currentPage}
          rowsPerPage={rowsPerPage}
          showingLabel={buildShowingLabel(currentPage, rowsPerPage, records.length)}
          singularLabel="enquiry"
          totalCount={records.length}
          totalPages={totalPages}
          onNextPage={() => setPage((value) => Math.min(totalPages, value + 1))}
          onPageChange={setPage}
          onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
          onRowsPerPageChange={(value) => {
            setRowsPerPage(value);
            setPage(1);
          }}
        />
      ) : null}
      <CrmForm
        canAssign={canAssign}
        canMobileLookup={canMobileLookup}
        {...((mutations.create.error ?? mutations.update.error) instanceof Error
          ? { error: (mutations.create.error ?? (mutations.update.error as Error)).message }
          : {})}
        loading={mutations.create.isPending || mutations.update.isPending}
        onCancel={() => {
          setEditing(undefined);
          clearRecordRoute();
        }}
        onOpenExisting={(match) => void openMobileMatch(match)}
        onSubmit={(value) => void save(value)}
        open={editing !== undefined}
        record={editing ?? null}
        users={users.data ?? []}
      />
      <CrmActionDialog
        action={pendingAction}
        loading={mutations.forceDelete.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => pendingAction && void act(pendingAction)}
      />
    </WorkspacePage>
  );
}

function compareEnquiries(left: CrmEnquiry, right: CrmEnquiry, sort: EnquirySort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  const values: Record<CrmEnquiryColumnId, string | number> = {
    assignedTo: left.assignedTo?.name ?? "",
    createdBy: left.createdBy.name,
    customer: left.customer,
    dueDate: left.enquiryDate ?? "",
    enquiryGroup: left.enquiryGroup,
    id: left.id,
    mobile: left.mobile,
    priority: left.priority,
    status: left.status,
    title: left.title || left.workspace
  };
  const other: Record<CrmEnquiryColumnId, string | number> = {
    assignedTo: right.assignedTo?.name ?? "",
    createdBy: right.createdBy.name,
    customer: right.customer,
    dueDate: right.enquiryDate ?? "",
    enquiryGroup: right.enquiryGroup,
    id: right.id,
    mobile: right.mobile,
    priority: right.priority,
    status: right.status,
    title: right.title || right.workspace
  };
  const a = values[sort.column];
  const b = other[sort.column];
  return typeof a === "number" && typeof b === "number"
    ? (a - b) * direction
    : String(a).localeCompare(String(b), undefined, { numeric: true }) * direction;
}

function reportFiltersFromUrl(defaultStatus: CrmEnquiryStatusFilter) {
  if (typeof window === "undefined") {
    return {
      assignedToEmployee: "",
      createdByEmployee: "",
      enquiryGroup: "",
      fromDate: "",
      priority: undefined,
      status: defaultStatus,
      toDate: ""
    };
  }
  const query = new URLSearchParams(window.location.search);
  const value = query.get("status");
  return [
    "active",
    "all",
    "in-progress",
    "closed",
    "hold",
    "other",
    "open",
    "escalation",
    "won",
    "lost",
    "new",
    "hold-for-approval",
    "hold-for-spares",
    "hold-for-job-out",
    "long-hold",
    "reopen"
  ].includes(value ?? "")
    ? {
        assignedToEmployee: query.get("assignedToEmployee") ?? "",
        createdByEmployee: query.get("createdByEmployee") ?? "",
        enquiryGroup: query.get("enquiryGroup") ?? "",
        fromDate: query.get("fromDate") ?? "",
        priority: priorityFromUrl(query.get("priority")),
        status: value as CrmEnquiryStatusFilter,
        toDate: query.get("toDate") ?? ""
      }
    : {
        assignedToEmployee: query.get("assignedToEmployee") ?? "",
        createdByEmployee: query.get("createdByEmployee") ?? "",
        enquiryGroup: query.get("enquiryGroup") ?? "",
        fromDate: query.get("fromDate") ?? "",
        priority: priorityFromUrl(query.get("priority")),
        status: defaultStatus,
        toDate: query.get("toDate") ?? ""
      };
}

function priorityFromUrl(value: string | null): CrmEnquiryPriority | undefined {
  return ["low", "normal", "high", "urgent"].includes(value ?? "")
    ? (value as CrmEnquiryPriority)
    : undefined;
}

function reportScopeDescription(
  description: string,
  filters: {
    assignedToEmployee: string;
    createdByEmployee: string;
    enquiryGroup: string;
    fromDate: string;
    priority: CrmEnquiryPriority | undefined;
    toDate: string;
  },
  users: Array<{ id: string; name: string }>
) {
  const scope = [
    filters.enquiryGroup ? `List in ${filters.enquiryGroup}` : "",
    filters.assignedToEmployee
      ? `Assigned to ${
          filters.assignedToEmployee === "__unassigned__"
            ? "Unassigned"
            : (users.find((user) => user.id === filters.assignedToEmployee)?.name ??
              filters.assignedToEmployee)
        }`
      : "",
    filters.createdByEmployee
      ? `Created by ${
          users.find((user) => user.id === filters.createdByEmployee)?.name ??
          filters.createdByEmployee
        }`
      : "",
    filters.fromDate ? `from ${filters.fromDate}` : "",
    filters.toDate ? `to ${filters.toDate}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  return scope ? `${description} Report filter: ${scope}.` : description;
}

function buildStatusFilterOptions(
  showUnassigned: boolean,
  records: CrmEnquiry[] | undefined,
  statusOptions: Array<{ label: string; value: string }>
): WorkspaceFilterOption[] {
  const options: Array<{ id: CrmEnquiryListFilter; label: string }> = [
    { id: "all", label: "All calls" },
    ...(showUnassigned ? [{ id: "unassigned" as const, label: "Unassigned" }] : []),
    { id: "active", label: "Active (except won and lost)" },
    { id: "hold", label: "Hold" },
    { id: "other", label: "Other" },
    { id: "in-progress", label: "In progress (holds and escalation)" },
    { id: "closed", label: "Closed (won, lost)" },
    ...statusOptions.map(({ label, value }) => ({ id: value, label }))
  ];

  return options.map((option) => {
    const count = records?.filter((record) => matchesEnquiryFilter(record, option.id)).length;
    return count === undefined ? option : { ...option, count };
  });
}

function recordRouteFromUrl(): { frappeName: string; target: "edit" | "view" } | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const edit = query.get("edit")?.trim();
  if (edit) return { frappeName: edit, target: "edit" };
  const show = query.get("show")?.trim();
  return show ? { frappeName: show, target: "view" } : null;
}

function clearRecordRoute() {
  if (typeof window === "undefined" || !window.location.search) return;
  window.history.replaceState(null, "", window.location.pathname);
}

function CrmActionDialog({
  action,
  loading,
  onCancel,
  onConfirm
}: {
  action: PendingAction | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const destructive = true;
  const verb = "Force delete";
  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{verb} enquiry?</AlertDialogTitle>
          <AlertDialogDescription>
            {`Enquiry #${action?.record.id ?? ""} will be permanently removed from Frappe.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            disabled={loading}
            onClick={onConfirm}
          >
            {verb}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
