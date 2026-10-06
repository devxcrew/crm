export type HrRequestApproval = {
  approvedAt: string;
  approvedBy: string;
  comment: string;
};

export type HrStaffRequest = {
  approvals: HrRequestApproval[];
  createdAt: string;
  date: string;
  days: number;
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

export type HrStaffRequestView = "all" | "my";

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
