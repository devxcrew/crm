import { AppError } from "@codexsun/framework/errors";
import { frappeConnectionContract, frappeRequest } from "./frappe.service.js";
import type {
  FrappeConnectionCredentials,
  FrappeLiveEmployee,
  FrappeLiveEnquiry,
  FrappeLiveEnquiryActivity,
  FrappeLiveEnquiryGatewayFactory,
  FrappeLiveEnquiryOptions,
  FrappeLiveEnquirySavePayload,
  FrappeLiveJobExecutionSavePayload
} from "./frappe.types.js";

const enquiryFields = [
  "name",
  "mobile",
  "customer",
  "due_date",
  "enquiry_details",
  "group",
  "user_employee",
  "date",
  "assigned_to_employee",
  "priority",
  "status",
  "status_details",
  "title",
  "creation",
  "date",
  "modified",
  "modified_by"
];

export const frappeLiveEnquiryGatewayContract: FrappeLiveEnquiryGatewayFactory = (context) => {
  async function connection() {
    const value = await frappeConnectionContract({
      database: context.database,
      userId: context.userId
    }).get();
    if (!value?.enabled) {
      throw AppError.conflict("Enable the Frappe connection before opening CRM.");
    }
    if (!value.authenticatedUser) {
      throw AppError.conflict(
        "This user's Frappe API credentials must be verified once before opening CRM."
      );
    }
    return value;
  }

  function employee() {
    const value = context.employee?.trim();
    if (!value) {
      throw AppError.conflict(
        "The signed-in Frappe user must be linked to an Employee before using CRM."
      );
    }
    return value;
  }

  async function loadJobs(name: string) {
    const target = await connection();
    const enquiryName = requiredName(name);
    const response = await frappeRequest<{
      data?: FrappeJobExecutionDocument[];
      message?: FrappeJobExecutionDocument[];
    }>(target, "/api/v2/method/frappe.client.get_list", {
      body: JSON.stringify({
        doctype: "Job Execution",
        fields: jobExecutionFields,
        filters: [["enquiry", "=", enquiryName]],
        order_by: "creation desc"
      }),
      method: "POST"
    });
    return (response.data ?? response.message ?? []).map(toJobExecution);
  }

  async function loadJobsForEnquiries(names: string[]) {
    const enquiryNames = [...new Set(names.map(requiredName))];
    const jobsByEnquiry = new Map<string, import("./frappe.types.js").FrappeLiveJobExecution[]>();
    for (const name of enquiryNames) jobsByEnquiry.set(name, []);
    if (!enquiryNames.length) return jobsByEnquiry;

    const target = await connection();
    const responses = await Promise.all(
      chunk(enquiryNames, 100).map((namesBatch) => loadJobBatch(target, namesBatch))
    );
    for (const document of responses.flat()) {
      const job = toJobExecution(document);
      const enquiryName = document.enquiry?.trim();
      if (enquiryName && jobsByEnquiry.has(enquiryName)) {
        jobsByEnquiry.get(enquiryName)?.push(job);
      }
    }
    return jobsByEnquiry;
  }

  async function loadJobBatch(connection: FrappeConnectionCredentials, names: string[]) {
    const jobs: FrappeJobExecutionDocument[] = [];
    for (let offset = 0; ; offset += 500) {
      const response = await frappeRequest<{
        data?: FrappeJobExecutionDocument[];
        message?: FrappeJobExecutionDocument[];
      }>(connection, "/api/v2/method/frappe.client.get_list", {
        body: JSON.stringify({
          doctype: "Job Execution",
          fields: jobExecutionFields,
          filters: [["enquiry", "in", names]],
          limit_page_length: 500,
          limit_start: offset,
          order_by: "creation desc"
        }),
        method: "POST"
      });
      const page = response.data ?? response.message ?? [];
      jobs.push(...page);
      if (page.length < 500) return jobs;
    }
  }

  async function loadCustomers(search = "") {
    const target = await connection();
    const normalizedSearch = search.trim();
    const fields = normalizedSearch ? ["customer_name", "name"] : ["customer_name"];
    const responses = await Promise.all(
      fields.map(async (field) => {
        const filters: unknown[] = [["disabled", "=", 0]];
        if (normalizedSearch) filters.push([field, "like", `%${normalizedSearch}%`]);
        const query = new URLSearchParams({
          fields: JSON.stringify(["name", "customer_name"]),
          filters: JSON.stringify(filters),
          limit_page_length: "50",
          order_by: "customer_name asc"
        });
        return frappeRequest<{ data?: FrappeCustomerDocument[] }>(
          target,
          `/api/resource/Customer?${query}`
        );
      })
    );
    const customers = new Map<string, import("./frappe.types.js").FrappeLiveCustomerReference>();
    for (const document of responses.flatMap((response) => response.data ?? [])) {
      const id = document.name?.trim();
      if (!id) continue;
      customers.set(id, {
        id,
        name: document.customer_name?.trim() || id
      });
    }
    return [...customers.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 50);
  }

  async function loadCustomersByIds(ids: string[]) {
    const customerIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!customerIds.length) return [];

    const target = await connection();
    const responses = await Promise.all(
      chunk(customerIds, 50).map((customerBatch) => {
        const query = new URLSearchParams({
          fields: JSON.stringify(["name", "customer_name"]),
          filters: JSON.stringify([["name", "in", customerBatch]]),
          limit_page_length: String(customerBatch.length)
        });
        return frappeRequest<{ data?: FrappeCustomerDocument[] }>(
          target,
          `/api/resource/Customer?${query}`
        );
      })
    );
    return responses
      .flatMap((response) => response.data ?? [])
      .flatMap((document) => {
        const id = document.name?.trim();
        return id ? [{ id, name: document.customer_name?.trim() || id }] : [];
      });
  }

  async function loadPartiesByMobile(mobile: string) {
    const target = await connection();
    const parties = await Promise.all(
      (["Customer", "Supplier"] as const).map(async (type) => {
        const query = new URLSearchParams({
          fields: JSON.stringify(["name", type === "Customer" ? "customer_name" : "supplier_name"]),
          filters: JSON.stringify([["mobile_no", "=", mobile]]),
          limit_page_length: "20"
        });
        const response = await frappeRequest<{ data?: FrappePartyDocument[] }>(
          target,
          `/api/resource/${type}?${query}`
        );
        return (response.data ?? []).flatMap((document) => {
          const id = document.name?.trim();
          const name = (document.customer_name ?? document.supplier_name)?.trim() || id;
          return id && name ? [{ id, name, type }] : [];
        });
      })
    );
    return parties.flat().sort((left, right) => left.name.localeCompare(right.name));
  }

  async function loadEnquiryOptions(
    suppliedTarget?: FrappeConnectionCredentials
  ): Promise<FrappeLiveEnquiryOptions> {
    const target = suppliedTarget ?? (await connection());
    const [groups, statuses] = await Promise.all([
      frappeRequest<{ data?: FrappeEnquiryGroupDocument[] }>(
        target,
        referenceListUrl("Enquiry Group", ["name", "group_name"])
      ),
      frappeRequest<{ data?: FrappeEnquiryStatusDocument[] }>(
        target,
        referenceListUrl("Enquiry Status", ["name", "status_name", "status_group"])
      )
    ]);
    return {
      groups: (groups.data ?? []).flatMap((document) => {
        const name = document.group_name?.trim() || document.name?.trim();
        return name ? [{ name }] : [];
      }),
      statuses: (statuses.data ?? []).flatMap((document) => {
        const name = document.status_name?.trim() || document.name?.trim();
        const group = enquiryStatusGroup(document.status_group);
        return name ? [{ group, name }] : [];
      })
    };
  }

  return {
    async customers(search) {
      return loadCustomers(search);
    },

    async customersByIds(ids) {
      return loadCustomersByIds(ids);
    },

    async partiesByMobile(mobile) {
      return loadPartiesByMobile(mobile);
    },

    async list(input) {
      const target = await connection();
      const options = await loadEnquiryOptions(target);
      const filters: unknown[] = [];
      if (input.view === "assigned") filters.push(["assigned_to_employee", "=", input.employee]);
      if (input.view === "created") filters.push(["user_employee", "=", input.employee]);
      if (input.view === "open") {
        filters.push(["assigned_to_employee", "is", "not set"]);
        const closedStatuses = options.statuses
          .filter(({ group }) => group === "Closed")
          .map(({ name }) => name);
        if (closedStatuses.length) filters.push(["status", "not in", closedStatuses]);
      }
      const records: FrappeEnquiryDocument[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const query = new URLSearchParams({
          fields: JSON.stringify(enquiryFields),
          filters: JSON.stringify(filters),
          limit_page_length: "500",
          limit_start: String(offset),
          order_by: "creation desc"
        });
        const response = await frappeRequest<{ data?: FrappeEnquiryDocument[] }>(
          target,
          `/api/resource/Enquiry?${query}`
        );
        const page = response.data ?? [];
        records.push(...page);
        hasMore = input.view === "all" && page.length === 500;
        offset += page.length;
      }
      return records.map((document) => toEnquiry(document, options));
    },

    async listByMobile(mobile) {
      const target = await connection();
      const options = await loadEnquiryOptions(target);
      const query = new URLSearchParams({
        fields: JSON.stringify(enquiryFields),
        filters: JSON.stringify([["mobile", "=", requiredMobile(mobile)]]),
        limit_page_length: "10",
        order_by: "creation desc"
      });
      const response = await frappeRequest<{ data?: FrappeEnquiryDocument[] }>(
        target,
        `/api/resource/Enquiry?${query}`
      );
      return (response.data ?? []).map((document) => toEnquiry(document, options));
    },

    async options() {
      return loadEnquiryOptions();
    },

    async queryReport(input) {
      const target = await connection();
      const response = await frappeRequest<FrappeQueryReportResponse>(
        target,
        "/api/v2/method/frappe.desk.query_report.run",
        {
          body: JSON.stringify({
            filters: input.filters,
            ignore_prepared_report: true,
            report_name: input.reportName
          }),
          method: "POST"
        }
      );
      return toQueryReport(response);
    },

    async get(name) {
      return hydrate(await connection(), requiredName(name));
    },

    async jobs(name) {
      return loadJobs(name);
    },

    async jobsForEnquiries(names) {
      return loadJobsForEnquiries(names);
    },

    async createJob(name, input) {
      const target = await connection();
      const response = await frappeRequest<{ data?: FrappeJobExecutionDocument }>(
        target,
        "/api/v2/document/Job Execution",
        {
          body: JSON.stringify(jobPayload(requiredName(name), input)),
          method: "POST"
        }
      );
      if (!response.data) throw AppError.conflict("Frappe did not return the new job.");
      return toJobExecution(response.data);
    },

    async create(input) {
      const target = await connection();
      const options = await loadEnquiryOptions(target);
      const status = resolveStatusName(input.status, options);
      const response = await frappeRequest<{ data?: FrappeEnquiryDocument }>(
        target,
        "/api/resource/Enquiry",
        {
          body: JSON.stringify(toPayload({ ...input, status }, employee(), true, true)),
          method: "POST"
        }
      );
      if (!response.data?.name) throw AppError.conflict("Frappe did not return the new enquiry.");
      return hydrate(target, response.data.name);
    },

    async countComments(input) {
      const enquiryNames = [...new Set(input.enquiryNames.map(requiredName))];
      if (!enquiryNames.length) return 0;
      const target = await connection();
      try {
        const responses = await Promise.all(
          chunk(enquiryNames, 100).map((names) =>
            frappeRequest<{ message?: Array<{ name?: string }> }>(
              target,
              "/api/v2/method/frappe.client.get_list",
              {
                body: JSON.stringify({
                  doctype: "Enquiry Message",
                  fields: ["name"],
                  filters: [
                    ["parent", "in", names],
                    ["owner", "=", input.createdBy],
                    ["creation", ">=", input.createdAfter]
                  ],
                  limit_page_length: 500
                }),
                method: "POST"
              }
            )
          )
        );
        return responses.reduce((total, response) => total + (response.message?.length ?? 0), 0);
      } catch {
        return null;
      }
    },

    async update(name, input) {
      const target = await connection();
      const options = await loadEnquiryOptions(target);
      const status = resolveStatusName(input.status, options);
      const enquiryName = requiredName(name);
      await frappeRequest<{ data?: FrappeEnquiryDocument }>(
        target,
        `/api/resource/Enquiry/${encodeURIComponent(enquiryName)}`,
        {
          body: JSON.stringify(toPayload({ ...input, status }, employee(), false, false)),
          method: "PUT"
        }
      );
      return hydrate(target, enquiryName);
    },

    async updateMessages(name, messages, status) {
      const target = await connection();
      const enquiryName = requiredName(name);
      await frappeRequest<{ data?: FrappeEnquiryDocument }>(
        target,
        `/api/resource/Enquiry/${encodeURIComponent(enquiryName)}`,
        {
          body: JSON.stringify({
            ...(status ? { status } : {}),
            enquiry_messages: messages.map(({ comment, mode, name: childName, parentMessage }) => ({
              comment: richText(comment),
              ...(mode ? { mode: mode === "reply" ? "Reply" : "Comment" } : {}),
              ...(childName ? { name: childName } : {}),
              ...(parentMessage ? { parent_message: parentMessage } : {})
            }))
          }),
          method: "PUT"
        }
      );
      return hydrate(target, enquiryName);
    },

    async delete(name) {
      const target = await connection();
      await frappeRequest(
        target,
        `/api/resource/Enquiry/${encodeURIComponent(requiredName(name))}`,
        { method: "DELETE" }
      );
    },

    async employees() {
      const target = await connection();
      const query = new URLSearchParams({
        fields: JSON.stringify(["name", "employee_name", "user_id"]),
        filters: JSON.stringify([["status", "=", "Active"]]),
        limit_page_length: "500",
        order_by: "employee_name asc"
      });
      const response = await frappeRequest<{ data?: FrappeEmployeeDocument[] }>(
        target,
        `/api/resource/Employee?${query}`
      );
      return (response.data ?? []).map(toEmployee).filter(Boolean) as FrappeLiveEmployee[];
    },

    async startJob(name) {
      const target = await connection();
      const employeeName = employee();
      const employeeDocument = await frappeRequest<{
        data?: { cost_per_hour?: number | string };
      }>(
        target,
        `/api/resource/Employee/${encodeURIComponent(employeeName)}?fields=${encodeURIComponent(
          JSON.stringify(["name", "cost_per_hour"])
        )}`
      );
      const costPerHour = Number(employeeDocument.data?.cost_per_hour ?? 0);
      if (!Number.isFinite(costPerHour) || costPerHour < 0) {
        throw AppError.validation(
          "The Frappe Employee Cost Per Hour must be a valid non-negative amount."
        );
      }
      const response = await frappeRequest<{ data?: FrappeJobExecutionDocument }>(
        target,
        "/api/v2/document/Job Execution",
        {
          body: JSON.stringify({
            employee: employeeName,
            enquiry: requiredName(name),
            start_time: frappeTime(new Date())
          }),
          method: "POST"
        }
      );
      if (!response.data) throw AppError.conflict("Frappe did not return the started job.");
      const job = toJobExecution(response.data);
      return {
        ...job,
        employeeCostPerHour: job.employeeCostPerHour || costPerHour
      };
    },

    async updateJob(name, jobName, input) {
      const target = await connection();
      const enquiryName = requiredName(name);
      const existing = (await loadJobs(enquiryName)).find(
        (job) => job.name === requiredName(jobName)
      );
      if (!existing) {
        throw AppError.notFound("Job was not found against this enquiry in Frappe.");
      }
      const response = await frappeRequest<{ data?: FrappeJobExecutionDocument }>(
        target,
        `/api/v2/document/Job Execution/${encodeURIComponent(requiredName(jobName))}`,
        {
          body: JSON.stringify(jobPayload(enquiryName, input)),
          method: "PUT"
        }
      );
      if (!response.data) throw AppError.conflict("Frappe did not return the updated job.");
      return toJobExecution(response.data);
    },

    async stopJob(name, jobName) {
      const target = await connection();
      const enquiryName = requiredName(name);
      const jobs = await loadJobs(enquiryName);
      const running = jobs.filter((job) => job.status === "Running");
      if (running.length > 1) {
        throw AppError.conflict("Frappe has more than one running job for this enquiry.");
      }
      if (running[0]?.name !== jobName) {
        throw AppError.conflict("The selected job is no longer running.");
      }
      const response = await frappeRequest<{ data?: FrappeJobExecutionDocument }>(
        target,
        `/api/v2/document/Job Execution/${encodeURIComponent(requiredName(jobName))}`,
        {
          body: JSON.stringify({ status: "Completed", stop_time: frappeTime(new Date()) }),
          method: "PUT"
        }
      );
      if (!response.data) throw AppError.conflict("Frappe did not return the completed job.");
      return toJobExecution(response.data);
    }
  };
};

