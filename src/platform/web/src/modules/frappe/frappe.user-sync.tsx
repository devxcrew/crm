import { useMemo, useState } from "react";
import type { WorkspaceColumnDef } from "@codexsun/ui/workspace/table";
import { CheckIcon, ClipboardCopyIcon, RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@codexsun/ui/components/dialog";
import { Input } from "@codexsun/ui/components/input";
import { toast } from "@codexsun/ui/components/sonner";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { WorkspaceFormBanner } from "@codexsun/ui/workspace/upsert";
import { useFrappeUserImportMutation, useFrappeUserPreviewQuery } from "./frappe.hooks";
import type { FrappeUserImportResult, FrappeUserPreview } from "./frappe.types";

export function FrappeUserSyncWorkspace({ canImport }: { canImport: boolean }) {
  const query = useFrappeUserPreviewQuery();
  const importMutation = useFrappeUserImportMutation();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<FrappeUserImportResult | null>(null);
  const records = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return query.data ?? [];
    return (query.data ?? []).filter(
      (record) =>
        record.name.toLowerCase().includes(term) ||
        record.email.toLowerCase().includes(term) ||
        record.frappeUserId.toLowerCase().includes(term)
    );
  }, [query.data, search]);

  async function addUser(record: FrappeUserPreview) {
    try {
      const imported = await importMutation.mutateAsync(record.frappeUserId);
      if (imported.created) {
        setResult(imported);
        toast.success("Frappe user added", { description: imported.user.name });
      } else {
        toast.info("User is already in CRM", { description: imported.user.email });
      }
    } catch {}
  }

  const columns: WorkspaceColumnDef<FrappeUserPreview>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{row.original.frappeUserId}</div>
        </div>
      ),
      header: "Frappe user"
    },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "userType", header: "Type", size: 140 },
    {
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatFrappeDate(row.original.lastActiveAt)}
        </span>
      ),
      header: "Last active",
      id: "lastActiveAt",
      size: 180
    },
    {
      cell: ({ row }) => (
        <WorkspaceStatusBadge
          label={
            row.original.localUserId
              ? row.original.localStatus === "active"
                ? "Already added"
                : `Added · ${row.original.localStatus}`
              : "Ready to add"
          }
          tone={
            row.original.localUserId
              ? row.original.localStatus === "active"
                ? "success"
                : "warning"
              : "info"
          }
        />
      ),
      header: "Application",
      id: "applicationStatus",
      size: 150
    },
    {
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            disabled={
              !canImport ||
              Boolean(row.original.localUserId) ||
              (importMutation.isPending && importMutation.variables === row.original.frappeUserId)
            }
            onClick={() => void addUser(row.original)}
            size="sm"
            type="button"
            variant={row.original.localUserId ? "ghost" : "outline"}
          >
            {row.original.localUserId ? (
              <CheckIcon className="size-4" />
            ) : (
              <UserPlusIcon className="size-4" />
            )}
            {row.original.localUserId ? "Added" : "Add user"}
          </Button>
        </div>
      ),
      enableSorting: false,
      header: () => <div className="text-right">Action</div>,
      id: "action",
      size: 130
    }
  ];

  return (
    <WorkspacePage
      actions={
        <Button
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          type="button"
          variant="outline"
        >
          <RefreshCwIcon className={cn("size-4", query.isFetching && "animate-spin")} />
          Refresh preview
        </Button>
      }
      description="Preview enabled Frappe System Users and add them to CRM."
      technicalName="page.frappe.user-sync"
      title="Frappe user sync"
    >
      <WorkspaceFilters
        onSearchValueChange={setSearch}
        searchPlaceholder="Search Frappe users"
        searchValue={search}
      />
      {query.isError ? (
        <WorkspaceFormBanner title="Frappe users could not be loaded">
          {query.error instanceof Error ? query.error.message : "Please check the connection."}
        </WorkspaceFormBanner>
      ) : null}
      {importMutation.isError ? (
        <WorkspaceFormBanner title="Frappe user could not be added">
          {importMutation.error instanceof Error
            ? importMutation.error.message
            : "Please try again."}
        </WorkspaceFormBanner>
      ) : null}
      <WorkspaceTable
        columns={columns}
        data={records}
        emptyState="No enabled Frappe System Users found."
        isLoading={query.isLoading}
        minWidth="900px"
      />
      <TemporaryPasswordDialog result={result} onClose={() => setResult(null)} />
    </WorkspacePage>
  );
}

function TemporaryPasswordDialog({
  onClose,
  result
}: {
  onClose: () => void;
  result: FrappeUserImportResult | null;
}) {
  async function copyPassword() {
    if (!result?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      toast.success("Temporary password copied");
    } catch {
      toast.error("Temporary password could not be copied");
    }
  }
  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User added to CRM</DialogTitle>
          <DialogDescription>
            Share this generated password securely with {result?.user.name}, then change it from
            Access Control. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="text-sm font-medium">{result?.user.email}</div>
          <div className="flex gap-2">
            <Input readOnly value={result?.temporaryPassword ?? ""} />
            <Button onClick={() => void copyPassword()} type="button" variant="outline">
              <ClipboardCopyIcon className="size-4" />
              Copy
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatFrappeDate(value: string | null) {
  if (!value) return "Never";
  const normalized = value.replace(" ", "T");
  const parsed = new Date(
    /[zZ]$|[+-]\d{2}:\d{2}$/u.test(normalized) ? normalized : `${normalized}+05:30`
  );
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
      });
}
