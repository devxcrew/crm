import { AppError } from "@codexsun/framework/errors";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { recordAuditEvent } from "../../database/audit.js";
import type {
  CrmContext,
  CrmContributorReportRow,
  CrmCustomerReference,
  CrmPartyReference,
  CrmEnquiry,
  CrmEnquiryListFilters,
  CrmMobileCallCapturePayload,
  CrmEnquiryMobileMatch,
  CrmEnquiryMessageCreatePayload,
  CrmEnquiryOverview,
  CrmReport,
  CrmReportName,
  CrmStatusReportRow,
  CrmEnquirySavePayload,
  CrmEnquiryStatusFilter,
  CrmEnquiryView,
  CrmJobSavePayload,
  CrmUserReference
} from "./crm.types.js";
import type { NotificationPublisher } from "../notification/notification.types.js";

type LiveGateway = ReturnType<PlatformModuleDependencies["frappeLiveEnquiryGateway"]>;
type LiveRecord = Awaited<ReturnType<LiveGateway["get"]>>;
type LiveMessagePayload = {
  comment: string;
  mode?: "comment" | "reply";
  name?: string;
  parentMessage?: string | null;
};

const viewPermissions: Record<CrmEnquiryView, string> = {
  all: "crm.enquiry.all.view",
  assigned: "crm.enquiry.assigned.view",
  created: "crm.enquiry.created.view",
  open: "crm.enquiry.open.view"
};

const suspendedMessagePrefix = "<s>";
const suspendedMessageSuffix = "</s>";

function isSuspendedMessage(comment: string) {
  const normalized = comment.trim();
  return (
    normalized.startsWith(suspendedMessagePrefix) && normalized.endsWith(suspendedMessageSuffix)
  );
}

function suspendMessage(comment: string) {
  return `${suspendedMessagePrefix}${comment}${suspendedMessageSuffix}`;
}

function messagesForUpdate(messages: LiveRecord["messages"]): LiveMessagePayload[] {
  return messages.map(({ comment, name, parentMessage }) => ({
    comment,
    mode: parentMessage ? ("reply" as const) : ("comment" as const),
    name,
    parentMessage
  }));
}

export class CrmService {
  constructor(
    private readonly context: CrmContext,
    private readonly gateway: LiveGateway,
    private readonly notifications: NotificationPublisher
  ) {}

  async list(filters: CrmEnquiryListFilters) {
    await this.context.authorize(viewPermissions[filters.view]);
    const records = await this.gateway.list({
      employee: this.employee(),
      view: filters.view
    });
    const filtered = records
      .filter((record) => matchesStatus(record, filters.status))
      .filter(
        (record) =>
          !filters.assignedToEmployee ||
          (filters.assignedToEmployee === "__unassigned__"
            ? !record.assignedToEmployee
            : record.assignedToEmployee === filters.assignedToEmployee)
      )
      .filter(
        (record) => !filters.createdByEmployee || record.userEmployee === filters.createdByEmployee
      )
      .filter((record) => !filters.enquiryId || record.name === filters.enquiryId)
      .filter((record) => !filters.enquiryGroup || record.enquiryGroup === filters.enquiryGroup)
      .filter((record) => matchesEnquiryDate(record.enquiryDate, filters.fromDate, filters.toDate))
      .filter((record) => !filters.priority || record.priority === filters.priority)
      .filter((record) => matchesEnquirySearch(record, filters.search));
    const unreadAssignmentResourceIds = await this.notifications.unreadAssignmentResourceIds(
      this.context.actorUserId
    );
    const enquiries = await this.mapMany(filtered, unreadAssignmentResourceIds);
    const jobsByEnquiry = await this.jobsForList(enquiries.map((enquiry) => enquiry.frappeName));
    return enquiries.map((enquiry) => ({
      ...enquiry,
      // Job executions are live Frappe records. Include them in the list so a
      // newly signed-in mobile client can restore an active job control.
      jobs: jobsByEnquiry.get(enquiry.frappeName) ?? []
    }));
  }

