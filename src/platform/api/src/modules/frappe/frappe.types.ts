import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export type FrappeConnectionSettings = {
  appKeyConfigured: boolean;
  appSecretConfigured: boolean;
  baseUrl: string;
  connectionName: string;
  enabled: boolean;
  id: number;
  lastCheckedAt: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
  uuid: string;
  verificationStatus: FrappeConnectionVerificationStatus;
};

export type FrappeConnectionVerificationStatus = "live" | "offline" | "unverified";

export type FrappeConnectionSavePayload = {
  appKey?: string;
  appSecret?: string;
  baseUrl: string;
  connectionName: string;
  enabled: boolean;
  saveToEnvironment: true;
};

export type FrappeConnectionCredentials = {
  apiKey: string;
  apiSecret: string;
  authenticatedUser: string | null;
  baseUrl: string;
  connectionName: string;
  enabled: boolean;
};

export type FrappeConnectionVerificationPayload = {
  appKey?: string;
  appSecret?: string;
  baseUrl: string;
};

export type FrappeConnectionVerificationResult = {
  authenticatedUser: string;
  baseUrl: string;
  checkedAt: string;
  connected: true;
  latencyMs: number;
};

export type FrappeUserVerificationResult = FrappeConnectionVerificationResult & {
  employeeCode: string;
};

export type FrappeLiveEnquiryView = "all" | "assigned" | "created" | "open";

export type FrappeLiveEmployee = {
  email: string;
  name: string;
  title: string;
};

export type FrappeLiveCustomerReference = {
  id: string;
  name: string;
};

export type FrappeLivePartyReference = FrappeLiveCustomerReference & {
  type: "Customer" | "Supplier";
};

export type FrappeLiveEnquiryOptions = {
  groups: Array<{ name: string }>;
  statuses: Array<{
    group: "Closed" | "Hold" | "New" | "Pending";
    name: string;
  }>;
};

export type FrappeLiveEnquiryMessage = {
  comment: string;
  createdAt: string | null;
  createdBy: string | null;
  name: string;
  parentMessage: string | null;
};

export type FrappeLiveJobExecution = {
  createdAt: string;
  date: string | null;
  employee: string;
  employeeCostPerHour: number;
  enquiry: string;
  hours: number;
  name: string;
  startTime: string;
  status: "Cancelled" | "Completed" | "Running";
  stopTime: string | null;
  totalCost: number;
};

export type FrappeLiveJobExecutionSavePayload = {
  employee: string;
  employeeCostPerHour: number;
  startTime: string;
  status: "Cancelled" | "Completed" | "Running";
  stopTime: string | null;
};

export type FrappeLiveEnquiryActivity = {
  action: "added" | "changed" | "edited" | "removed" | "viewed";
  createdAt: string;
  createdBy: string;
  details: string;
  name: string;
};

export type FrappeLiveEnquiry = {
  activities: FrappeLiveEnquiryActivity[];
  assignedToEmployee: string | null;
  createdAt: string;
  customer: string;
  dueDate: string | null;
  enquiryDate: string | null;
  enquiryGroup: string;
  enquiryMessage: string;
  messages: FrappeLiveEnquiryMessage[];
  mobile: string;
  modifiedAt: string;
  modifiedBy: string | null;
  name: string;
  priority: "high" | "low" | "normal" | "urgent";
  status: string;
  statusGroup: "Closed" | "Hold" | "New" | "Pending";
  statusDetails: string;
  title: string;
  userEmployee: string;
};

export type FrappeLiveEnquirySavePayload = {
  assignedToEmployee: string | null;
  customer: string;
  dueDate: string | null;
  enquiryDate: string | null;
  enquiryGroup: string;
  enquiryMessage: string;
  messages: Array<{ comment: string; mode?: "comment" | "reply" }>;
  mobile: string;
  priority: "high" | "low" | "normal" | "urgent";
  status: string;
  statusDetails: string;
  title: string;
};

export type FrappeLiveEnquiryMessageSavePayload = {
  comment: string;
  mode?: "comment" | "reply";
  name?: string;
  parentMessage?: string | null;
};

export type FrappeLiveEnquiryCommentMetricInput = {
  createdAfter: string;
  createdBy: string;
  enquiryNames: string[];
};

