import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceTable } from "@codexsun/ui/workspace/table";
import { apiGet } from "../../shared/api/platform-api";
const labels = { brands: "Brands", catalogs: "Catalogs", categories: "Categories", images: "Product Images", items: "Product Details", products: "Products", variants: "Product Variants" } as const;
export type IshopPage = keyof typeof labels;
export function IshopWorkspace({ page }: { page: IshopPage }) {
  const query = useQuery({ queryKey: ["ishop", page], queryFn: () => apiGet<Array<Record<string, unknown>>>(`/ishop/${page}`) });
  const rows = query.data ?? [];
  const fields = Array.from(new Set(rows.flatMap(Object.keys))).filter((key) => !["name", "modified"].includes(key)).slice(0, 8);
  return <WorkspacePage actions={<Button disabled={query.isFetching} onClick={() => void query.refetch()} type="button" variant="outline"><RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />Refresh</Button>} description="Live LogicX iShop and ERPNext catalog records. CRM stores no iShop data locally." technicalName={`page.ishop.${page}`} title={labels[page]}><WorkspaceTable columns={[{ accessorKey: "name", header: "ID" }, ...fields.map((field) => ({ accessorKey: field, header: field.replaceAll("_", " ") }))]} data={rows} emptyState={`No ${labels[page].toLowerCase()} found in Frappe.`} isLoading={query.isFetching && !query.data} minWidth="960px" /></WorkspacePage>;
}