  private async jobsForList(enquiryNames: string[]) {
    if (this.gateway.jobsForEnquiries) {
      return this.gateway.jobsForEnquiries(enquiryNames);
    }
    const jobs = await Promise.all(
      enquiryNames.map(async (name) => [name, await this.gateway.jobs(name)] as const)
    );
    return new Map(jobs);
  }

  async options() {
    await this.requireAnyView();
    const options = await this.gateway.options();
    return {
      groups: options.groups.map(({ name }) => ({ label: name, value: name })),
      statuses: options.statuses.map(({ group, name }) => ({
        group: group.toLowerCase() as "closed" | "hold" | "new" | "pending",
        label: name,
        value: statusKey(name)
      }))
    };
  }

  async get(name: string) {
    await this.requireAnyView();
    const record = await this.gateway.get(name);
    await this.authorizeRecord(record);
    return { ...(await this.map(record)), jobs: await this.gateway.jobs(name) };
  }

  async receiveAssignment(name: string) {
    await this.context.authorize(viewPermissions.assigned);
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    const claimedNotificationIds = await this.notifications.claimUnreadAssignments(
      this.context.actorUserId,
      name
    );
    if (!claimedNotificationIds.length) return this.get(name);

    try {
      const messages = messagesForUpdate(current.messages);
      messages.push({ comment: `Job opened by ${this.context.actorName}`, mode: "comment" });
      const record = await this.gateway.updateMessages(name, messages, current.status);
      await this.audit("assignment-opened", record);
      return { ...(await this.map(record)), jobs: await this.gateway.jobs(name) };
    } catch (error) {
      await this.notifications.restoreUnreadAssignments(
        this.context.actorUserId,
        claimedNotificationIds
      );
      throw error;
    }
  }

  async mobileMatches(mobile: string): Promise<CrmEnquiryMobileMatch[]> {
    if (!(await this.canUseMobileHistory())) {
      throw AppError.forbidden("You do not have access to mobile enquiry history.");
    }
    const records = await this.gateway.listByMobile(mobile);
    if (records[0]) records[0] = await this.gateway.get(records[0].name);
    const employees = await this.gateway.employees();
    const byName = new Map(employees.map((employee) => [employee.name, employee]));
    const actorEmployee = this.employee();
    return records.map((record) => mobileMatch(record, byName, actorEmployee));
  }

  async overview(): Promise<CrmEnquiryOverview> {
    await this.requireAnyView();
    const employee = this.employee();
    const listPersonal = async (view: "assigned" | "created"): Promise<LiveRecord[]> =>
      (await this.context.can(viewPermissions[view])) ? this.gateway.list({ employee, view }) : [];
    const [assigned, created, all] = await Promise.all([
      listPersonal("assigned"),
      listPersonal("created"),
      (await this.context.can(viewPermissions.all))
        ? this.gateway.list({ employee, view: "all" })
        : Promise.resolve(null)
    ]);
    const personalRecords = uniqueRecords([...assigned, ...created]);
    const commentsByMeLast30Days = await this.gateway.countComments({
      createdAfter: daysAgoIso(30),
      createdBy: this.context.actorEmail,
      enquiryNames: personalRecords.map((record) => record.name)
    });
    return {
      stats: {
        allEnquiries: all ? overviewGroup(all, this.context.actorEmail) : null,
        myCalls: overviewGroup(created, this.context.actorEmail),
        myJob: overviewGroup(assigned, this.context.actorEmail),
        commentsByMeLast30Days
      }
    };
  }

  async report(name: CrmReportName, filters: Record<string, string | null>): Promise<CrmReport> {
    await this.context.authorize("crm.report.view");
    return this.gateway.queryReport({
      filters,
      reportName:
        name === "list-in-status" ? "Enquiry List-In wise Status" : "Enquiry Owner wise Status"
    });
  }

