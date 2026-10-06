export type Estimate = {
  createdAt: string;
  date: string;
  enquiry: string;
  itemName: string;
  modifiedAt: string;
  name: string;
  price: number;
  supplier: string;
  supplierName: string;
};

export type EstimateSavePayload = {
  date: string;
  enquiry: string;
  itemName: string;
  price: string;
  supplier: string;
};

export type EstimateReference = {
  id: string;
  label: string;
};

export type EstimateReferences = {
  enquiries: EstimateReference[];
  suppliers: EstimateReference[];
};

export type EstimateColumnId = "name" | "date" | "enquiry" | "itemName" | "supplierName" | "price";

export type EstimateColumnVisibility = Record<EstimateColumnId, boolean>;
