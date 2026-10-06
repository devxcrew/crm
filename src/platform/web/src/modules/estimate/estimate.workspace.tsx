import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "@codexsun/ui/components/sonner";
import { Button } from "@codexsun/ui/components/button";
import { cn } from "@codexsun/ui/lib/utils";
import { WorkspaceFilters } from "@codexsun/ui/workspace/filters";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspacePagination } from "@codexsun/ui/workspace/pagination";
import { buildShowingLabel } from "@codexsun/ui/workspace/utils";
import { EstimateForm } from "./estimate.form";
import {
  useEstimateMutations,
  useEstimateReferencesQuery,
  useEstimatesQuery
} from "./estimate.hooks";
import { EstimateList } from "./estimate.list";
import { getEstimate } from "./estimate.services";
import type {
  Estimate,
  EstimateColumnId,
  EstimateColumnVisibility,
  EstimateSavePayload
} from "./estimate.types";

const estimateColumnOptions: Array<{ id: EstimateColumnId; label: string }> = [
  { id: "name", label: "Estimate" },
  { id: "date", label: "Date" },
  { id: "enquiry", label: "Enquiry" },
  { id: "itemName", label: "Item name" },
  { id: "supplierName", label: "Vendor" },
  { id: "price", label: "Price" }
];

function allEstimateColumnsVisible(): EstimateColumnVisibility {
  return Object.fromEntries(
    estimateColumnOptions.map((column) => [column.id, true])
  ) as EstimateColumnVisibility;
}

export function EstimateWorkspace({
  canCreate,
  canUpdate
}: {
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const query = useEstimatesQuery();
  const mutations = useEstimateMutations();
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [visibleColumns, setVisibleColumns] =
    useState<EstimateColumnVisibility>(allEstimateColumnsVisible);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [editing, setEditing] = useState<Estimate | null | undefined>(undefined);
  const references = useEstimateReferencesQuery(editing !== undefined);
  const vendorOptions = useMemo(
    () => [
      { id: "all", label: "All vendors" },
      ...Array.from(
        new Map(
          (query.data ?? []).map((record) => [
            record.supplier,
            record.supplierName || record.supplier
          ])
        )
      )
        .filter(([id]) => Boolean(id))
        .sort((left, right) => left[1].localeCompare(right[1]))
        .map(([id, label]) => ({ id: `vendor:${id}`, label }))
    ],
    [query.data]
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (record) =>
        (vendorFilter === "all" || `vendor:${record.supplier}` === vendorFilter) &&
        (!term ||
          [record.name, record.enquiry, record.itemName, record.supplier, record.supplierName].some(
            (value) => value.toLowerCase().includes(term)
          ))
    );
  }, [query.data, search, vendorFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const records = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  useEffect(() => setPage(1), [search, vendorFilter]);
  useEffect(() => {
    if (!vendorOptions.some((option) => option.id === vendorFilter)) setVendorFilter("all");
  }, [vendorFilter, vendorOptions]);
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
      const record = editing
        ? await mutations.update.mutateAsync({ name: editing.name, payload: value })
        : await mutations.create.mutateAsync(value);
      toast.success(`Estimate ${editing ? "updated" : "created"}`, {
        description: `${record.name} · ${record.itemName}`
      });
      setEditing(undefined);
    } catch {}
  }

  if (editing !== undefined) {
    return (
      <EstimateForm
        key={editing?.name ?? "new"}
        {...(saveError instanceof Error ? { error: saveError.message } : {})}
        loading={mutations.create.isPending || mutations.update.isPending}
        onCancel={() => setEditing(undefined)}
        onSubmit={(value) => void save(value)}
        record={editing}
        references={references.data}
        referencesLoading={references.isFetching}
      />
    );
  }

  return (
    <WorkspacePage
      actions={
        <div className="flex items-center gap-2">
          <Button
            className="h-9 rounded-md"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            type="button"
            variant="outline"
          >
            <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
            Refresh
          </Button>
          {canCreate ? (
            <Button className="h-9 rounded-md" onClick={() => setEditing(null)} type="button">
              <Plus className="size-4" />
              New estimate
            </Button>
          ) : null}
        </div>
      }
      description="Create and manage estimates stored on the connected Frappe site."
      technicalName="page.application.estimate"
      title="Estimate"
    >
      <WorkspaceFilters
        columnOptions={estimateColumnOptions.map((column) => ({
          ...column,
          checked: visibleColumns[column.id],
          onCheckedChange: (checked) =>
            setVisibleColumns((current) => ({ ...current, [column.id]: checked }))
        }))}
        filterOptions={vendorOptions}
        filterValue={vendorFilter}
        onFilterValueChange={setVendorFilter}
        onSearchValueChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onShowAllColumns={() => setVisibleColumns(allEstimateColumnsVisible())}
        searchPlaceholder="Search estimate, enquiry, item, or vendor"
        searchValue={search}
      />
      <EstimateList
        canUpdate={canUpdate}
        loading={query.isFetching && !query.data}
        onEdit={(record) => void edit(record)}
        records={records}
        visibleColumns={visibleColumns}
      />
      <WorkspacePagination
        onNextPage={() => setPage((value) => Math.min(totalPages, value + 1))}
        onPageChange={setPage}
        onPreviousPage={() => setPage((value) => Math.max(1, value - 1))}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setPage(1);
        }}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        showingLabel={buildShowingLabel(currentPage, rowsPerPage, filtered.length)}
        singularLabel="estimate"
        totalCount={filtered.length}
        totalPages={totalPages}
      />
    </WorkspacePage>
  );
}