  async contributorsReport(filters: ReportDateFilters): Promise<CrmContributorReportRow[]> {
    const [records, employees] = await Promise.all([
      this.reportRecords(filters),
      this.gateway.employees()
    ]);
    const employeeNames = new Map(employees.map((employee) => [employee.name, employee.title]));
    return countRecords(records, (record) => record.userEmployee || "Unknown").map(
      ([employee, count]) => ({
        count,
        employee,
        name: employeeNames.get(employee) ?? employee
      })
    );
  }

  async statusReport(filters: ReportDateFilters): Promise<CrmStatusReportRow[]> {
    const [records, options] = await Promise.all([
      this.reportRecords(filters),
      this.gateway.options()
    ]);
    const counts = new Map(countRecords(records, (record) => fromFrappeStatus(record.status)));
    const statuses = new Set([
      ...options.statuses.map(({ name }) => fromFrappeStatus(name)),
      ...counts.keys()
    ]);
    return [...statuses]
      .sort((left, right) => left.localeCompare(right))
      .map((status) => ({ count: counts.get(status) ?? 0, status }));
  }

  async create(input: CrmEnquirySavePayload) {
    await this.context.authorize("crm.enquiry.create");
    await this.validateAssignment(input.assignedToUserId);
    await this.validateCustomer(input.customer);
    const record = await this.gateway.create(toLivePayload(input));
    await this.audit("created", record);
    const mapped = await this.map(record);
    await this.notify(mapped, "assignment", "New call assigned");
    return mapped;
  }

