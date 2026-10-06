import { useState } from "react";
import { FilePlus2, Save } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { toast } from "@codexsun/ui/components/sonner";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceUpsertDialog
} from "@codexsun/ui/workspace/upsert";
import { EstimateList } from "./estimate.list";
import {
  useEstimateMutations,
  useEstimateReferencesQuery,
  useEstimatesQuery
} from "./estimate.hooks";
import { estimateSchema } from "./estimate.schema";
import { getEstimate } from "./estimate.services";
import type { Estimate, EstimateReference, EstimateSavePayload } from "./estimate.types";

export function EstimateEnquiryTab({
  canCreate,
  canUpdate,
  enquiry
}: {
  canCreate: boolean;
  canUpdate: boolean;
  enquiry: string;
}) {
  const query = useEstimatesQuery(enquiry);
  const mutations = useEstimateMutations();
  const [editing, setEditing] = useState<Estimate | null | undefined>(undefined);
  const references = useEstimateReferencesQuery(editing !== undefined);
  const saveError = mutations.create.error ?? mutations.update.error ?? references.error;

  async function edit(record: Estimate) {
    try {
      setEditing(await getEstimate(record.name));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The live Frappe estimate could not be loaded."
      );
    }
  }

  async function save(value: EstimateSavePayload) {
    try {
      const payload = { ...value, enquiry };
      const saved = editing
        ? await mutations.update.mutateAsync({ name: editing.name, payload })
        : await mutations.create.mutateAsync(payload);
      toast.success(`Estimate ${editing ? "updated" : "created"}`, {
        description: `${saved.name} · ${saved.itemName}`
      });
      setEditing(undefined);
    } catch {}
  }

  return (
    <section className="min-h-[calc(100dvh-21rem)] bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Estimates linked to this enquiry in live Frappe.
        </p>
        {canCreate ? (
          <Button onClick={() => setEditing(null)} type="button">
            <FilePlus2 className="size-4" />
            New estimate
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <WorkspaceFormBanner title="Estimates could not be loaded">
          {query.error instanceof Error ? query.error.message : "Please try again."}
        </WorkspaceFormBanner>
      ) : (
        <EstimateList
          canUpdate={canUpdate}
          loading={query.isFetching && !query.data}
          onEdit={(record) => void edit(record)}
          records={query.data ?? []}
          visibleColumns={{
            date: true,
            enquiry: false,
            itemName: true,
            name: true,
            price: true,
            supplierName: true
          }}
        />
      )}

      <WorkspaceUpsertDialog
        description={`Enquiry ${enquiry} and the signed-in Frappe user are applied automatically.`}
        onClose={() => setEditing(undefined)}
        open={editing !== undefined}
        title={`${editing ? "Edit" : "New"} estimate`}
      >
        {editing !== undefined ? (
          <EstimateDialogForm
            key={editing?.name ?? "new"}
            {...(saveError instanceof Error ? { error: saveError.message } : {})}
            enquiry={enquiry}
            loading={mutations.create.isPending || mutations.update.isPending}
            onCancel={() => setEditing(undefined)}
            onSubmit={(value) => void save(value)}
            record={editing}
            suppliers={references.data?.suppliers ?? []}
            suppliersLoading={references.isFetching}
          />
        ) : null}
      </WorkspaceUpsertDialog>
    </section>
  );
}

function EstimateDialogForm({
  error,
  enquiry,
  loading,
  onCancel,
  onSubmit,
  record,
  suppliers,
  suppliersLoading
}: {
  error?: string;
  enquiry: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: EstimateSavePayload) => void;
  record: Estimate | null;
  suppliers: EstimateReference[];
  suppliersLoading: boolean;
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
      : { date: today(), enquiry, itemName: "", price: "", supplier: "" }
  );
  const [validationError, setValidationError] = useState("");
  const shownError = validationError || error;

  return (
    <form
      className="space-y-5"
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
      {shownError ? (
        <WorkspaceFormBanner title="Unable to save">{shownError}</WorkspaceFormBanner>
      ) : null}
      <div className="grid gap-5">
        <WorkspaceFormField label="Date" required>
          <Input
            className="h-9"
            required
            type="date"
            value={value.date}
            onChange={(event) => setValue((current) => ({ ...current, date: event.target.value }))}
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
          <WorkspaceLookup
            allowTextValue={false}
            clearable
            compactOptions
            loading={suppliersLoading}
            onValueChange={(supplier) => setValue((current) => ({ ...current, supplier }))}
            options={suppliers.map(referenceOption)}
            placeholder={suppliersLoading ? "Loading..." : "Search vendor"}
            required
            showAllOptionsOnFocus
            value={value.supplier}
          />
        </WorkspaceFormField>
        <WorkspaceFormField label="Price" required>
          <Input
            className="h-9"
            inputMode="decimal"
            placeholder="0.00"
            required
            value={value.price}
            onChange={(event) => setValue((current) => ({ ...current, price: event.target.value }))}
          />
        </WorkspaceFormField>
      </div>
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
          disabled: suppliersLoading
        }}
      />
    </form>
  );
}

function referenceOption(reference: EstimateReference) {
  return {
    label: reference.label === reference.id ? reference.id : `${reference.id} · ${reference.label}`,
    value: reference.id
  };
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
