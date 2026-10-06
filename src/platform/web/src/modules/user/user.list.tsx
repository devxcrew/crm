import { Trash2 } from "lucide-react";
import type { WorkspaceColumnDef } from "@codexsun/ui/workspace/table";
import { WorkspaceProtectedIndicator } from "@codexsun/ui/workspace/protected-indicator";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import type { User } from "./user.types";

export function UserList({
  loading,
  onEdit,
  onForceDelete,
  onRestore,
  onSuspend,
  records,
  roleLabels
}: {
  loading: boolean;
  onEdit: (record: User) => void;
  onForceDelete: (record: User) => void;
  onRestore: (record: User) => void;
  onSuspend: (record: User) => void;
  records: User[];
  roleLabels: ReadonlyMap<string, string>;
}) {
  const columns: WorkspaceColumnDef<User>[] = [
    {
      cell: ({ row }) => <div className="text-center tabular-nums">{row.index + 1}</div>,
      header: () => <div className="text-center">#</div>,
      id: "number",
      size: 64
    },
    {
      accessorKey: "name",
      cell: ({ row }) => <RecordName record={row.original} onEdit={onEdit} />,
      header: "User"
    },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={roleLabels.get(row.original.role) ?? row.original.role}
          tone="info"
        />
      ),
      header: "Role"
    },
    {
      accessorKey: "frappeEmployeeCode",
      cell: ({ row }) => row.original.frappeEmployeeCode || "—",
      header: "Employee"
    },
    {
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={
            row.original.frappeVerificationStatus === "live"
              ? "Verified"
              : row.original.frappeVerificationStatus === "offline"
                ? "Offline"
                : row.original.frappeApiKeyConfigured
                  ? "Unverified"
                  : "Not configured"
          }
          tone={
            row.original.frappeVerificationStatus === "live"
              ? "success"
              : row.original.frappeVerificationStatus === "offline"
                ? "danger"
                : "neutral"
          }
        />
      ),
      header: "Frappe"
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={statusLabel(row.original.status)}
          tone={
            row.original.status === "active"
              ? "success"
              : row.original.status === "suspended"
                ? "danger"
                : "neutral"
          }
        />
      ),
      header: "Status"
    },
    {
      cell: ({ row }) => (
        <Actions
          record={row.original}
          onEdit={onEdit}
          onForceDelete={onForceDelete}
          onRestore={onRestore}
          onSuspend={onSuspend}
        />
      ),
      enableSorting: false,
      header: () => <div className="text-center">Actions</div>,
      id: "actions",
      size: 96
    }
  ];
  return (
    <WorkspaceTable
      columns={columns}
      data={records}
      emptyState="No users found."
      isLoading={loading}
      minWidth="1080px"
    />
  );
}
function RecordName({ onEdit, record }: { onEdit: (record: User) => void; record: User }) {
  return record.id === 1 ? (
    <span className="font-medium">{record.name}</span>
  ) : (
    <button
      className="cursor-pointer font-medium text-foreground hover:underline"
      onClick={() => onEdit(record)}
      type="button"
    >
      {record.name}
    </button>
  );
}
function Actions({
  onEdit,
  onForceDelete,
  onRestore,
  onSuspend,
  record
}: {
  onEdit: (record: User) => void;
  onForceDelete: (record: User) => void;
  onRestore: (record: User) => void;
  onSuspend: (record: User) => void;
  record: User;
}) {
  return (
    <div
      className="flex w-full justify-center"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {record.id === 1 ? (
        <WorkspaceProtectedIndicator label="Protected user" />
      ) : (
        <WorkspaceRowActions
          actions={[
            {
              id: "force-delete",
              icon: <Trash2 className="size-4" />,
              label: "Force delete",
              onSelect: () => onForceDelete(record),
              tone: "destructive"
            }
          ]}
          deleteLabel="Suspend"
          isSuspended={record.status !== "active"}
          onDelete={() => onSuspend(record)}
          onEdit={() => onEdit(record)}
          onRestore={() => onRestore(record)}
          title={record.name}
        />
      )}
    </div>
  );
}
function statusLabel(status: User["status"]) {
  return status === "active" ? "Active" : status === "suspended" ? "Suspended" : "Inactive";
}