  async captureMobileCall(input: CrmMobileCallCapturePayload) {
    const callTime = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata"
    }).format(new Date(input.occurredAt));
    const direction = input.direction === "incoming" ? "Incoming" : "Outgoing";
    const duration = formatCallDuration(input.durationSeconds);
    const customer = input.customerName.trim();
    const options = await this.gateway.options();
    return this.create({
      assignedToUserId: input.assignedToUserId,
      customer: "",
      enquiryDate: input.occurredAt.slice(0, 10),
      enquiryGroup:
        input.enquiryGroup || (options.groups.some(({ name }) => name === "Calls") ? "Calls" : ""),
      messages: [
        {
          comment: `Call: ${direction} · ${callTime} · ${duration}\n\nCustomer request:\n${input.message.trim()}`
        }
      ],
      mobile: input.mobile,
      priority: "normal",
      schedules: [],
      status: "new",
      title:
        input.title.trim() ||
        (customer ? `${direction} call - ${customer}` : `${direction} call - ${input.mobile}`),
      workspace: input.message.trim()
    });
  }

  async update(name: string, input: CrmEnquirySavePayload) {
    await this.context.authorize("crm.enquiry.update");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    if (input.assignedToUserId !== current.assignedToEmployee) {
      await this.context.authorize("crm.enquiry.assign");
    }
    await this.validateAssignment(input.assignedToUserId);
    await this.validateCustomer(input.customer, current.customer);
    const currentStatus = fromFrappeStatus(current.status);
    const record = await this.gateway.update(name, toLivePayload(input));
    await this.audit("updated", record);
    const mapped = await this.map(record);
    if (input.assignedToUserId !== current.assignedToEmployee) {
      await this.notify(mapped, "assignment", "Call assigned");
    } else if (input.status !== currentStatus) {
      await this.notify(mapped, "status", `Status: ${statusLabel(mapped.status)}`);
    }
    return { ...mapped, jobs: await this.gateway.jobs(name) };
  }

  async forceDelete(name: string) {
    await this.context.authorize("crm.enquiry.force-delete");
    const current = await this.gateway.get(name);
    await this.gateway.delete(name);
    await this.audit("deleted", current);
    return this.map(current);
  }

  async addMessage(name: string, input: CrmEnquiryMessageCreatePayload) {
    await this.context.authorize("crm.enquiry.update");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    const messages = messagesForUpdate(current.messages);
    const comment = input.comment.trim();
    if (!plainText(comment)) throw AppError.validation("Comment cannot be empty.");
    const parentMessage =
      input.messageType === "reply"
        ? input.parentMessageId ||
          [...current.messages].reverse().find((message) => !message.parentMessage)?.name ||
          null
        : null;
    if (input.messageType === "reply" && !parentMessage) {
      throw AppError.validation("Add a comment before adding a reply.");
    }
    messages.push({ comment, mode: input.messageType, parentMessage });
    const mapped = await this.map(
      await this.gateway.updateMessages(name, messages, current.status)
    );
    await this.notify(
      mapped,
      input.messageType,
      input.messageType === "reply" ? "New reply" : "New comment"
    );
    return { ...mapped, jobs: await this.gateway.jobs(name) };
  }

  async suspendMessage(name: string, messageId: string) {
    await this.context.authorize("crm.enquiry.update");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    const index = current.messages.findIndex((message) => message.name === messageId);
    if (index < 0) throw AppError.notFound("Conversation entry was not found in Frappe.");
    if (index !== current.messages.length - 1) {
      throw AppError.conflict("Only the latest conversation entry can be suspended.");
    }
    if (isSuspendedMessage(current.messages[index]!.comment)) {
      throw AppError.conflict("This conversation entry is already suspended.");
    }
    const messages = current.messages.map(
      ({ comment, name: childName, parentMessage }, messageIndex) => ({
        comment: messageIndex === index ? suspendMessage(comment) : comment,
        ...(parentMessage ? { mode: "reply" as const } : { mode: "comment" as const }),
        name: childName,
        parentMessage
      })
    );
    return this.map(await this.gateway.updateMessages(name, messages, current.status));
  }

  async startJob(name: string) {
    await this.context.authorize("crm.enquiry.update");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    const jobs = await this.gateway.jobs(name);
    if (jobs.filter((job) => job.status === "Running").length > 0) {
      throw AppError.conflict("A job is already running for this enquiry.");
    }
    await this.gateway.startJob(name);
    return this.get(name);
  }

  async createJob(name: string, input: CrmJobSavePayload) {
    await this.context.authorize("crm.job.manage");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    await this.validateJob(input);
    const jobs = await this.gateway.jobs(name);
    if (input.status === "Running" && jobs.some((job) => job.status === "Running")) {
      throw AppError.conflict("A job is already running for this enquiry.");
    }
    await this.gateway.createJob(name, input);
    return this.get(name);
  }

  async updateJob(name: string, jobName: string, input: CrmJobSavePayload) {
    await this.context.authorize("crm.job.manage");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    await this.validateJob(input);
    const jobs = await this.gateway.jobs(name);
    if (!jobs.some((job) => job.name === jobName)) {
      throw AppError.notFound("Job was not found against this enquiry in Frappe.");
    }
    if (
      input.status === "Running" &&
      jobs.some((job) => job.name !== jobName && job.status === "Running")
    ) {
      throw AppError.conflict("A different job is already running for this enquiry.");
    }
    await this.gateway.updateJob(name, jobName, input);
    return this.get(name);
  }

  async stopJob(name: string, jobName: string) {
    await this.context.authorize("crm.enquiry.update");
    const current = await this.gateway.get(name);
    await this.authorizeRecord(current);
    await this.gateway.stopJob(name, jobName);
    return this.get(name);
  }

  async userReferences() {
    await this.requireAnyView();
    return (await this.gateway.employees()).map(employeeReference);
  }

  async customerReferences(search?: string): Promise<CrmCustomerReference[]> {
    await this.requireAnyView();
    return this.gateway.customers(search);
  }

  async partiesByMobile(mobile: string): Promise<CrmPartyReference[]> {
    await this.requireAnyView();
    return this.gateway.partiesByMobile(mobile);
  }

  async enquiryReferences() {
    await this.requireAnyView();
    const records = await this.gateway.list({ employee: this.employee(), view: "created" });
    return records.map((record) => ({ id: record.name, title: displayTitle(record) }));
  }

  private async reportRecords(filters: ReportDateFilters) {
    await this.context.authorize("crm.report.view");
    await this.context.authorize(viewPermissions.all);
    const records = await this.gateway.list({ employee: this.employee(), view: "all" });
    return records.filter((record) =>
      matchesEnquiryDate(
        record.enquiryDate,
        filters.fromDate ?? undefined,
        filters.toDate ?? undefined
      )
    );
  }

  private async mapMany(records: LiveRecord[], unreadAssignmentResourceIds = new Set<string>()) {
    const [employees, customers] = await Promise.all([
      this.gateway.employees(),
      this.gateway.customersByIds(records.map((record) => record.customer))
    ]);
    const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
    return Promise.all(
      records.map((record) =>
        this.map(record, employees, customerNames, unreadAssignmentResourceIds.has(record.name))
      )
    );
  }

  private async map(
    record: LiveRecord,
    knownEmployees?: Awaited<ReturnType<LiveGateway["employees"]>>,
    knownCustomerNames?: ReadonlyMap<string, string>,
    hasUnreadAssignment = false
  ) {
    const [employees, customers] = await Promise.all([
      knownEmployees ?? this.gateway.employees(),
      knownCustomerNames ? Promise.resolve([]) : this.gateway.customersByIds([record.customer])
    ]);
    const byName = new Map(employees.map((employee) => [employee.name, employee]));
    const customerName = knownCustomerNames?.get(record.customer) ?? customers[0]?.name ?? "";
    const assigned = record.assignedToEmployee
      ? (byName.get(record.assignedToEmployee) ?? {
          email: "",
          name: record.assignedToEmployee,
          title: record.assignedToEmployee
        })
      : null;
    const created = byName.get(record.userEmployee) ?? {
      email: "",
      name: record.userEmployee || "Frappe",
      title: record.userEmployee || "Frappe"
    };
    return {
      activities: record.activities.map((entry) => ({
        action: entry.action,
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
        createdByUserId: numericId(entry.createdBy),
        details: entry.details,
        id: numericId(entry.name),
        uuid: entry.name
      })),
      assignedTo: assigned ? employeeReference(assigned) : null,
      // Frappe assignments are keyed by Employee name, while the visible title is only for display.
      assignedToUserId: record.assignedToEmployee,
      attachments: [],
      calls: [],
      createdAt: record.createdAt,
      createdBy: employeeReference(created),
      createdByUserId: created.name,
      customer: record.customer,
      customerName,
      hasUnreadAssignment,
      enquiryDate: record.enquiryDate,
      enquiryGroup: record.enquiryGroup,
      emails: [],
      frappeName: record.name,
      id: numericId(record.name),
      jobs: [],
      lifecycleStatus: "active" as const,
      messages: record.messages.map((message, index) => ({
        canSuspend:
          index === record.messages.length - 1 &&
          !record.messages.some((candidate) => candidate.parentMessage === message.name) &&
          !isSuspendedMessage(message.comment),
        comment: message.comment,
        createdAt: message.createdAt ?? record.modifiedAt,
        createdByUserId: message.createdBy,
        id: message.name,
        isSuspended: isSuspendedMessage(message.comment),
        messageType: message.parentMessage ? ("reply" as const) : ("comment" as const),
        parentMessageId: message.parentMessage
      })),
      mobile: record.mobile,
      notes: [],
      priority: record.priority,
      schedules: record.dueDate ? [{ id: `${record.name}-due`, scheduledOn: record.dueDate }] : [],
      status: fromFrappeStatus(record.status),
      statusGroup: record.statusGroup.toLowerCase() as CrmEnquiry["statusGroup"],
      statusDetails: record.statusDetails,
      tasks: [],
      title: record.title || displayTitle(record),
      updatedAt: record.modifiedAt,
      updatedByUserId: record.modifiedBy,
      uuid: record.name,
      workspace: record.enquiryMessage
    } satisfies CrmEnquiry;
  }

  private async authorizeRecord(record: LiveRecord) {
    const employee = this.employee();
    const allowed =
      (record.assignedToEmployee === employee &&
        (await this.context.can(viewPermissions.assigned))) ||
      (record.userEmployee === employee && (await this.context.can(viewPermissions.created))) ||
      (!record.assignedToEmployee &&
        record.statusGroup !== "Closed" &&
        (await this.context.can(viewPermissions.open)));
    if (allowed || (await this.canUseMobileHistory())) return;
    throw AppError.forbidden("You do not have access to this enquiry.");
  }

  private async canUseMobileHistory() {
    return (
      (await this.context.can("crm.enquiry.mobile.lookup")) ||
      (await this.context.can("crm.enquiry.create"))
    );
  }

  private async validateAssignment(value: string | null) {
    if (!value) return;
    const employees = await this.gateway.employees();
    if (!employees.some((employee) => employee.name === value)) {
      throw AppError.validation("Assigned employee must be an active Frappe Employee.");
    }
  }

  private async validateCustomer(value: string, currentValue = "") {
    const customer = value.trim();
    if (!customer) return;
    if (customer === currentValue.trim()) return;
    const matches = await this.gateway.customers(customer);
    if (!matches.some((match) => match.id === customer)) {
      throw AppError.validation("Select an existing Frappe customer from the customer lookup.");
    }
  }

  private async validateJob(input: CrmJobSavePayload) {
    const employees = await this.gateway.employees();
    if (!employees.some((employee) => employee.name === input.employee)) {
      throw AppError.validation("Job employee must be an active Frappe Employee.");
    }
    if (input.status !== "Running" && !input.stopTime) {
      throw AppError.validation("Stop time is required for a completed or cancelled job.");
    }
  }

  private async requireAnyView() {
    if (
      !(await this.context.can(viewPermissions.assigned)) &&
      !(await this.context.can(viewPermissions.created)) &&
      !(await this.context.can(viewPermissions.open))
    ) {
      throw AppError.forbidden("CRM enquiry access is required.");
    }
  }

  private employee() {
    const employee = this.context.frappeEmployeeCode?.trim();
    if (!employee) {
      throw AppError.conflict(
        "Sign in again after linking the Frappe user to an Employee. CRM uses that verified session mapping."
      );
    }
    return employee;
  }

  private async audit(action: string, record: LiveRecord) {
    await recordAuditEvent({
      action,
      actorEmail: this.context.actorEmail,
      moduleKey: "crm.enquiry.live",
      recordId: numericId(record.name),
      recordLabel: displayTitle(record),
      recordUuid: record.name
    });
  }

  private async notify(
    record: CrmEnquiry,
    type: "assignment" | "comment" | "reply" | "status",
    title: string
  ) {
    try {
      await this.notifications.enqueue({
        actorUserId: this.context.actorUserId,
        body: notificationSummary(record),
        recipientEmployeeCode: record.assignedToUserId,
        resourceId: record.frappeName,
        title,
        type
      });
    } catch (error) {
      console.error("[notification.enqueue]", error);
    }
  }
}