const jobExecutionFields = [
  "name",
  "creation",
  "enquiry",
  "employee",
  "start_time",
  "stop_time",
  "status",
  "employee_cost_per_hour",
  "hours",
  "total_cost"
];

async function hydrate(
  connection: FrappeConnectionCredentials,
  name: string,
  summary?: FrappeEnquiryDocument
) {
  const options = await loadOptionsForConnection(connection);
  const document =
    summary?.enquiry_messages !== undefined
      ? summary
      : (
          await frappeRequest<{ data?: FrappeEnquiryDocument }>(
            connection,
            `/api/resource/Enquiry/${encodeURIComponent(requiredName(name))}`
          )
        ).data;
  if (!document) throw AppError.notFound("Enquiry was not found in Frappe.");
  const query = new URLSearchParams({ doctype: "Enquiry", name: requiredName(name) });
  const [timeline, messageMetadata] = await Promise.all([
    frappeRequest<FrappeDocInfoResponse>(
      connection,
      `/api/method/frappe.desk.form.load.get_docinfo?${query}`
    ),
    loadMessageMetadata(connection, requiredName(name))
  ]);
  return toEnquiry(withMessageMetadata(document, messageMetadata), options, timeline.docinfo);
}

async function loadMessageMetadata(connection: FrappeConnectionCredentials, enquiryName: string) {
  try {
    return await requestMessageMetadata(connection, enquiryName, [
      "name",
      "owner",
      "creation",
      "posted_at",
      "posted_by",
      "idx"
    ]);
  } catch {
    return requestMessageMetadata(connection, enquiryName, ["name", "owner", "creation", "idx"]);
  }
}

