import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

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

export type EstimateContext = {
  actorUser: () => Promise<{ id: number } | undefined>;
  authorize: (permission: string) => Promise<void>;
  can: (permission: string) => Promise<boolean>;
  database: Kysely<TechMediaDatabase>;
};