type ReportDateFilters = { fromDate: string | null; toDate: string | null };

function countRecords(records: LiveRecord[], keyFor: (record: LiveRecord) => string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = keyFor(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    ([leftKey, leftCount], [rightKey, rightCount]) =>
      rightCount - leftCount || leftKey.localeCompare(rightKey)
  );
}

function toLivePayload(input: CrmEnquirySavePayload) {
  return {
    assignedToEmployee: input.assignedToUserId,
    customer: input.customer.trim(),
    dueDate: input.schedules[0]?.scheduledOn ?? null,
    enquiryDate: input.enquiryDate,
    enquiryGroup: input.enquiryGroup.trim(),
    enquiryMessage: input.workspace.trim() || input.title.trim(),
    messages: input.messages
      .map(({ comment, mode }) => ({ comment: comment.trim(), ...(mode ? { mode } : {}) }))
      .filter(({ comment }) => plainText(comment)),
    mobile: input.mobile.trim(),
    priority: input.priority,
    status: input.status,
    statusDetails: input.statusDetails?.trim() ?? "",
    title: input.title.trim() || titleFromWorkspace(input.workspace)
  };
}

function formatCallDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function employeeReference(employee: {
  email: string;
  name: string;
  title: string;
}): CrmUserReference {
  return {
    email: employee.email || `${employee.name}@frappe.local`,
    id: employee.name,
    name: employee.title,
    uuid: employee.name
  };
}

