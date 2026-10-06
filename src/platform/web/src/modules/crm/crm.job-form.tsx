import { useState } from "react";
import { Save } from "lucide-react";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceUpsertDialog
} from "@codexsun/ui/workspace/upsert";
import { crmJobSchema } from "./crm.schema";
import type { CrmJobExecution, CrmJobSavePayload, CrmUserReference } from "./crm.types";

type JobFormValue = {
  employee: string;
  employeeCostPerHour: string;
  startTime: string;
  status: CrmJobSavePayload["status"];
  stopTime: string;
};

export function CrmJobForm({
  error,
  loading,
  onCancel,
  onSubmit,
  record,
  users
}: {
  error?: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: CrmJobSavePayload) => void;
  record: CrmJobExecution | null;
  users: CrmUserReference[];
}) {
  const currentTime = localTime();
  const [value, setValue] = useState<JobFormValue>(
    record
      ? {
          employee: record.employee,
          employeeCostPerHour: String(record.employeeCostPerHour),
          startTime: record.startTime,
          status: record.status,
          stopTime: record.stopTime ?? ""
        }
      : {
          employee: "",
          employeeCostPerHour: "0",
          startTime: currentTime,
          status: "Completed",
          stopTime: currentTime
        }
  );
  const [validationError, setValidationError] = useState("");
  const shownError = validationError || error;

  return (
    <WorkspaceUpsertDialog
      description="Supervisors can enter or correct a Frappe Job Execution manually."
      onClose={onCancel}
      open
      title={`${record ? "Edit" : "New"} job`}
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = crmJobSchema.safeParse(value);
          if (!parsed.success) {
            setValidationError(parsed.error.issues[0]?.message ?? "Check the job details.");
            return;
          }
          setValidationError("");
          onSubmit(parsed.data);
        }}
      >
        {shownError ? (
          <WorkspaceFormBanner title="Unable to save">{shownError}</WorkspaceFormBanner>
        ) : null}
        <div className="grid gap-4">
          <WorkspaceFormField label="Employee" required>
            <WorkspaceLookup
              allowTextValue={false}
              clearable
              onValueChange={(employee) => setValue((current) => ({ ...current, employee }))}
              options={users.map((user) => ({
                description: user.email,
                label: user.name,
                value: user.id
              }))}
              placeholder="Search employee"
              required
              showAllOptionsOnFocus
              value={value.employee}
            />
          </WorkspaceFormField>
          <WorkspaceFormField label="Start time" required>
            <Input
              className="h-9"
              required
              step={1}
              type="time"
              value={value.startTime}
              onChange={(event) =>
                setValue((current) => ({ ...current, startTime: event.target.value }))
              }
            />
          </WorkspaceFormField>
          <WorkspaceFormField label="Stop time" required={value.status !== "Running"}>
            <Input
              className="h-9"
              disabled={value.status === "Running"}
              required={value.status !== "Running"}
              step={1}
              type="time"
              value={value.stopTime}
              onChange={(event) =>
                setValue((current) => ({ ...current, stopTime: event.target.value }))
              }
            />
          </WorkspaceFormField>
          <WorkspaceFormField label="Rate/hr" required>
            <Input
              className="h-9"
              inputMode="decimal"
              min="0"
              placeholder="0.00"
              required
              type="number"
              value={value.employeeCostPerHour}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  employeeCostPerHour: event.target.value
                }))
              }
            />
          </WorkspaceFormField>
          <WorkspaceFormField label="Status" required>
            <WorkspaceSelect
              options={[
                { label: "Running", value: "Running" },
                { label: "Completed", value: "Completed" },
                { label: "Cancelled", value: "Cancelled" }
              ]}
              value={value.status}
              onValueChange={(status) =>
                setValue((current) => ({
                  ...current,
                  status: status as CrmJobSavePayload["status"],
                  stopTime: status === "Running" ? "" : current.stopTime || localTime()
                }))
              }
            />
          </WorkspaceFormField>
        </div>
        <WorkspaceFormFooter
          onCancel={onCancel}
          primaryLabel="Save job"
          primaryLoading={loading}
          primaryProps={{
            children: (
              <>
                <Save className="size-4" />
                Save job
              </>
            ),
            disabled: users.length === 0
          }}
        />
      </form>
    </WorkspaceUpsertDialog>
  );
}

function localTime() {
  const date = new Date();
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
