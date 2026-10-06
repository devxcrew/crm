import { useMemo, useState } from "react";
import { KeyRound, Save, ShieldCheck } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceFormGrid,
  WorkspaceUpsertDialog
} from "@codexsun/ui/workspace/upsert";
import { userSchema } from "./user.schema";
import type {
  User,
  UserAccessOption,
  UserAccessSelection,
  UserFrappeVerification,
  UserSavePayload
} from "./user.types";

type UserFormValue = UserSavePayload & { confirmPassword: string };

const emptyUser: UserFormValue = {
  confirmPassword: "",
  email: "",
  frappeApiKey: "",
  frappeApiSecret: "",
  frappeEmployeeCode: "",
  name: "",
  password: "",
  status: "active"
};

export function UserForm({
  error,
  loading,
  onCancel,
  onSubmit,
  onVerify,
  open,
  record,
  roleOptions,
  selectedAccess,
  verifying
}: {
  error?: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: UserSavePayload, access: UserAccessSelection) => void;
  onVerify: (value: UserSavePayload) => Promise<UserFrappeVerification>;
  open: boolean;
  record: User | null;
  roleOptions: UserAccessOption[];
  selectedAccess: UserAccessSelection;
  verifying: boolean;
}) {
  return (
    <WorkspaceUpsertDialog
      description="Enter the user details and save without leaving the list."
      className="max-h-[calc(100vh-2rem)] overflow-hidden sm:max-w-5xl"
      onClose={onCancel}
      open={open}
      title={`${record ? "Edit" : "New"} user`}
    >
      <UserFormBody
        key={`${record?.id ?? "new"}:${open}:${selectedAccess.roleId ?? "no-role"}`}
        {...(error ? { error } : {})}
        initialValue={
          record
            ? {
                email: record.email,
                confirmPassword: "",
                frappeApiKey: "",
                frappeApiSecret: "",
                frappeEmployeeCode: record.frappeEmployeeCode ?? "",
                name: record.name,
                password: "",
                status: record.status
              }
            : emptyUser
        }
        loading={loading}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onVerify={onVerify}
        record={record}
        roleOptions={roleOptions}
        selectedAccess={selectedAccess}
        verifying={verifying}
      />
    </WorkspaceUpsertDialog>
  );
}

