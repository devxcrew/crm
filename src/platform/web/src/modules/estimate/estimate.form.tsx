import { useState } from "react";
import { Save } from "lucide-react";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceFormGrid,
  WorkspaceFormPanel,
  WorkspaceUpsertPage
} from "@codexsun/ui/workspace/upsert";
import { estimateSchema } from "./estimate.schema";
import type {
  Estimate,
  EstimateReference,
  EstimateReferences,
  EstimateSavePayload
} from "./estimate.types";

export function EstimateForm({
  error,
  loading,
  onCancel,
  onSubmit,
  record,
  references,
  referencesLoading
}: {
  error?: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: EstimateSavePayload) => void;
  record: Estimate | null;
  references: EstimateReferences | undefined;
  referencesLoading: boolean;
}) {
  const [value, setValue] = useState<EstimateSavePayload>(
    record
      ? {
          date: record.date,
          enquiry: record.enquiry,
          itemName: record.itemName,
          price: String(record.price),
          supplier: record.supplier
        }
      : { date: today(), enquiry: "", itemName: "", price: "", supplier: "" }
  );
  const [validationError, setValidationError] = useState("");
  const shownError = validationError || error;

  return (
    <WorkspaceUpsertPage
      backLabel="Back to estimates"
      className="max-w-6xl"
      description="Estimate data is saved directly to the connected Frappe site."
      onBack={onCancel}
      title={`${record ? "Edit" : "New"} estimate`}
    >
      <form
        className="w-full"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = estimateSchema.safeParse(value);
          if (!parsed.success) {
            setValidationError(parsed.error.issues[0]?.message ?? "Check the estimate details.");
            return;
          }
          setValidationError("");
          onSubmit(parsed.data);
        }}
      >
        <WorkspaceFormPanel
          footer={
            <WorkspaceFormFooter
              onCancel={onCancel}
              primaryLabel="Save estimate"
              primaryLoading={loading}
              primaryProps={{
                children: (
                  <>
                    <Save className="size-4" />
                    Save estimate
                  </>
                ),
                disabled: referencesLoading
              }}
            />
          }
        >
          {shownError ? (
            <WorkspaceFormBanner title="Unable to save">{shownError}</WorkspaceFormBanner>
          ) : null}
          <WorkspaceFormGrid columns={2}>
            <WorkspaceFormField label="Enquiry" required>
              <ReferenceLookup
                loading={referencesLoading}
                onChange={(enquiry) => setValue((current) => ({ ...current, enquiry }))}
                options={references?.enquiries ?? []}
                placeholder="Search enquiry"
                value={value.enquiry}
              />
            </WorkspaceFormField>
            <WorkspaceFormField label="Date" required>
              <Input
                className="h-9"
                required
                type="date"
                value={value.date}
                onChange={(event) =>
                  setValue((current) => ({ ...current, date: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField label="Item name" required>
              <Input
                autoFocus
                className="h-9"
                maxLength={255}
                required
                value={value.itemName}
                onChange={(event) =>
                  setValue((current) => ({ ...current, itemName: event.target.value }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField label="Vendor" required>
              <ReferenceLookup
                loading={referencesLoading}
                onChange={(supplier) => setValue((current) => ({ ...current, supplier }))}
                options={references?.suppliers ?? []}
                placeholder="Search vendor"
                value={value.supplier}
              />
            </WorkspaceFormField>
            <WorkspaceFormField className="md:max-w-sm" label="Price" required>
              <Input
                className="h-9"
                inputMode="decimal"
                placeholder="0.00"
                required
                value={value.price}
                onChange={(event) =>
                  setValue((current) => ({ ...current, price: event.target.value }))
                }
              />
            </WorkspaceFormField>
          </WorkspaceFormGrid>
        </WorkspaceFormPanel>
      </form>
    </WorkspaceUpsertPage>
  );
}

function ReferenceLookup({
  loading,
  onChange,
  options,
  placeholder,
  value
}: {
  loading: boolean;
  onChange: (value: string) => void;
  options: EstimateReference[];
  placeholder: string;
  value: string;
}) {
  return (
    <WorkspaceLookup
      allowTextValue={false}
      clearable
      compactOptions
      dropdownClassName="max-w-xl"
      dropdownMinWidth={320}
      loading={loading}
      onValueChange={onChange}
      options={options.map((option) => ({
        label: option.label === option.id ? option.id : `${option.id} · ${option.label}`,
        value: option.id
      }))}
      placeholder={loading ? "Loading..." : placeholder}
      required
      showAllOptionsOnFocus
      value={value}
    />
  );
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
