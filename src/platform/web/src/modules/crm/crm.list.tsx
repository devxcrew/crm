import {
  ArrowDown,
  ArrowUp,
  Ban,
  BellRing,
  CircleCheck,
  CircleDot,
  CircleX,
  Trash2,
  TriangleAlert
} from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@codexsun/ui";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  WorkspaceTableEmptyState,
  WorkspaceTableHeaderCell,
  WorkspaceTableLoadingState,
  WorkspaceTablePanel,
  workspaceTableRowClass
} from "@codexsun/ui/workspace/table";
import type {
  CrmEnquiry,
  CrmEnquiryColumnId,
  CrmEnquiryColumnVisibility,
  CrmEnquiryPriority,
  CrmEnquiryStatus
} from "./crm.types";
import { crmEnquiryStatusOptions } from "./crm.options";

export type CrmListProps = {
  error: boolean;
  loading: boolean;
  onForceDelete?: (record: CrmEnquiry) => void;
  onRowClick?: (record: CrmEnquiry) => void;
  onRestore?: (record: CrmEnquiry) => void;
  onSelect?: (record: CrmEnquiry) => void;
  onSort: (column: CrmEnquiryColumnId) => void;
  onSuspend?: (record: CrmEnquiry) => void;
  onView: (record: CrmEnquiry) => void;
  maskNewCalls?: boolean;
  records: CrmEnquiry[];
  sort: { column: CrmEnquiryColumnId; direction: "asc" | "desc" };
  visibleColumns: CrmEnquiryColumnVisibility;
};

type MobileCrmListRenderer = (props: CrmListProps) => ReactNode;

let mobileCrmListRenderer: MobileCrmListRenderer | undefined;

export function configureMobileCrmListRenderer(renderer: MobileCrmListRenderer) {
  mobileCrmListRenderer = renderer;
}

export function CrmList(props: CrmListProps) {
  if (mobileCrmListRenderer) return mobileCrmListRenderer(props);
  return <DesktopCrmList {...props} />;
}