function UserFormBody({
  error,
  initialValue,
  loading,
  onCancel,
  onSubmit,
  onVerify,
  record,
  roleOptions,
  selectedAccess,
  verifying
}: {
  error?: string;
  initialValue: UserFormValue;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: UserSavePayload, access: UserAccessSelection) => void;
  onVerify: (value: UserSavePayload) => Promise<UserFrappeVerification>;
  record: User | null;
  roleOptions: UserAccessOption[];
  selectedAccess: UserAccessSelection;
  verifying: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [access, setAccess] = useState(selectedAccess);
  const [validationError, setValidationError] = useState("");
  const [verification, setVerification] = useState<UserFrappeVerification | null>(null);
  const [verificationError, setVerificationError] = useState("");
  const shownError = validationError || verificationError || error;
  const lookupRoles = useMemo(
    () =>
      roleOptions.map((option) => ({
        label: option.label,
        meta: option.key,
        value: String(option.id),
        ...(option.description ? { description: option.description } : {})
      })),
    [roleOptions]
  );
  function validatedPayload() {
    const parsed = userSchema.safeParse(value);
    const missingCredentialPair =
      Boolean(value.frappeApiKey?.trim()) !== Boolean(value.frappeApiSecret?.trim()) &&
      !(record?.frappeApiKeyConfigured && record.frappeApiSecretConfigured);
    if (!parsed.success || (!record && !value.password) || missingCredentialPair) {
      setValidationError(
        !record && !value.password
          ? "Password must contain at least 8 characters."
          : missingCredentialPair
            ? "Frappe API key and API secret must both be configured."
            : (parsed.error?.issues[0]?.message ?? "Check the user details.")
      );
      return null;
    }
    setValidationError("");
    const {
      confirmPassword: _confirmPassword,
      frappeApiKey,
      frappeApiSecret,
      password,
      ...payload
    } = parsed.data;
    return {
      ...payload,
      ...(frappeApiKey ? { frappeApiKey } : {}),
      ...(frappeApiSecret ? { frappeApiSecret } : {}),
      ...(password ? { password } : {}),
      ...(access.roleId && !record?.isProtected ? { roleId: access.roleId } : {})
    };
  }
  return (
    <form
      className="flex min-h-0 max-h-[calc(100vh-8rem)] flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const payload = validatedPayload();
        if (payload) onSubmit(payload, access);
      }}
    >
      <div className="min-h-0 overflow-y-auto pr-1">
        {shownError ? (
          <WorkspaceFormBanner
            title={verificationError ? "Frappe verification failed" : "Unable to save"}
          >
            {shownError}
          </WorkspaceFormBanner>
        ) : null}
        <WorkspaceFormGrid columns={2} className="items-start gap-5">
          <section className="grid content-start gap-4 rounded-md border border-border/80 bg-muted/10 p-4">
            <div>
              <h3 className="text-sm font-semibold">User details</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Account identity and sign-in credentials.
              </p>
            </div>
            <WorkspaceFormField label="User name" required>
              <Input
                autoFocus
                maxLength={180}
                disabled={Boolean(record?.isProtected)}
                required
                value={value.name}
                onChange={(event) =>
                  setValue((current) => ({ ...current, name: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField label="Email" required>
              <Input
                maxLength={180}
                required
                type="email"
                value={value.email}
                onChange={(event) =>
                  setValue((current) => ({ ...current, email: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField label={record ? "New password" : "Password"} required={!record}>
              <Input
                minLength={8}
                required={!record}
                type="password"
                value={value.password ?? ""}
                onChange={(event) =>
                  setValue((current) => ({ ...current, password: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField
              label={record ? "Confirm new password" : "Confirm password"}
              required={!record || Boolean(value.password)}
            >
              <Input
                aria-invalid={Boolean(value.password && value.password !== value.confirmPassword)}
                autoComplete="new-password"
                className={
                  value.password && value.password !== value.confirmPassword
                    ? "border-destructive"
                    : undefined
                }
                minLength={8}
                required={!record || Boolean(value.password)}
                type="password"
                value={value.confirmPassword}
                onChange={(event) =>
                  setValue((current) => ({ ...current, confirmPassword: event.target.value }))
                }
              />
              {value.password &&
              value.confirmPassword &&
              value.password !== value.confirmPassword ? (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              ) : null}
            </WorkspaceFormField>
          </section>
          <section className="grid content-start gap-4 rounded-md border border-border/80 bg-muted/10 p-4">
            <div>
              <h3 className="text-sm font-semibold">Role assignment</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the workspace role used by this account.
              </p>
            </div>
            <WorkspaceFormField label="Role">
              <WorkspaceLookup
                allowTextValue={false}
                disabled={Boolean(record?.isProtected)}
                options={lookupRoles}
                placeholder="Search roles"
                showAllOptionsOnFocus
                value={access.roleId ? String(access.roleId) : ""}
                onValueChange={(nextValue) =>
                  setAccess({
                    roleId: nextValue ? Number(nextValue) : null
                  })
                }
              />
            </WorkspaceFormField>
            <WorkspaceSwitchCard
              fieldLabel="Status"
              ariaLabel="User active status"
              checked={value.status === "active"}
              disabled={Boolean(record?.isProtected)}
              onCheckedChange={(checked) =>
                setValue((current) => ({ ...current, status: checked ? "active" : "inactive" }))
              }
            />
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="size-4 text-primary" />
                Frappe authentication
              </div>
              {record ? (
                <WorkspaceStatusBadge
                  label={
                    verification
                      ? "Verified"
                      : verificationError
                        ? "Offline"
                        : record.frappeVerificationStatus === "live"
                          ? "Verified"
                          : record.frappeVerificationStatus === "offline"
                            ? "Offline"
                            : record.frappeApiKeyConfigured
                              ? "Unverified"
                              : "Not configured"
                  }
                  tone={
                    verification
                      ? "success"
                      : verificationError
                        ? "danger"
                        : record.frappeVerificationStatus === "live"
                          ? "success"
                          : record.frappeVerificationStatus === "offline"
                            ? "danger"
                            : "neutral"
                  }
                />
              ) : null}
            </div>
            <WorkspaceFormField
              label="Frappe API key"
              required={!record?.frappeApiKeyConfigured && Boolean(value.frappeApiSecret)}
            >
              <Input
                autoComplete="off"
                maxLength={2_000}
                placeholder={
                  record?.frappeApiKeyConfigured
                    ? "Configured — leave blank to keep"
                    : "Enter this user's Frappe API key"
                }
                type="password"
                value={value.frappeApiKey ?? ""}
                onChange={(event) =>
                  setValue((current) => ({ ...current, frappeApiKey: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField
              label="Frappe API secret"
              required={!record?.frappeApiSecretConfigured && Boolean(value.frappeApiKey)}
            >
              <Input
                autoComplete="new-password"
                maxLength={2_000}
                placeholder={
                  record?.frappeApiSecretConfigured
                    ? "Configured — leave blank to keep"
                    : "Enter this user's Frappe API secret"
                }
                type="password"
                value={value.frappeApiSecret ?? ""}
                onChange={(event) =>
                  setValue((current) => ({ ...current, frappeApiSecret: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField label="Employee code">
              <Input
                maxLength={180}
                placeholder="Auto-filled after Frappe verification"
                value={value.frappeEmployeeCode ?? ""}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    frappeEmployeeCode: event.target.value
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Verification resolves the Employee linked to the authenticated Frappe user.
              </p>
            </WorkspaceFormField>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={!record || verifying || loading}
                onClick={() => {
                  const payload = validatedPayload();
                  if (!payload) return;
                  setVerificationError("");
                  void onVerify(payload)
                    .then((result) => {
                      setVerification(result);
                      setValue((current) => ({
                        ...current,
                        frappeEmployeeCode: result.employeeCode
                      }));
                      setVerificationError("");
                    })
                    .catch((verifyError: unknown) =>
                      setVerificationError(
                        verifyError instanceof Error
                          ? verifyError.message
                          : "Frappe verification failed."
                      )
                    );
                }}
                type="button"
                variant="outline"
              >
                <ShieldCheck className="size-4" />
                {verifying ? "Verifying..." : "Verify Frappe connection"}
              </Button>
              {!record ? (
                <span className="text-xs text-muted-foreground">
                  Save the user before verification.
                </span>
              ) : verification ? (
                <span className="text-xs text-emerald-700">
                  Connected as {verification.authenticatedUser} · {verification.employeeCode}
                </span>
              ) : null}
            </div>
          </section>
        </WorkspaceFormGrid>
      </div>
      <WorkspaceFormFooter
        className="mt-4 shrink-0 border-t bg-background pt-4"
        onCancel={onCancel}
        primaryLabel="Save user"
        primaryLoading={loading}
        primaryProps={{
          children: (
            <>
              <Save className="size-4" />
              Save user
            </>
          )
        }}
      />
    </form>
  );
}
