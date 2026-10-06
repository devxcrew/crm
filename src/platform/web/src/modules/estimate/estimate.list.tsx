import type { WorkspaceColumnDef } from "@codexsun/ui/workspace/table";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import type { Estimate, EstimateColumnVisibility } from "./estimate.types";

export function EstimateList({
  canUpdate,
  loading,
  onEdit,
  records,
  visibleColumns
}: {
  canUpdate: boolean;
  loading: boolean;
  onEdit: (record: Estimate) => void;
  records: Estimate[];
  visibleColumns: EstimateColumnVisibility;
}) {
  const columns: WorkspaceColumnDef<Estimate>[] = [];
  if (visibleColumns.name) {
    columns.push({
      accessorKey: "name",
      cell: ({ row }) =>
        canUpdate ? (
          <button
            className="cursor-pointer font-medium text-foreground hover:underline"
            onClick={() => onEdit(row.original)}
            type="button"
          >
            {row.original.name}
          </button>
        ) : (
          <span className="font-medium">{row.original.name}</span>
        ),
      header: "Estimate"
    });
  }
  if (visibleColumns.date) columns.push({ accessorKey: "date", header: "Date" });
  if (visibleColumns.enquiry) columns.push({ accessorKey: "enquiry", header: "Enquiry" });
  if (visibleColumns.itemName) columns.push({ accessorKey: "itemName", header: "Item name" });
  if (visibleColumns.supplierName) {
    columns.push({
      accessorKey: "supplierName",
      cell: ({ row }) => row.original.supplierName || row.original.supplier,
      header: "Vendor"
    });
  }
  if (visibleColumns.price) {
    columns.push({
      accessorKey: "price",
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.price.toLocaleString(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
          })}
        </div>
      ),
      header: () => <div className="text-right">Price</div>
    });
  }
  if (canUpdate) {
    columns.push({
      cell: ({ row }) => (
        <div className="flex justify-end">
          <WorkspaceRowActions
            onEdit={() => onEdit(row.original)}
            title={`Estimate ${row.original.name}`}
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
      emptyState="No estimates found in Frappe."
      isLoading={loading}
      minWidth="980px"
    />
  );
}
