import { useEffect, useState } from "react";
import { KeyRoundIcon, PlugZapIcon, SaveIcon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceSwitchCard } from "@codexsun/ui/workspace/status";
import {
  WorkspaceFormActions,
  WorkspaceFormBanner,
  WorkspaceFormBody,
  WorkspaceFormField,
  WorkspaceFormGrid,
  WorkspaceFormSurface
} from "@codexsun/ui/workspace/upsert";
import { frappeConnectionSchema, frappeConnectionVerificationSchema } from "./frappe.schema";
import type {
  FrappeConnectionSavePayload,
  FrappeConnectionSettings,
  FrappeConnectionVerificationPayload
} from "./frappe.types";

type FormValue = {
  appKey: string;
  appSecret: string;
  baseUrl: string;
  connectionName: string;
  enabled: boolean;
  saveToEnvironment: boolean;
};

export function FrappeForm({
  canUpdate,
  error,
  loading,
  onSubmit,
  onVerify,
  settings,
  verificationError,
  verifying
}: {
  canUpdate: boolean;
  error?: string;
  loading: boolean;
  onSubmit: (value: FrappeConnectionSavePayload) => void;
  onVerify: (value: FrappeConnectionVerificationPayload) => void;
  settings: FrappeConnectionSettings | null;
  verificationError?: string;
  verifying: boolean;
}) {
  const [value, setValue] = useState<FormValue>(() => valueFor(settings));
  const [validationError, setValidationError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => setValue(valueFor(settings)), [settings]);

  function validate(
    mode: "save" | "verify"
  ): FrappeConnectionSavePayload | FrappeConnectionVerificationPayload | null {
    const parsed =
      mode === "save"
        ? frappeConnectionSchema.safeParse(value)
        : frappeConnectionVerificationSchema.safeParse(value);
    if (parsed.success) {
      setFieldErrors({});
      setValidationError("");
      return {
        ...(parsed.data.appKey ? { appKey: parsed.data.appKey } : {}),
        ...(parsed.data.appSecret ? { appSecret: parsed.data.appSecret } : {}),
        baseUrl: parsed.data.baseUrl,
        ...(mode === "save"
          ? {
              connectionName: value.connectionName.trim(),
              enabled: value.enabled,
              saveToEnvironment: true as const
            }
          : {})
      };
    }
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !errors[field]) errors[field] = issue.message;
    }
    setFieldErrors(errors);
    setValidationError(Object.values(errors)[0] ?? "Check the connection details.");
    return null;
  }

  const shownError = validationError || verificationError || error;
  const disabled = !canUpdate || loading || verifying;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = validate("save");
        if (parsed) onSubmit(parsed as FrappeConnectionSavePayload);
      }}
    >
      <WorkspaceFormSurface>
        <WorkspaceFormBody>
          {shownError ? (
            <WorkspaceFormBanner title="Frappe connection could not be updated">
              {shownError}
            </WorkspaceFormBanner>
          ) : null}
          <div className="mb-5 flex items-start gap-3 rounded-md border bg-muted/25 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <KeyRoundIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Application connection</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Settings are saved in the application database. Secrets are encrypted and never
                returned to the browser; leave them blank to keep the configured values.
              </p>
            </div>
          </div>
          <WorkspaceFormGrid>
            <WorkspaceFormField label="Connection name" required>
              <Input
                aria-invalid={Boolean(fieldErrors.connectionName)}
                disabled={disabled}
                maxLength={160}
                value={value.connectionName}
                onChange={(event) =>
                  setValue((current) => ({ ...current, connectionName: event.target.value }))
                }
              />
              <FieldError message={fieldErrors.connectionName} />
            </WorkspaceFormField>
            <WorkspaceFormField label="Frappe URL" required>
              <Input
                aria-invalid={Boolean(fieldErrors.baseUrl)}
                disabled={disabled}
                inputMode="url"
                maxLength={500}
                placeholder="https://crm.example.com"
                value={value.baseUrl}
                onChange={(event) =>
                  setValue((current) => ({ ...current, baseUrl: event.target.value }))
                }
              />
              <FieldError message={fieldErrors.baseUrl} />
            </WorkspaceFormField>
            <WorkspaceFormField label="Frappe app key">
              <Input
                aria-invalid={Boolean(fieldErrors.appKey)}
                autoComplete="off"
                disabled={disabled}
                maxLength={2_000}
                placeholder={
                  settings?.appKeyConfigured
                    ? "Configured — leave blank to keep"
                    : "Enter the Frappe app key"
                }
                type="password"
                value={value.appKey}
                onChange={(event) =>
                  setValue((current) => ({ ...current, appKey: event.target.value }))
                }
              />
              <FieldError message={fieldErrors.appKey} />
            </WorkspaceFormField>
            <WorkspaceFormField label="Frappe app secret">
              <Input
                aria-invalid={Boolean(fieldErrors.appSecret)}
                autoComplete="new-password"
                disabled={disabled}
                maxLength={2_000}
                placeholder={
                  settings?.appSecretConfigured
                    ? "Configured — leave blank to keep"
                    : "Enter the Frappe app secret"
                }
                type="password"
                value={value.appSecret}
                onChange={(event) =>
                  setValue((current) => ({ ...current, appSecret: event.target.value }))
                }
              />
              <FieldError message={fieldErrors.appSecret} />
            </WorkspaceFormField>
            <WorkspaceSwitchCard
              activeLabel="Connection enabled"
              ariaLabel="Enable Frappe connection"
              checked={value.enabled}
              className="md:col-span-2"
              description="Live CRM requests use this connection only while it is enabled."
              disabled={disabled}
              fieldLabel="Connection status"
              inactiveLabel="Connection disabled"
              onCheckedChange={(enabled) => setValue((current) => ({ ...current, enabled }))}
            />
          </WorkspaceFormGrid>
        </WorkspaceFormBody>
        {canUpdate ? (
          <WorkspaceFormActions>
            <Button
              disabled={loading || verifying}
              onClick={() => {
                const parsed = validate("verify");
                if (parsed) onVerify(parsed as FrappeConnectionVerificationPayload);
              }}
              type="button"
              variant="outline"
            >
              <PlugZapIcon className="size-4" />
              {verifying ? "Verifying…" : "Verify connection"}
            </Button>
            <Button disabled={loading || verifying} type="submit">
              <SaveIcon className="size-4" />
              {loading ? "Saving…" : "Save connection"}
            </Button>
          </WorkspaceFormActions>
        ) : null}
      </WorkspaceFormSurface>
    </form>
  );
}

function valueFor(settings: FrappeConnectionSettings | null): FormValue {
  return {
    appKey: "",
    appSecret: "",
    baseUrl: settings?.baseUrl ?? "",
    connectionName: settings?.connectionName ?? "Frappe",
    enabled: settings?.enabled ?? true,
    saveToEnvironment: true
  };
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
