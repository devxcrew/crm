import { useEffect, useState } from "react";
import type { WorkspaceColumnDef } from "@codexsun/ui/workspace/table";
import { FilePlus2, Save } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { toast } from "@codexsun/ui/components/sonner";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceFormGrid,
  WorkspaceUpsertDialog
} from "@codexsun/ui/workspace/upsert";
import {
  useQuotationMutations,
  useQuotationReferencesQuery,
  useQuotationsQuery
} from "./quotation.hooks";
import { quotationSchema } from "./quotation.schema";
import { getQuotation } from "./quotation.services";
import type { Quotation, QuotationReference, QuotationSavePayload } from "./quotation.types";

export function QuotationEnquiryTab({
  canCreate,
  canUpdate,
  enquiry
}: {
  canCreate: boolean;
  canUpdate: boolean;
  enquiry: string;
}) {
  const query = useQuotationsQuery(enquiry);
  const mutations = useQuotationMutations(enquiry);
  const [editing, setEditing] = useState<Quotation | null | undefined>(undefined);
  const references = useQuotationReferencesQuery(editing !== undefined);
  const saveError = mutations.create.error ?? mutations.update.error ?? references.error;

  async function edit(record: Quotation) {
    try {
      setEditing(await getQuotation(record.name, enquiry));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The live Frappe quotation could not be loaded."
      );
    }
  }

  async function save(value: QuotationSavePayload) {
    try {
      const saved = editing
        ? await mutations.update.mutateAsync({ name: editing.name, payload: value })
        : await mutations.create.mutateAsync(value);
      toast.success(`Quotation ${editing ? "updated" : "created"}`, {
        description: `${saved.name} · ${saved.customerName}`
      });
      setEditing(undefined);
    } catch {}
  }

  return (
    <section className="min-h-[calc(100dvh-21rem)] bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Quotations linked only to this enquiry in live Frappe.
        </p>
        {canCreate ? (
          <Button onClick={() => setEditing(null)} type="button">
            <FilePlus2 className="size-4" />
            New quotation
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <WorkspaceFormBanner title="Quotations could not be loaded">
          {query.error instanceof Error ? query.error.message : "Please try again."}
        </WorkspaceFormBanner>
      ) : (
        <QuotationTable
          canUpdate={canUpdate}
          loading={query.isFetching && !query.data}
          onEdit={(record) => void edit(record)}
          records={query.data ?? []}
        />
      )}

      <WorkspaceUpsertDialog
        className="sm:max-w-3xl"
        description={`Enquiry ${enquiry}, its Customer, and the signed-in Frappe user are applied automatically.`}
        onClose={() => setEditing(undefined)}
        open={editing !== undefined}
        title={`${editing ? "Edit" : "New"} quotation`}
      >
        {editing !== undefined ? (
          <QuotationDialogForm
            key={editing?.name ?? "new"}
            companies={references.data?.companies ?? []}
            {...(saveError instanceof Error ? { error: saveError.message } : {})}
            items={references.data?.items ?? []}
            loading={mutations.create.isPending || mutations.update.isPending}
            onCancel={() => setEditing(undefined)}
            onSubmit={(value) => void save(value)}
            record={editing}
            referencesLoading={references.isFetching}
          />
        ) : null}
      </WorkspaceUpsertDialog>
    </section>
  );
}

function QuotationTable({
  canUpdate,
  loading,
  onEdit,
  records
}: {
  canUpdate: boolean;
  loading: boolean;
  onEdit: (record: Quotation) => void;
  records: Quotation[];
}) {
  const columns: WorkspaceColumnDef<Quotation>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) =>
        canUpdate ? (
          <button
            className="font-medium text-foreground hover:underline"
            onClick={() => onEdit(row.original)}
            type="button"
          >
            {row.original.name}
          </button>
        ) : (
          <span className="font-medium">{row.original.name}</span>
        ),
      header: "Quotation"
    },
    { accessorKey: "transactionDate", header: "Date" },
    { accessorKey: "validTill", header: "Valid till" },
    {
      accessorKey: "customerName",
      cell: ({ row }) => row.original.customerName || row.original.customer,
      header: "Customer"
    },
    {
      accessorKey: "status",
      cell: ({ row }) => (
        <WorkspaceStatusBadge label={row.original.status || "Draft"} tone="info" />
      ),
      header: "Status"
    },
    {
      accessorKey: "grandTotal",
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.grandTotal.toLocaleString(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
          })}
          {row.original.currency ? ` ${row.original.currency}` : ""}
        </div>
      ),
      header: () => <div className="text-right">Grand total</div>
    },
    { accessorKey: "owner", header: "User" }
  ];
  if (canUpdate) {
    columns.push({
      cell: ({ row }) => (
        <div className="flex justify-end">
          <WorkspaceRowActions
            onEdit={() => onEdit(row.original)}
            title={`Quotation ${row.original.name}`}
          />
        </div>
      ),
      enableSorting: false,
      header: () => <div className="text-right">Action</div>,
      id: "actions",
      size: 72
    });
  }
  return (
    <WorkspaceTable
      columns={columns}
      data={records}
      emptyState="No quotations have been created for this enquiry."
      isLoading={loading}
      minWidth="980px"
    />
  );
}