function DesktopCrmList({
  error,
  loading,
  onForceDelete,
  onRowClick,
  onRestore,
  onSelect,
  onSort,
  onSuspend,
  onView,
  maskNewCalls = false,
  records,
  sort,
  visibleColumns
}: CrmListProps) {
  return (
    <TooltipProvider>
      <WorkspaceTablePanel>
        <div className="overflow-x-auto [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35 [&::-webkit-scrollbar-track]:bg-transparent">
          <table className="min-w-[1040px] w-full table-fixed border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                {visibleColumns.id ? (
                  <WorkspaceTableHeaderCell className="w-[72px] min-w-[72px] max-w-[72px] whitespace-nowrap">
                    <SortHeader column="id" label="ID" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.mobile ? (
                  <WorkspaceTableHeaderCell className="w-32 min-w-32 whitespace-nowrap">
                    <SortHeader column="mobile" label="Mobile" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.customer ? (
                  <WorkspaceTableHeaderCell className="w-44 min-w-44 whitespace-nowrap">
                    <SortHeader column="customer" label="Customer" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.title ? (
                  <WorkspaceTableHeaderCell className="w-60 min-w-60 whitespace-nowrap">
                    <SortHeader
                      column="title"
                      label="Enquiry details"
                      onSort={onSort}
                      sort={sort}
                    />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.enquiryGroup ? (
                  <WorkspaceTableHeaderCell className="w-28 min-w-28 whitespace-nowrap">
                    <SortHeader column="enquiryGroup" label="List in" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.dueDate ? (
                  <WorkspaceTableHeaderCell className="w-32 min-w-32 whitespace-nowrap">
                    <SortHeader column="dueDate" label="Due date" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.priority ? (
                  <WorkspaceTableHeaderCell
                    aria-label="Priority"
                    className="w-12 min-w-12 max-w-12 whitespace-nowrap p-0 text-center"
                  >
                    <SortHeader column="priority" label="Priority" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.createdBy ? (
                  <WorkspaceTableHeaderCell className="w-40 min-w-40 whitespace-nowrap">
                    <SortHeader column="createdBy" label="User" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.assignedTo ? (
                  <WorkspaceTableHeaderCell className="w-40 min-w-40 whitespace-nowrap">
                    <SortHeader
                      column="assignedTo"
                      label="Assigned to"
                      onSort={onSort}
                      sort={sort}
                    />
                  </WorkspaceTableHeaderCell>
                ) : null}
                {visibleColumns.status ? (
                  <WorkspaceTableHeaderCell className="w-36 min-w-36 max-w-36 whitespace-nowrap">
                    <SortHeader column="status" label="Status" onSort={onSort} sort={sort} />
                  </WorkspaceTableHeaderCell>
                ) : null}
                <WorkspaceTableHeaderCell className="w-16 min-w-16 max-w-16 whitespace-nowrap text-right">
                  Action
                </WorkspaceTableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  className={`${workspaceTableRowClass} ${
                    onRowClick
                      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
                      : ""
                  }`}
                  key={record.id}
                  onClick={onRowClick ? () => onRowClick(record) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(record);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {visibleColumns.id ? (
                    <td className="w-[72px] min-w-[72px] max-w-[72px] truncate px-4 py-2.5 font-mono text-xs tabular-nums">
                      {onRowClick ? (
                        <button
                          className="cursor-pointer font-medium hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            onView(record);
                          }}
                          type="button"
                        >
                          #{record.id}
                        </button>
                      ) : (
                        <>#{record.id}</>
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.mobile ? (
                    <td className="w-32 min-w-32 truncate whitespace-nowrap px-4 py-2.5">
                      {record.mobile ? (
                        <button
                          className="cursor-pointer font-medium hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            onView(record);
                          }}
                          type="button"
                        >
                          {record.mobile}
                        </button>
                      ) : (
                        record.mobile || "—"
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.customer ? (
                    <td
                      className="w-44 min-w-44 max-w-44 truncate px-4 py-2.5"
                      title={record.customerName || record.customer}
                    >
                      {record.customer ? (
                        <button
                          className="max-w-48 cursor-pointer truncate text-left font-medium hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            onView(record);
                          }}
                          type="button"
                        >
                          {record.customerName || record.customer}
                        </button>
                      ) : (
                        record.customer || "—"
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.title ? (
                    <td className="w-60 min-w-60 max-w-60 px-4 py-2.5">
                      {record.hasUnreadAssignment || (maskNewCalls && record.status === "new") ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          <BellRing className="size-3.5" />
                          New call
                        </span>
                      ) : (
                        <button
                          className="block w-full truncate cursor-pointer text-left font-medium hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            onView(record);
                          }}
                          type="button"
                        >
                          {plainText(record.title) || plainText(record.workspace)}
                        </button>
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.enquiryGroup ? (
                    <td className="w-28 min-w-28 truncate whitespace-nowrap px-4 py-2.5">
                      {record.enquiryGroup || "—"}
                    </td>
                  ) : null}
                  {visibleColumns.dueDate ? (
                    <td className="w-32 min-w-32 truncate whitespace-nowrap px-4 py-2.5">
                      {record.schedules[0]?.scheduledOn
                        ? new Intl.DateTimeFormat("en-IN", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "Asia/Kolkata",
                            year: "numeric"
                          }).format(new Date(`${record.schedules[0].scheduledOn}T00:00:00+05:30`))
                        : "—"}
                    </td>
                  ) : null}
                  {visibleColumns.priority ? (
                    <td className="w-12 min-w-12 max-w-12 p-0 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label={`Priority: ${statusLabel(record.priority)}`}
                            className={`inline-flex size-3 rounded-full ring-1 ring-inset ${priorityCircleClassName(record.priority)}`}
                            role="img"
                            tabIndex={0}
                          >
                            <span className="sr-only">{statusLabel(record.priority)}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{statusLabel(record.priority)} priority</TooltipContent>
                      </Tooltip>
                    </td>
                  ) : null}
                  {visibleColumns.createdBy ? (
                    <td className="w-40 min-w-40 truncate whitespace-nowrap px-4 py-2.5">
                      {record.createdBy.name}
                    </td>
                  ) : null}
                  {visibleColumns.assignedTo ? (
                    <td className="w-40 min-w-40 truncate whitespace-nowrap px-4 py-2.5">
                      {record.assignedTo?.name ?? "Unassigned"}
                    </td>
                  ) : null}
                  {visibleColumns.status ? (
                    <td className="w-36 min-w-36 max-w-36 whitespace-nowrap px-2 py-2.5">
                      <EnquiryStatusBadge record={record} />
                    </td>
                  ) : null}
                  <td className="w-16 min-w-16 max-w-16 px-2 py-1.5 text-right">
                    <div
                      className="flex justify-end"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <WorkspaceRowActions
                        {...(onForceDelete
                          ? {
                              actions: [
                                {
                                  id: "force-delete",
                                  icon: <Trash2 className="size-4" />,
                                  label: "Force delete",
                                  onSelect: () => onForceDelete(record),
                                  tone: "destructive" as const
                                }
                              ]
                            }
                          : {})}
                        deleteLabel="Suspend"
                        isSuspended={record.lifecycleStatus === "suspended"}
                        {...(onSelect && record.lifecycleStatus === "active"
                          ? { onEdit: () => onSelect(record) }
                          : {})}
                        {...(onRestore ? { onRestore: () => onRestore(record) } : {})}
                        {...(onSuspend ? { onDelete: () => onSuspend(record) } : {})}
                        onView={() => onView(record)}
                        restoreLabel="Restore"
                        title={`Enquiry #${record.id}`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length === 0 ? (
          loading ? (
            <WorkspaceTableLoadingState />
          ) : (
            <WorkspaceTableEmptyState>
              {error
                ? "Enquiries could not be loaded. Use Refresh to try again."
                : "No enquiries found."}
            </WorkspaceTableEmptyState>
          )
        ) : null}
      </WorkspaceTablePanel>
    </TooltipProvider>
  );
}

function SortHeader({
  column,
  label,
  onSort,
  sort
}: {
  column: CrmEnquiryColumnId;
  label: string;
  onSort: (column: CrmEnquiryColumnId) => void;
  sort: { column: CrmEnquiryColumnId; direction: "asc" | "desc" };
}) {
  const active = sort.column === column;
  const Icon = sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      aria-label={`Sort by ${label}`}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => onSort(column)}
      type="button"
    >
      {label}
      {active ? <Icon className="size-3" /> : null}
    </button>
  );
}

function statusLabel(status: CrmEnquiryPriority) {
  return status[0]!.toUpperCase() + status.slice(1);
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<\/p\s*>/giu, " ")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

type EnquiryStatusAppearance = {
  badgeClassName: string;
  iconClassName: string;
  tone: "danger" | "info" | "neutral" | "success" | "warning";
};

const enquiryStatusAppearance: Record<string, EnquiryStatusAppearance> = {
  escalation: {
    badgeClassName: "border-red-600 bg-red-600 text-white",
    iconClassName: "text-white",
    tone: "danger"
  },
  "hold-for-approval": {
    badgeClassName: "border-amber-400 bg-amber-400 text-amber-950",
    iconClassName: "text-amber-950",
    tone: "warning"
  },
  "hold-for-job-out": {
    badgeClassName: "border-amber-400 bg-amber-400 text-amber-950",
    iconClassName: "text-amber-950",
    tone: "warning"
  },
  "hold-for-spares": {
    badgeClassName: "border-amber-400 bg-amber-400 text-amber-950",
    iconClassName: "text-amber-950",
    tone: "warning"
  },
  "long-hold": {
    badgeClassName: "border-amber-400 bg-amber-400 text-amber-950",
    iconClassName: "text-amber-950",
    tone: "warning"
  },
  lost: {
    badgeClassName: "border-red-600 bg-red-600 text-white",
    iconClassName: "text-white",
    tone: "danger"
  },
  new: {
    badgeClassName: "border-slate-300 bg-slate-200 text-slate-700",
    iconClassName: "text-slate-600",
    tone: "neutral"
  },
  open: {
    badgeClassName: "border-blue-600 bg-blue-600 text-white",
    iconClassName: "text-white",
    tone: "info"
  },
  reopen: {
    badgeClassName: "border-blue-600 bg-blue-600 text-white",
    iconClassName: "text-white",
    tone: "info"
  },
  won: {
    badgeClassName: "border-emerald-600 bg-emerald-600 text-white",
    iconClassName: "text-white",
    tone: "success"
  }
};

const suspendedStatusAppearance = {
  badgeClassName: "border-red-600 bg-red-600 text-white",
  iconClassName: "text-white",
  tone: "danger"
} as const;

export function EnquiryStatusBadge({ record }: { record: CrmEnquiry }) {
  const suspended = record.lifecycleStatus === "suspended";
  const appearance = suspended
    ? suspendedStatusAppearance
    : (enquiryStatusAppearance[record.status] ?? statusGroupAppearance(record.statusGroup));
  return (
    <span className="relative inline-flex">
      <span
        className={`pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 ${appearance.iconClassName}`}
      >
        {suspended ? <Ban className="size-3" /> : statusIcon(record.status)}
      </span>
      <WorkspaceStatusBadge
        className={`shrink-0 whitespace-nowrap rounded-full pl-6 ${appearance.badgeClassName}`}
        label={suspended ? "Suspended" : enquiryStatusLabel(record.status)}
        showIcon={false}
        tone={appearance.tone}
      />
    </span>
  );
}

function statusGroupAppearance(group: CrmEnquiry["statusGroup"]): EnquiryStatusAppearance {
  if (group === "closed") return enquiryStatusAppearance.won!;
  if (group === "hold") return enquiryStatusAppearance["hold-for-approval"]!;
  if (group === "pending") return enquiryStatusAppearance.open!;
  return enquiryStatusAppearance.new!;
}

function enquiryStatusLabel(status: CrmEnquiryStatus) {
  return crmEnquiryStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function statusIcon(status: CrmEnquiry["status"]) {
  if (status === "escalation") return <TriangleAlert className="size-3" />;
  if (status === "won") return <CircleCheck className="size-3" />;
  if (status === "lost") return <CircleX className="size-3" />;
  return <CircleDot className="size-3" />;
}

function priorityCircleClassName(priority: CrmEnquiryPriority) {
  if (priority === "low") return "bg-sky-500 ring-sky-600/30";
  if (priority === "normal") return "bg-teal-500 ring-teal-600/30";
  if (priority === "high") return "bg-amber-500 ring-amber-600/30";
  return "bg-red-500 ring-red-600/30";
}
