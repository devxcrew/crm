import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Checkbox } from "@codexsun/ui/components/checkbox";
import { toast } from "@codexsun/ui/components/sonner";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import {
  useRolePermissionLookups,
  useRolePermissionMutations,
  useRolePermissionsQuery
} from "./role-permission.hooks";

const protectedNamespaces = new Set(["identity", "settings"]);

export function RolePermissionWorkspace() {
  const assignments = useRolePermissionsQuery();
  const lookups = useRolePermissionLookups();
  const mutations = useRolePermissionMutations();
  const [roleId, setRoleId] = useState<number>();
  const roles = lookups.data?.first ?? [];
  const permissions = lookups.data?.second ?? [];
  const selectedRole = roles.find((role) => role.id === roleId) ?? roles[0];

  useEffect(() => {
    if (!roleId && selectedRole) setRoleId(selectedRole.id);
  }, [roleId, selectedRole]);

  const assignedByPermission = useMemo(
    () =>
      new Map(
        (assignments.data ?? [])
          .filter((assignment) => assignment.roleId === selectedRole?.id && assignment.status === "active")
          .map((assignment) => [assignment.permissionId, assignment])
      ),
    [assignments.data, selectedRole?.id]
  );
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const lockedRole = selectedRole?.key === "super-admin";

  async function toggle(permissionId: number, checked: boolean) {
    if (!selectedRole || lockedRole) return;
    const permission = permissions.find((item) => item.id === permissionId);
    if (!permission || isLockedPermission(selectedRole.key, permission.key)) return;
    try {
      const current = assignedByPermission.get(permissionId);
      if (checked && !current) {
        await mutations.create.mutateAsync({ permissionId, roleId: selectedRole.id, status: "active" });
      }
      if (!checked && current) await mutations.forceDelete.mutateAsync(current);
      toast.success("Access controls saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The access control could not be saved.");
    }
  }

  async function setAll(checked: boolean) {
    if (!selectedRole || lockedRole) return;
    const eligible = permissions.filter(
      (permission) => !isLockedPermission(selectedRole.key, permission.key)
    );
    for (const permission of eligible) {
      if (checked !== assignedByPermission.has(permission.id)) {
        await toggle(permission.id, checked);
      }
    }
  }

  return (
    <WorkspacePage
      actions={
        <Button
          disabled={assignments.isFetching || lookups.isFetching}
          onClick={() => {
            void assignments.refetch();
            void lookups.refetch();
          }}
          type="button"
          variant="outline"
        >
          <RefreshCw className={cn("size-4", (assignments.isFetching || lookups.isFetching) && "animate-spin")} />
          Refresh
        </Button>
      }
      description="Select a role, then enable the features that it can use."
      technicalName="page.application.access.controls"
      title="Access controls"
    >
      <section className="grid gap-5 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2" aria-label="Roles">
          {roles.map((role) => {
            const selected = role.id === selectedRole?.id;
            return (
              <button
                className={cn(
                  "rounded-md border px-4 py-3 text-left transition-colors",
                  selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/60"
                )}
                key={role.id}
                onClick={() => setRoleId(role.id)}
                type="button"
              >
                <span className="block text-sm font-semibold">{role.label}</span>
                <span className={cn("mt-1 block text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {role.key === "super-admin" ? "All controls. No CRM desk." : role.key === "admin" ? "Full CRM and account access." : "Choose CRM features."}
                </span>
              </button>
            );
          })}
        </aside>
        <section className="min-w-0 rounded-md border bg-card">
          <header className="sticky left-0 flex min-w-[44rem] flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{selectedRole?.label ?? "Role"} permissions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lockedRole ? "SuperAdmin has every feature. CRM stays unavailable without an employee code." : "Turn on only the features this role needs."}
              </p>
            </div>
            {lockedRole ? (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <ShieldCheck className="size-4" />
                Full access
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <Button disabled={mutations.create.isPending || mutations.forceDelete.isPending} onClick={() => void setAll(true)} size="sm" type="button" variant="outline">
                  Select all
                </Button>
                <Button disabled={mutations.create.isPending || mutations.forceDelete.isPending} onClick={() => void setAll(false)} size="sm" type="button" variant="outline">
                  Clear all
                </Button>
              </div>
            )}
          </header>
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-5 p-5">
            {groups.map(([namespace, entries]) => (
              <fieldset className="w-80 shrink-0" key={namespace}>
                <legend className="mb-2 text-sm font-semibold capitalize">{namespace}</legend>
                <div className="divide-y rounded-md border">
                  {entries.map((permission) => {
                    const disabled = lockedRole || isLockedPermission(selectedRole?.key ?? "", permission.key);
                    const checked = lockedRole || assignedByPermission.has(permission.id);
                    return (
                      <label className={cn("flex items-center gap-3 px-3 py-2.5", disabled && "opacity-65")} key={permission.id}>
                        <Checkbox
                          checked={checked}
                          disabled={disabled || mutations.create.isPending || mutations.forceDelete.isPending}
                          onCheckedChange={(value) => void toggle(permission.id, value === true)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{permission.label}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{permission.key}</span>
                        </span>
                        {checked ? <Check className="ml-auto size-4 text-primary" /> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            </div>
          </div>
        </section>
      </section>
    </WorkspacePage>
  );
}

function groupPermissions(permissions: { id: number; key: string; label: string }[]) {
  return Object.entries(
    permissions.reduce<Record<string, { id: number; key: string; label: string }[]>>((groups, permission) => {
      const namespace = permission.key.split(".")[0] ?? "other";
      groups[namespace] ??= [];
      groups[namespace].push(permission);
      return groups;
    }, {})
  );
}

function isLockedPermission(roleKey: string, permissionKey: string) {
  return roleKey !== "super-admin" && protectedNamespaces.has(permissionKey.split(".")[0] ?? "");
}