function mobileMatch(
  record: LiveRecord,
  byName: Map<string, Awaited<ReturnType<LiveGateway["employees"]>>[number]>,
  actorEmployee: string
): CrmEnquiryMobileMatch {
  const assigned = record.assignedToEmployee ? byName.get(record.assignedToEmployee) : undefined;
  const status = fromFrappeStatus(record.status);
  const closure = closedDetails(record);
  return {
    assignedTo: assigned ? employeeReference(assigned) : null,
    canEdit: isFreshForActor(record, actorEmployee),
    closedAt: closure?.createdAt ?? null,
    closedBy: closure?.createdBy ?? null,
    createdAt: record.createdAt,
    frappeName: record.name,
    id: numericId(record.name),
    status,
    statusGroup: record.statusGroup.toLowerCase() as CrmEnquiry["statusGroup"],
    title: record.title || displayTitle(record)
  };
}

function closedDetails(record: LiveRecord) {
  if (record.statusGroup !== "Closed") return null;
  const target = record.status.toLowerCase();
  const transition = record.activities.find((entry) => {
    const details = entry.details.toLowerCase();
    return (
      entry.action === "changed" &&
      details.includes("status from") &&
      details.includes(`to ${target}`)
    );
  });
  return {
    createdAt: transition?.createdAt ?? record.modifiedAt,
    createdBy: transition?.createdBy ?? readableFrappeUser(record.modifiedBy)
  };
}

