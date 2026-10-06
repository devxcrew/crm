import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export type HrRequestApproval = {
  approvedAt: string;
  approvedBy: string;
  comment: string;
};

export type HrStaffRequest = {
  approvals: HrRequestApproval[];
  createdAt: string;
  days: number;
  date: string;
  details: string;
  employee: string;
  modifiedAt: string;
  name: string;
  requestType: string;
};

export type HrStaffRequestSavePayload = {
  date: string;
  days: number;
  details: string;
  requestType: string;
};

export type HrRequestContext = {
  actorEmail: string;
  actorUser: () => Promise<
    | {
        email: string;
        frappeEmployeeCode: string | null;
        id: number;
        name: string;
        role: string;
      }
    | undefined
  >;
  authorize: (permission: string) => Promise<void>;
  database: Kysely<TechMediaDatabase>;
  frappeEmployeeCode: string | null;
};

export type HrDutyReport = {
  actions: string;
  createdAt: string;
  date: string;
  name: string;
};

export type HrDuty = {
  department: string;
  frequency: "Daily" | "Monthly" | "Weekly" | "Yearly";
  index: number;
  reports: HrDutyReport[];
  sopItem: string;
  sopName: string;
  steps: string;
};