async function requestMessageMetadata(
  connection: FrappeConnectionCredentials,
  enquiryName: string,
  fields: string[]
) {
  const response = await frappeRequest<{
    data?: FrappeEnquiryMessageMetadata[];
    message?: FrappeEnquiryMessageMetadata[];
  }>(connection, "/api/v2/method/frappe.client.get_list", {
    body: JSON.stringify({
      doctype: "Enquiry Message",
      fields,
      filters: [
        ["parent", "=", enquiryName],
        ["parenttype", "=", "Enquiry"],
        ["parentfield", "=", "enquiry_messages"]
      ],
      limit_page_length: 500,
      order_by: "idx asc",
      parent: "Enquiry"
    }),
    method: "POST"
  });
  return response.data ?? response.message ?? [];
}

function withMessageMetadata(
  document: FrappeEnquiryDocument,
  metadata: FrappeEnquiryMessageMetadata[]
): FrappeEnquiryDocument {
  const byName = new Map(metadata.map((entry) => [entry.name, entry]));
  return {
    ...document,
    enquiry_messages: (document.enquiry_messages ?? []).map((message, index) => {
      const systemFields = (message.name ? byName.get(message.name) : undefined) ?? metadata[index];
      return {
        ...message,
        ...(systemFields?.posted_at || systemFields?.creation
          ? { creation: systemFields.posted_at || systemFields.creation }
          : {}),
        ...(systemFields?.posted_by || systemFields?.owner
          ? { owner: systemFields.posted_by || systemFields.owner }
          : {})
      };
    })
  };
}