export type FrappeLiveEnquiryGateway = {
  create: (input: FrappeLiveEnquirySavePayload) => Promise<FrappeLiveEnquiry>;
  countComments: (input: FrappeLiveEnquiryCommentMetricInput) => Promise<number | null>;
  customers: (search?: string) => Promise<FrappeLiveCustomerReference[]>;
  customersByIds: (ids: string[]) => Promise<FrappeLiveCustomerReference[]>;
  partiesByMobile: (mobile: string) => Promise<FrappeLivePartyReference[]>;
  delete: (name: string) => Promise<void>;
  employees: () => Promise<FrappeLiveEmployee[]>;
  get: (name: string) => Promise<FrappeLiveEnquiry>;
  jobs: (name: string) => Promise<FrappeLiveJobExecution[]>;
  jobsForEnquiries?: (names: string[]) => Promise<Map<string, FrappeLiveJobExecution[]>>;
  createJob: (
    name: string,
    input: FrappeLiveJobExecutionSavePayload
  ) => Promise<FrappeLiveJobExecution>;
  list: (input: { employee: string; view: FrappeLiveEnquiryView }) => Promise<FrappeLiveEnquiry[]>;
  listByMobile: (mobile: string) => Promise<FrappeLiveEnquiry[]>;
  options: () => Promise<FrappeLiveEnquiryOptions>;
  queryReport: (input: {
    filters: Record<string, string | null>;
    reportName: "Enquiry List-In wise Status" | "Enquiry Owner wise Status";
  }) => Promise<{
    columns: Array<{ fieldname: string; label: string }>;
    rows: Array<Record<string, number | string | null>>;
  }>;
  update: (name: string, input: FrappeLiveEnquirySavePayload) => Promise<FrappeLiveEnquiry>;
  updateMessages: (
    name: string,
    messages: FrappeLiveEnquiryMessageSavePayload[],
    status?: string
  ) => Promise<FrappeLiveEnquiry>;
  startJob: (name: string) => Promise<FrappeLiveJobExecution>;
  stopJob: (name: string, jobName: string) => Promise<FrappeLiveJobExecution>;
  updateJob: (
    name: string,
    jobName: string,
    input: FrappeLiveJobExecutionSavePayload
  ) => Promise<FrappeLiveJobExecution>;
};

export type FrappeLiveEnquiryGatewayFactory = (context: {
  database: Kysely<TechMediaDatabase>;
  employee: string | null;
  userId: number;
}) => FrappeLiveEnquiryGateway;

export type FrappeLiveStaffRequestComment = {
  content: string;
  createdAt: string;
  createdBy: string;
  name: string;
};

export type FrappeLiveStaffRequest = {
  comments: FrappeLiveStaffRequestComment[];
  createdAt: string;
  days: number;
  date: string;
  details: string;
  employee: string;
  modifiedAt: string;
  name: string;
  requestType: string;
};

export type FrappeLiveStaffRequestSavePayload = {
  date: string;
  days: number;
  details: string;
  requestType: string;
};

export type FrappeLiveStaffRequestGateway = {
  addApprovalComment: (name: string, content: string) => Promise<FrappeLiveStaffRequest>;
  create: (
    employee: string,
    input: FrappeLiveStaffRequestSavePayload
  ) => Promise<FrappeLiveStaffRequest>;
  get: (name: string) => Promise<FrappeLiveStaffRequest>;
  list: (input: { employee?: string }) => Promise<FrappeLiveStaffRequest[]>;
  update: (
    name: string,
    employee: string,
    input: FrappeLiveStaffRequestSavePayload
  ) => Promise<FrappeLiveStaffRequest>;
};

export type FrappeLiveStaffRequestGatewayFactory = (context: {
  database: Kysely<TechMediaDatabase>;
  employee: string | null;
  userId: number;
}) => FrappeLiveStaffRequestGateway;

export type FrappeLiveSopReport = {
  actions: string;
  createdAt: string;
  date: string;
  name: string;
};

export type FrappeLiveSopDuty = {
  department: string;
  frequency: "Daily" | "Monthly" | "Weekly" | "Yearly";
  index: number;
  reports: FrappeLiveSopReport[];
  sopItem: string;
  sopName: string;
  steps: string;
};

export type FrappeLiveSopDutyGateway = {
  createReport: (input: { actions: string; sopItem: string }) => Promise<FrappeLiveSopReport>;
  list: (employee: string) => Promise<FrappeLiveSopDuty[]>;
};

export type FrappeLiveSopDutyGatewayFactory = (context: {
  database: Kysely<TechMediaDatabase>;
  employee: string | null;
  userId: number;
}) => FrappeLiveSopDutyGateway;

export type FrappeUserPreview = {
  email: string;
  enabled: boolean;
  frappeUserId: string;
  lastActiveAt: string | null;
  localStatus: "active" | "inactive" | "suspended" | null;
  localUserId: number | null;
  name: string;
  userType: string;
};

export type FrappeUserImportResult = {
  created: boolean;
  temporaryPassword: string | null;
  user: {
    email: string;
    id: number;
    name: string;
    status: "active" | "inactive" | "suspended";
    uuid: string;
  };
};

export type FrappeContext = {
  actorEmail: string;
  actorUser: () => Promise<
    | {
        email: string;
        id: number;
        name: string;
        role: string;
        status: string;
        uuid: string;
      }
    | undefined
  >;
  authorize: (permission: string) => Promise<void>;
  database: Kysely<TechMediaDatabase>;
};