function QuotationDialogForm({
  companies,
  error,
  items,
  loading,
  onCancel,
  onSubmit,
  record,
  referencesLoading
}: {
  companies: QuotationReference[];
  error?: string;
  items: QuotationReference[];
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: QuotationSavePayload) => void;
  record: Quotation | null;
  referencesLoading: boolean;
}) {
  const firstItem = record?.items[0];
  const [value, setValue] = useState<QuotationSavePayload>(
    record
      ? {
          company: record.company,
          itemCode: firstItem?.itemCode ?? "",
          quantity: String(firstItem?.quantity ?? 1),
          rate: String(firstItem?.rate ?? ""),
          remarks: record.remarks,
          transactionDate: record.transactionDate,
          validTill: record.validTill
        }
      : {
          company: "",
          itemCode: "",
          quantity: "1",
          rate: "",
          remarks: "",
          transactionDate: today(),
          validTill: dateAfterDays(30)
        }
  );
  const [validationError, setValidationError] = useState("");
  const shownError = validationError || error;

  useEffect(() => {
    if (!record && !value.company && companies[0]) {
      setValue((current) => ({ ...current, company: companies[0]!.id }));
    }
  }, [companies, record, value.company]);

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = quotationSchema.safeParse(value);
        if (!parsed.success) {
          setValidationError(parsed.error.issues[0]?.message ?? "Check the quotation details.");
          return;
        }
        setValidationError("");
        onSubmit(parsed.data);
      }}
    >
      {shownError ? (
        <WorkspaceFormBanner title="Unable to save">{shownError}</WorkspaceFormBanner>
      ) : null}
      <WorkspaceFormGrid columns={2}>
        <WorkspaceFormField label="Company" required>
          <ReferenceLookup
            loading={referencesLoading}
            onChange={(company) => setValue((current) => ({ ...current, company }))}
            options={companies}
            placeholder="Choose company"
            value={value.company}
          />
        </WorkspaceFormField>
        <WorkspaceFormField label="Item" required>
          <ReferenceLookup
            loading={referencesLoading}
            onChange={(itemCode) => setValue((current) => ({ ...current, itemCode }))}
            options={items}
            placeholder="Search item"
            value={value.itemCode}
          />
        </WorkspaceFormField>
        <WorkspaceFormField label="Quotation date" required>
          <Input
            className="h-9"
            required
            type="date"
            value={value.transactionDate}
            onChange={(event) =>
              setValue((current) => ({ ...current, transactionDate: event.target.value }))
            }
          />
        </WorkspaceFormField>
        <WorkspaceFormField label="Valid till">
          <Input
            className="h-9"
            type="date"
            value={value.validTill}
            onChange={(event) =>
              setValue((current) => ({ ...current, validTill: event.target.value }))
            }
          />
        </WorkspaceFormField>
        <WorkspaceFormField label="Quantity" required>
          <Input
            className="h-9"
            inputMode="decimal"
            required
            value={value.quantity}
            onChange={(event) =>
              setValue((current) => ({ ...current, quantity: event.target.value }))
            }
          />
        </WorkspaceFormField>
        <WorkspaceFormField label="Rate" required>
          <Input
            className="h-9"
            inputMode="decimal"
            placeholder="0.00"
            required
            value={value.rate}
            onChange={(event) => setValue((current) => ({ ...current, rate: event.target.value }))}
          />
        </WorkspaceFormField>
        <WorkspaceFormField className="md:col-span-2" label="Remarks">
          <Textarea
            maxLength={1000}
            rows={3}
            value={value.remarks}
            onChange={(event) =>
              setValue((current) => ({ ...current, remarks: event.target.value }))
            }
          />
        </WorkspaceFormField>
      </WorkspaceFormGrid>
      <WorkspaceFormFooter
        onCancel={onCancel}
        primaryLabel="Save quotation"
        primaryLoading={loading}
        primaryProps={{
          children: (
            <>
              <Save className="size-4" />
              Save quotation
            </>
          ),
          disabled: referencesLoading
        }}
      />
    </form>
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
  options: QuotationReference[];
  placeholder: string;
  value: string;
}) {
  return (
    <WorkspaceLookup
      allowTextValue={false}
      clearable
      compactOptions
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
  return dateAfterDays(0);
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