function toPayload(
  input: FrappeLiveEnquirySavePayload,
  userEmployee: string,
  includeMessages: boolean,
  includeOwner: boolean
) {
  return {
    assigned_to_employee: input.assignedToEmployee || null,
    customer: input.customer || null,
    date: input.enquiryDate,
    due_date: input.dueDate,
    enquiry_details: input.enquiryMessage,
    ...(includeMessages
      ? {
          enquiry_messages: input.messages.map(({ comment, mode }) => ({
            comment: richText(comment),
            ...(mode ? { mode: mode === "reply" ? "Reply" : "Comment" } : {})
          }))
        }
      : {}),
    group: input.enquiryGroup || null,
    mobile: input.mobile,
    priority: toFrappePriority(input.priority),
    status: input.status,
    status_details: input.statusDetails || null,
    title: input.title,
    ...(includeOwner ? { user_employee: userEmployee } : {})
  };
}

function toEnquiry(
  document: FrappeEnquiryDocument,
  options: FrappeLiveEnquiryOptions,
  docinfo?: FrappeDocumentInfo
): FrappeLiveEnquiry {
  const status = document.status?.trim() || options.statuses[0]?.name || "New";
  return {
    activities: toActivities(document, docinfo),
    assignedToEmployee: document.assigned_to_employee?.trim() || null,
    createdAt: timestamp(document.creation),
    customer: document.customer?.trim() ?? "",
    dueDate: document.due_date?.slice(0, 10) ?? null,
    enquiryDate: document.date?.slice(0, 10) ?? null,
    enquiryGroup: document.group?.trim() ?? "",
    enquiryMessage: document.enquiry_details?.trim() ?? "",
    messages: (document.enquiry_messages ?? []).map((message, index) => ({
      comment: richText(message.comment ?? ""),
      createdAt: message.creation ? timestamp(message.creation) : null,
      createdBy: message.owner?.trim() || null,
      name: message.name?.trim() || `${document.name}-message-${index + 1}`,
      parentMessage: message.parent_message?.trim() || null
    })),
    mobile: document.mobile?.trim() ?? "",
    modifiedAt: timestamp(document.modified ?? document.creation),
    modifiedBy: document.modified_by?.trim() || null,
    name: document.name,
    priority: fromFrappePriority(document.priority),
    status,
    statusGroup: options.statuses.find((candidate) => candidate.name === status)?.group ?? "New",
    statusDetails: document.status_details?.trim() ?? "",
    title: document.title?.trim() || "",
    userEmployee: document.user_employee?.trim() ?? ""
  };
}