function readableFrappeUser(value: string | null) {
  if (!value) return "Frappe";
  return (
    value
      .split("@")[0]!
      .split(/[._-]+/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || value
  );
}

function isFreshForActor(record: LiveRecord, actorEmployee: string) {
  // Creation may store the enquiry text as the first child row; later rows are follow-up comments.
  return record.userEmployee === actorEmployee && record.messages.length <= 1;
}

function displayTitle(record: Pick<LiveRecord, "enquiryMessage" | "name">) {
  return plainText(record.enquiryMessage) || record.name;
}

function titleFromWorkspace(value: string) {
  return plainText(value).split(/\s+/u).slice(0, 8).join(" ") || "Enquiry";
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<\/p\s*>/giu, " ")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Search stays within the live, permission-scoped enquiry list. Frappe's resource
 * filters are AND-only for this query, so applying it here gives one consistent
 * match across all enquiry columns rather than restricting search to the document ID.
 */
function matchesEnquirySearch(record: LiveRecord, search?: string) {
  const terms = (search ?? "")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/u)
    .map((term) => term.replace(/^#+/u, ""))
    .filter(Boolean);
  if (!terms.length) return true;
  const searchable = [
    record.name,
    String(numericId(record.name)),
    record.enquiryMessage,
    record.mobile,
    record.customer
  ]
    .map((value) => plainText(value).toLocaleLowerCase())
    .join(" ");
  return terms.every((term) => searchable.includes(term));
}

function matchesEnquiryDate(enquiryDate: string | null, fromDate?: string, toDate?: string) {
  if (!fromDate && !toDate) return true;
  if (!enquiryDate) return false;
  return (!fromDate || enquiryDate >= fromDate) && (!toDate || enquiryDate <= toDate);
}

function numericId(name: string) {
  const digits = name.match(/\d+/g)?.join("");
  if (digits) return Math.max(Number(digits) % 2_147_483_647, 1);
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return Math.max(hash % 2_147_483_647, 1);
}

function fromFrappeStatus(value: string): CrmEnquiry["status"] {
  return statusKey(value);
}

function statusKey(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return key === "re-open" ? "reopen" : key;
}

function statusLabel(value: CrmEnquiry["status"]) {
  return value.replace(/-/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function notificationSummary(record: CrmEnquiry) {
  return `#${record.id} · ${shortText(record.title || record.workspace || "Call", 90)}`;
}

function shortText(value: string, limit: number) {
  const plain = plainText(value);
  return plain.length > limit ? `${plain.slice(0, limit - 3).trimEnd()}...` : plain;
}

function isInProgress(record: LiveRecord) {
  return record.statusGroup === "Hold" || record.statusGroup === "Pending";
}

function overviewGroup(records: LiveRecord[], actorEmail: string) {
  const priorityCounts = new Map<CrmEnquiry["priority"], number>();
  const statusCounts = new Map<
    CrmEnquiry["status"],
    { count: number; statusGroup: CrmEnquiry["statusGroup"] }
  >();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86_400_000;
  const thirtyDaysAgo = now - 30 * 86_400_000;
  let createdLast7Days = 0;
  let createdLast30Days = 0;
  let reactionsLast7Days = 0;
  let reactionsLast30Days = 0;
  let updatedLast7Days = 0;
  let updatedLast30Days = 0;
  let oldestActiveDays = 0;
  let inProgress = 0;

  for (const record of records) {
    const status = fromFrappeStatus(record.status);
    const createdAt = Date.parse(record.createdAt);
    const modifiedAt = Date.parse(record.modifiedAt);
    priorityCounts.set(record.priority, (priorityCounts.get(record.priority) ?? 0) + 1);
    const statusCount = statusCounts.get(status);
    statusCounts.set(status, {
      count: (statusCount?.count ?? 0) + 1,
      statusGroup: record.statusGroup.toLowerCase() as CrmEnquiry["statusGroup"]
    });
    if (createdAt >= sevenDaysAgo) createdLast7Days += 1;
    if (createdAt >= thirtyDaysAgo) createdLast30Days += 1;
    if (modifiedAt >= sevenDaysAgo) updatedLast7Days += 1;
    if (modifiedAt >= thirtyDaysAgo) updatedLast30Days += 1;
    if (record.modifiedBy === actorEmail && modifiedAt >= sevenDaysAgo) reactionsLast7Days += 1;
    if (record.modifiedBy === actorEmail && modifiedAt >= thirtyDaysAgo) reactionsLast30Days += 1;
    if (isInProgress(record)) inProgress += 1;
    if (record.statusGroup !== "Closed") {
      oldestActiveDays = Math.max(oldestActiveDays, elapsedDays(record.createdAt));
    }
  }

  return {
    activity: {
      createdLast7Days,
      createdLast30Days,
      reactionsLast7Days,
      reactionsLast30Days,
      updatedLast7Days,
      updatedLast30Days
    },
    inProgress,
    oldestActiveDays,
    priorityCounts: [...priorityCounts]
      .map(([priority, count]) => ({ count, priority }))
      .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority)),
    statusCounts: [...statusCounts]
      .map(([status, { count, statusGroup }]) => ({ count, status, statusGroup }))
      .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status)),
    total: records.length
  };
}

function uniqueRecords(records: LiveRecord[]) {
  return [...new Map(records.map((record) => [record.name, record])).values()];
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function priorityRank(priority: CrmEnquiry["priority"]) {
  return { urgent: 0, high: 1, normal: 2, low: 3 }[priority];
}

function elapsedDays(timestamp: string) {
  const createdAt = Date.parse(timestamp);
  if (Number.isNaN(createdAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000));
}

function matchesStatus(record: LiveRecord, filter?: CrmEnquiryStatusFilter) {
  if (!filter || filter === "active") return record.statusGroup !== "Closed";
  if (filter === "all") return true;
  if (filter === "closed") return record.statusGroup === "Closed";
  if (filter === "hold") return record.statusGroup === "Hold";
  if (filter === "in-progress") return isInProgress(record);
  if (filter === "other") return record.statusGroup === "New";
  return fromFrappeStatus(record.status) === filter;
}