function toActivities(
  document: FrappeEnquiryDocument,
  docinfo?: FrappeDocumentInfo
): FrappeLiveEnquiryActivity[] {
  if (!docinfo) return [];
  const activities = [
    ...(docinfo.versions ?? []).flatMap((version) => versionActivities(version, docinfo)),
    ...(docinfo.views ?? []).map((view) => {
      const actor = actorName(view.owner, docinfo);
      return activity("viewed", view.name, view.creation, actor, `${actor} viewed this`);
    }),
    ...(docinfo.info_logs ?? []).map((entry) => {
      const actor = actorName(entry.owner, docinfo);
      const details = plainMessage(entry.content ?? "") || `${actor} last edited this`;
      return activity("edited", entry.name, entry.creation, actor, details);
    })
  ];
  if (
    !(docinfo.info_logs ?? []).length &&
    document.modified &&
    document.modified !== document.creation
  ) {
    const actor = actorName(document.modified_by, docinfo);
    activities.push(
      activity(
        "edited",
        `${document.name}-modified`,
        document.modified,
        actor,
        `${actor} last edited this`
      )
    );
  }
  return activities.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function versionActivities(
  version: FrappeVersionDocument,
  docinfo: FrappeDocumentInfo
): FrappeLiveEnquiryActivity[] {
  const data = parseVersionData(version.data);
  const actor = actorName(version.owner, docinfo);
  const output: FrappeLiveEnquiryActivity[] = [];
  for (const [field, before, after] of data.changed ?? []) {
    const change = `${fieldLabel(field)} from ${displayValue(before)} to ${displayValue(after)}`;
    output.push(
      activity(
        "changed",
        `${version.name}-changed-${output.length}`,
        version.creation,
        actor,
        `${actor} changed the value of ${change}`
      )
    );
  }
  for (const row of data.row_changed ?? []) {
    const rowNumber = Number(row[1]) + 1;
    for (const [field, before, after] of row[3] ?? []) {
      const change = `${fieldLabel(field)} from ${displayValue(before)} to ${displayValue(after)} in row #${rowNumber}`;
      output.push(
        activity(
          "changed",
          `${version.name}-row-${output.length}`,
          version.creation,
          actor,
          `${actor} changed the values for ${change}`
        )
      );
    }
  }
  for (const key of ["added", "removed"] as const) {
    const counts = new Map<string, number>();
    for (const [field] of data[key] ?? []) counts.set(field, (counts.get(field) ?? 0) + 1);
    for (const [field, count] of counts) {
      const direction = key === "added" ? "to" : "from";
      const noun = count === 1 ? "row" : "rows";
      output.push(
        activity(
          key,
          `${version.name}-${key}-${output.length}`,
          version.creation,
          actor,
          `${actor} ${key} ${count} ${noun} ${direction} ${fieldLabel(field)}`
        )
      );
    }
  }
  return output;
}

function activity(
  action: FrappeLiveEnquiryActivity["action"],
  name: string | undefined,
  createdAt: string | undefined,
  createdBy: string,
  details: string
): FrappeLiveEnquiryActivity {
  return {
    action,
    createdAt: timestamp(createdAt),
    createdBy,
    details,
    name: name?.trim() || `${action}-${createdAt ?? "unknown"}`
  };
}

function actorName(owner: string | undefined, docinfo: FrappeDocumentInfo) {
  const key = owner?.trim() || "Frappe";
  return docinfo.user_info?.[key]?.fullname?.trim() || key;
}

function fieldLabel(field: string) {
  if (field === "enquiry_messages") return "Messages";
  return field.replace(/_/gu, " ").replace(/\b\w/gu, (character) => character.toUpperCase());
}

function displayValue(value: unknown) {
  const text = plainMessage(String(value ?? "")) || '""';
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function parseVersionData(value?: string): FrappeVersionData {
  if (!value) return {};
  try {
    return JSON.parse(value) as FrappeVersionData;
  } catch {
    return {};
  }
}

function toEmployee(value: FrappeEmployeeDocument): FrappeLiveEmployee | null {
  const name = value.name?.trim();
  if (!name) return null;
  return {
    email: value.user_id?.trim() ?? "",
    name,
    title: value.employee_name?.trim() || name
  };
}

function requiredName(value: string) {
  const name = value.trim();
  if (!name) throw AppError.validation("Frappe enquiry name is required.");
  return name;
}

function requiredMobile(value: string) {
  const mobile = value.trim();
  if (!/^\d{10}$/u.test(mobile)) {
    throw AppError.validation("Mobile must contain exactly 10 numeric digits.");
  }
  return mobile;
}

function chunk<T>(values: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }
  return batches;
}

function timestamp(value?: string) {
  if (!value) return new Date(0).toISOString();
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(
    /[zZ]$|[+-]\d{2}:\d{2}$/u.test(normalized) ? normalized : `${normalized}+05:30`
  );
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
}

function referenceListUrl(doctype: string, fields: string[]) {
  const query = new URLSearchParams({
    fields: JSON.stringify(fields),
    limit_page_length: "500",
    order_by: "idx desc, creation asc"
  });
  return `/api/resource/${encodeURIComponent(doctype)}?${query}`;
}

async function loadOptionsForConnection(connection: FrappeConnectionCredentials) {
  const [groups, statuses] = await Promise.all([
    frappeRequest<{ data?: FrappeEnquiryGroupDocument[] }>(
      connection,
      referenceListUrl("Enquiry Group", ["name", "group_name"])
    ),
    frappeRequest<{ data?: FrappeEnquiryStatusDocument[] }>(
      connection,
      referenceListUrl("Enquiry Status", ["name", "status_name", "status_group"])
    )
  ]);
  return {
    groups: (groups.data ?? []).flatMap((document) => {
      const name = document.group_name?.trim() || document.name?.trim();
      return name ? [{ name }] : [];
    }),
    statuses: (statuses.data ?? []).flatMap((document) => {
      const name = document.status_name?.trim() || document.name?.trim();
      return name ? [{ group: enquiryStatusGroup(document.status_group), name }] : [];
    })
  } satisfies FrappeLiveEnquiryOptions;
}

function enquiryStatusGroup(value?: string): FrappeLiveEnquiryOptions["statuses"][number]["group"] {
  return value === "Closed" || value === "Hold" || value === "Pending" ? value : "New";
}

function statusKey(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return key === "re-open" ? "reopen" : key;
}

function resolveStatusName(value: string, options: FrappeLiveEnquiryOptions) {
  const normalized = statusKey(value);
  const status = options.statuses.find(
    ({ name }) => name === value.trim() || statusKey(name) === normalized
  );
  if (!status) throw AppError.validation("Select a current Frappe enquiry status.");
  return status.name;
}

function fromFrappePriority(value?: string) {
  const priority = value?.trim().toLowerCase();
  if (priority === "low" || priority === "high" || priority === "urgent") return priority;
  return "normal" as const;
}

function toFrappePriority(value: string) {
  const priority = fromFrappePriority(value);
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function richText(value: string) {
  return value.replace(/\r/gu, "").trim();
}

function frappeTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

function jobPayload(enquiry: string, input: FrappeLiveJobExecutionSavePayload) {
  const hours =
    input.status === "Running" || !input.stopTime
      ? 0
      : elapsedHours(input.startTime, input.stopTime);
  return {
    employee: input.employee,
    employee_cost_per_hour: input.employeeCostPerHour,
    enquiry,
    hours,
    start_time: input.startTime,
    status: input.status,
    stop_time: input.status === "Running" ? null : input.stopTime,
    total_cost: Number((hours * input.employeeCostPerHour).toFixed(2))
  };
}

function elapsedHours(startTime: string, stopTime: string) {
  const seconds = timeSeconds(stopTime) - timeSeconds(startTime);
  return Number(((seconds < 0 ? seconds + 86_400 : seconds) / 3600).toFixed(6));
}

function timeSeconds(value: string) {
  const [hours = 0, minutes = 0, seconds = 0] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function toJobExecution(
  document: FrappeJobExecutionDocument
): import("./frappe.types.js").FrappeLiveJobExecution {
  return {
    createdAt: jobTimestamp(document.creation),
    date: document.date?.slice(0, 10) ?? null,
    employee: document.employee?.trim() ?? "",
    employeeCostPerHour: Number(document.employee_cost_per_hour ?? 0),
    enquiry: document.enquiry?.trim() ?? "",
    hours: Number(document.hours ?? 0),
    name: document.name,
    startTime: document.start_time?.trim() ?? "",
    status:
      document.status === "Completed" || document.status === "Cancelled"
        ? document.status
        : ("Running" as const),
    stopTime: document.stop_time?.trim() || null,
    totalCost: Number(document.total_cost ?? 0)
  };
}

function jobTimestamp(value?: string) {
  if (!value) return new Date(0).toISOString();
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  if (/[zZ]$|[+-]\d{2}:\d{2}$/u.test(normalized)) return timestamp(normalized);
  const date = new Date(`${normalized}+05:30`);
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
}

function plainMessage(value: string) {
  return value
    .replace(/\r/gu, "")
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<li(?:\s[^>]*)?>/giu, "- ")
    .replace(/<\/(?:blockquote|div|h[1-6]|li|p)\s*>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

type FrappeEmployeeDocument = {
  employee_name?: string;
  name?: string;
  user_id?: string;
};

type FrappeCustomerDocument = {
  customer_name?: string;
  name?: string;
};

type FrappePartyDocument = FrappeCustomerDocument & {
  supplier_name?: string;
};

type FrappeEnquiryGroupDocument = {
  group_name?: string;
  name?: string;
};

type FrappeEnquiryStatusDocument = {
  name?: string;
  status_group?: string;
  status_name?: string;
};

type FrappeEnquiryDocument = {
  assigned_to_employee?: string;
  creation?: string;
  customer?: string;
  date?: string;
  due_date?: string;
  enquiry_details?: string;
  enquiry_messages?: Array<{
    comment?: string;
    creation?: string;
    name?: string;
    owner?: string;
    parent_message?: string;
  }>;
  group?: string;
  mobile?: string;
  modified?: string;
  modified_by?: string;
  name: string;
  priority?: string;
  status?: string;
  status_details?: string;
  title?: string;
  user_employee?: string;
};

type FrappeEnquiryMessageMetadata = {
  creation?: string;
  idx?: number;
  name: string;
  owner?: string;
  posted_at?: string;
  posted_by?: string;
};

type FrappeJobExecutionDocument = {
  creation?: string;
  date?: string;
  employee?: string;
  employee_cost_per_hour?: number | string;
  enquiry?: string;
  hours?: number | string;
  name: string;
  start_time?: string;
  status?: string;
  stop_time?: string;
  total_cost?: number | string;
};

type FrappeDocInfoResponse = { docinfo?: FrappeDocumentInfo };

type FrappeDocumentInfo = {
  info_logs?: FrappeInfoLogDocument[];
  user_info?: Record<string, { fullname?: string }>;
  versions?: FrappeVersionDocument[];
  views?: FrappeViewDocument[];
};

type FrappeInfoLogDocument = {
  content?: string;
  creation?: string;
  name?: string;
  owner?: string;
};

type FrappeVersionDocument = {
  creation?: string;
  data?: string;
  name?: string;
  owner?: string;
};

type FrappeViewDocument = {
  creation?: string;
  name?: string;
  owner?: string;
};

type FrappeVersionData = {
  added?: Array<[string, unknown]>;
  changed?: Array<[string, unknown, unknown]>;
  removed?: Array<[string, unknown]>;
  row_changed?: Array<[string, number, string, Array<[string, unknown, unknown]>]>;
};

type FrappeQueryReportColumn = {
  fieldname?: string;
  label?: string;
};

type FrappeQueryReportResponse = {
  data?: FrappeQueryReportResult;
  message?: FrappeQueryReportResult;
};

type FrappeQueryReportResult = {
  columns?: FrappeQueryReportColumn[];
  result?: Array<Record<string, unknown> | unknown[]>;
};

function toQueryReport(response: FrappeQueryReportResponse) {
  const result = response.data ?? response.message;
  const columns = (result?.columns ?? []).map((column, index) => ({
    fieldname: column.fieldname?.trim() || `column_${index + 1}`,
    label: column.label?.trim() || column.fieldname?.trim() || `Column ${index + 1}`
  }));
  return {
    columns,
    rows: (result?.result ?? []).map((row) => toQueryReportRow(row, columns))
  };
}

function toQueryReportRow(
  row: Record<string, unknown> | unknown[],
  columns: Array<{ fieldname: string; label: string }>
) {
  if (Array.isArray(row)) {
    return Object.fromEntries(
      columns.map((column, index) => [column.fieldname, reportCell(row[index])])
    );
  }
  return Object.fromEntries(
    columns.map((column) => [column.fieldname, reportCell(row[column.fieldname])])
  );
}

function reportCell(value: unknown): number | string | null {
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}
