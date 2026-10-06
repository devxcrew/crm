import { registerContractRoute } from "@codexsun/framework/http";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { identityContext } from "../../auth/identity-context.js";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { CrmService } from "./crm.service.js";

const path = "/crm/enquiries";
const mobileJobsPath = "/mobile/crm/jobs";
const priority = z.enum(["low", "normal", "high", "urgent"]);
const status = z.string().trim().min(1).max(140);
const statusGroup = z.enum(["closed", "hold", "new", "pending"]);
const userReference = z.object({
  email: z.string(),
  id: z.string().min(1),
  name: z.string(),
  uuid: z.string().min(1)
});
const message = z.object({
  canSuspend: z.boolean(),
  comment: z.string(),
  createdAt: z.iso.datetime(),
  createdByUserId: z.string().nullable(),
  id: z.string().min(1),
  isSuspended: z.boolean(),
  messageType: z.enum(["comment", "reply"]),
  parentMessageId: z.string().nullable()
});
const job = z.object({
  createdAt: z.iso.datetime(),
  date: z.iso.date().nullable(),
  employee: z.string(),
  employeeCostPerHour: z.number(),
  enquiry: z.string(),
  hours: z.number(),
  name: z.string(),
  startTime: z.string(),
  status: z.enum(["Running", "Completed", "Cancelled"]),
  stopTime: z.string().nullable(),
  totalCost: z.number()
});
const record = z.object({
  activities: z.array(z.unknown()),
  assignedTo: userReference.nullable(),
  assignedToUserId: z.string().nullable(),
  attachments: z.array(z.unknown()),
  calls: z.array(z.unknown()),
  createdAt: z.iso.datetime(),
  createdBy: userReference,
  createdByUserId: z.string(),
  customer: z.string(),
  customerName: z.string(),
  hasUnreadAssignment: z.boolean(),
  enquiryDate: z.iso.date().nullable(),
  enquiryGroup: z.string(),
  emails: z.array(z.unknown()),
  frappeName: z.string().min(1),
  id: z.number().int().positive(),
  jobs: z.array(job),
  lifecycleStatus: z.literal("active"),
  messages: z.array(message),
  mobile: z.string(),
  notes: z.array(z.unknown()),
  priority,
  schedules: z.array(z.object({ id: z.string(), scheduledOn: z.iso.date() })),
  status,
  statusGroup,
  statusDetails: z.string(),
  tasks: z.array(z.unknown()),
  title: z.string(),
  updatedAt: z.iso.datetime(),
  updatedByUserId: z.string().nullable(),
  uuid: z.string().min(1),
  workspace: z.string()
});
const payload = z.object({
  assignedToUserId: z.string().trim().min(1).nullable().optional().default(null),
  customer: z.string().trim().max(140),
  enquiryDate: z.iso.date().nullable(),
  enquiryGroup: z.string().trim().max(80).optional().default(""),
  messages: z
    .array(
      z.object({
        comment: z.string().trim().min(1).max(10_000),
        mode: z.enum(["comment", "reply"]).optional()
      })
    )
    .max(100),
  mobile: z.string().regex(/^\d{10}$/u, "Mobile must contain exactly 10 numeric digits."),
  priority,
  schedules: z.array(z.object({ scheduledOn: z.iso.date() })).max(20),
  status,
  statusDetails: z.string().trim().max(10_000).optional(),
  title: z.string().trim().max(220),
  workspace: z.string().trim().max(100_000)
});
const params = z.object({ id: z.string().trim().min(1).max(140) });
const messageParams = params.extend({ messageId: z.string().trim().min(1).max(240) });
const messagePayload = z.object({
  comment: z.string().trim().min(1).max(10_000),
  messageType: z.enum(["comment", "reply"]),
  parentMessageId: z.string().trim().min(1).max(240).nullable().optional()
});
const jobParams = params.extend({ jobName: z.string().trim().min(1).max(240) });
const jobTime = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u, "Use a valid 24-hour time.");
const jobPayload = z
  .object({
    employee: z.string().trim().min(1).max(140),
    employeeCostPerHour: z.number().finite().nonnegative().max(10_000_000),
    startTime: jobTime,
    status: z.enum(["Running", "Completed", "Cancelled"]),
    stopTime: jobTime.nullable()
  })
  .superRefine((value, context) => {
    if (value.status !== "Running" && !value.stopTime) {
      context.addIssue({
        code: "custom",
        message: "Stop time is required for a completed or cancelled job.",
        path: ["stopTime"]
      });
    }
  });
const query = z.object({
  assignedToEmployee: z.string().trim().min(1).max(140).optional(),
  createdByEmployee: z.string().trim().min(1).max(140).optional(),
  enquiryId: z.string().trim().min(1).max(140).optional(),
  enquiryGroup: z.string().trim().min(1).max(140).optional(),
  fromDate: z.iso.date().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  search: z.string().trim().max(220).optional(),
  status: status.optional(),
  toDate: z.iso.date().optional(),
  view: z.enum(["all", "assigned", "created", "open"])
});
const mobileJobsQuery = z.object({
  status: z.enum(["active", "closed", "in-progress"])
});
const mobileCommentPayload = z.object({
  comment: z.string().trim().min(1).max(10_000)
});
const mobileCallCapturePayload = z.object({
  assignedToUserId: z.string().trim().min(1).nullable(),
  customerName: z.string().trim().max(220),
  direction: z.enum(["incoming", "outgoing"]),
  durationSeconds: z.number().int().nonnegative().max(86_400),
  enquiryGroup: z.string().trim().max(80),
  message: z.string().trim().min(1).max(10_000),
  mobile: z.string().regex(/^\d{10}$/u, "Mobile must contain exactly 10 numeric digits."),
  occurredAt: z.iso.datetime(),
  title: z.string().trim().max(220).optional().default("")
});
const customerReferenceQuery = z.object({
  search: z.string().trim().max(140).optional()
});
const customerReference = z.object({
  id: z.string().min(1).max(140),
  name: z.string().min(1).max(220)
});
const partyReference = customerReference.extend({ type: z.enum(["Customer", "Supplier"]) });
const customerMobileMatch = z.object({
  mobile: z.string().regex(/^\d{10}$/u, "Mobile must contain exactly 10 numeric digits.")
});
const mobileMatchQuery = z.object({
  mobile: z.string().regex(/^\d{10}$/u, "Mobile must contain exactly 10 numeric digits.")
});
const mobileMatch = z.object({
  assignedTo: userReference.nullable(),
  canEdit: z.boolean(),
  closedAt: z.iso.datetime().nullable(),
  closedBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  frappeName: z.string().min(1),
  id: z.number().int().positive(),
  status,
  statusGroup,
  title: z.string()
});
const overviewGroup = z.object({
  activity: z.object({
    createdLast7Days: z.number().int().nonnegative(),
    createdLast30Days: z.number().int().nonnegative(),
    reactionsLast7Days: z.number().int().nonnegative(),
    reactionsLast30Days: z.number().int().nonnegative(),
    updatedLast7Days: z.number().int().nonnegative(),
    updatedLast30Days: z.number().int().nonnegative()
  }),
  inProgress: z.number().int().nonnegative(),
  oldestActiveDays: z.number().int().nonnegative(),
  priorityCounts: z.array(z.object({ count: z.number().int().nonnegative(), priority })),
  statusCounts: z.array(z.object({ count: z.number().int().nonnegative(), status, statusGroup })),
  total: z.number().int().nonnegative()
});
const overview = z.object({
  stats: z.object({
    allEnquiries: overviewGroup.nullable(),
    commentsByMeLast30Days: z.number().int().nonnegative().nullable(),
    myCalls: overviewGroup,
    myJob: overviewGroup
  })
});
const reportQuery = z.object({
  assignedToEmployee: z.string().trim().max(140).optional(),
  fromDate: z.iso.date().optional(),
  group: z.string().trim().max(140).optional(),
  toDate: z.iso.date().optional()
});
const report = z.object({
  columns: z.array(z.object({ fieldname: z.string(), label: z.string() })),
  rows: z.array(z.record(z.string(), z.union([z.number(), z.string(), z.null()])))
});
const contributorReportRow = z.object({
  count: z.number().int().nonnegative(),
  employee: z.string(),
  name: z.string()
});
const statusReportRow = z.object({ count: z.number().int().nonnegative(), status: z.string() });
const enquiryOptions = z.object({
  groups: z.array(z.object({ label: z.string(), value: z.string() })),
  statuses: z.array(z.object({ group: statusGroup, label: z.string(), value: z.string() }))
});

export async function registerCrmRoutes(
  app: FastifyInstance,
  frappeLiveEnquiryGateway: PlatformModuleDependencies["frappeLiveEnquiryGateway"],
  notificationPublisher: PlatformModuleDependencies["notificationPublisher"]
) {
  registerMobileJobRoutes(app, service);
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/options`,
    schemas: { response: enquiryOptions },
    handler: async ({ request }) => (await service(request)).options()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/party-by-mobile`,
    schemas: { querystring: customerMobileMatch, response: z.array(partyReference) },
    handler: async ({ query, request }) => (await service(request)).partiesByMobile(query.mobile)
  });
  registerContractRoute(app, {
    method: "GET",
    url: path,
    schemas: { querystring: query, response: z.array(record) },
    handler: async ({ query, request }) =>
      (await service(request)).list({
        view: query.view,
        ...(query.assignedToEmployee ? { assignedToEmployee: query.assignedToEmployee } : {}),
        ...(query.createdByEmployee ? { createdByEmployee: query.createdByEmployee } : {}),
        ...(query.enquiryId ? { enquiryId: query.enquiryId } : {}),
        ...(query.enquiryGroup ? { enquiryGroup: query.enquiryGroup } : {}),
        ...(query.fromDate ? { fromDate: query.fromDate } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.search ? { search: query.search } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.toDate ? { toDate: query.toDate } : {})
      })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/reports/list-in-status`,
    schemas: { querystring: reportQuery, response: report },
    handler: async ({ query, request }) =>
      (await service(request)).report("list-in-status", {
        assigned_to_employee: query.assignedToEmployee ?? null,
        from_date: query.fromDate ?? null,
        to_date: query.toDate ?? null
      })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/reports/owner-status`,
    schemas: { querystring: reportQuery, response: report },
    handler: async ({ query, request }) =>
      (await service(request)).report("owner-status", {
        from_date: query.fromDate ?? null,
        group: query.group ?? null,
        to_date: query.toDate ?? null
      })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/reports/contributors`,
    schemas: { querystring: reportQuery, response: z.array(contributorReportRow) },
    handler: async ({ query, request }) =>
      (await service(request)).contributorsReport({
        fromDate: query.fromDate ?? null,
        toDate: query.toDate ?? null
      })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/reports/status`,
    schemas: { querystring: reportQuery, response: z.array(statusReportRow) },
    handler: async ({ query, request }) =>
      (await service(request)).statusReport({
        fromDate: query.fromDate ?? null,
        toDate: query.toDate ?? null
      })
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:id/jobs/start`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => (await service(request)).startJob(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:id/jobs/:jobName/stop`,
    schemas: { params: jobParams, response: record },
    handler: async ({ params, request }) =>
      (await service(request)).stopJob(params.id, params.jobName)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:id/jobs`,
    schemas: { body: jobPayload, params, response: record },
    handler: async ({ body, params, request }) =>
      (await service(request)).createJob(params.id, body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${path}/:id/jobs/:jobName`,
    schemas: { body: jobPayload, params: jobParams, response: record },
    handler: async ({ body, params, request }) =>
      (await service(request)).updateJob(params.id, params.jobName, body)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/overview`,
    schemas: { response: overview },
    handler: async ({ request }) => (await service(request)).overview()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/references`,
    schemas: { response: z.array(z.object({ id: z.string(), title: z.string() })) },
    handler: async ({ request }) => (await service(request)).enquiryReferences()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/user-references`,
    schemas: { response: z.array(userReference) },
    handler: async ({ request }) => (await service(request)).userReferences()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/customer-references`,
    schemas: { querystring: customerReferenceQuery, response: z.array(customerReference) },
    handler: async ({ query, request }) => (await service(request)).customerReferences(query.search)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/mobile-matches`,
    schemas: { querystring: mobileMatchQuery, response: z.array(mobileMatch) },
    handler: async ({ query, request }) => (await service(request)).mobileMatches(query.mobile)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/:id`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => (await service(request)).get(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:id/assignment-receipt`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => (await service(request)).receiveAssignment(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: path,
    schemas: { body: payload, response: record },
    handler: async ({ body, request }) => (await service(request)).create(body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${path}/:id`,
    schemas: { body: payload, params, response: record },
    handler: async ({ body, params, request }) => (await service(request)).update(params.id, body)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:id/messages`,
    schemas: { body: messagePayload, params, response: record },
    handler: async ({ body, params, request }) =>
      (await service(request)).addMessage(params.id, body)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:id/messages/:messageId/suspend`,
    schemas: { params: messageParams, response: record },
    handler: async ({ params, request }) =>
      (await service(request)).suspendMessage(params.id, params.messageId)
  });
  registerContractRoute(app, {
    method: "DELETE",
    url: `${path}/:id/force`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => (await service(request)).forceDelete(params.id)
  });

  async function service(request: Parameters<typeof identityContext>[0]) {
    const context = identityContext(request);
    const actor = await context.actorUser();
    if (!actor) throw new Error("Active user is required.");
    const crmContext = {
      ...context,
      actorName: actor.name,
      actorUserId: actor.id,
      frappeEmployeeCode: actor.frappeEmployeeCode
    };
    return new CrmService(
      crmContext,
      frappeLiveEnquiryGateway({
        database: context.database,
        employee: actor.frappeEmployeeCode,
        userId: actor.id
      }),
      notificationPublisher
    );
  }
}

function registerMobileJobRoutes(
  app: FastifyInstance,
  service: (request: Parameters<typeof identityContext>[0]) => Promise<CrmService>
) {
  registerContractRoute(app, {
    method: "GET",
    url: "/mobile/crm/options",
    schemas: { response: enquiryOptions },
    handler: async ({ request }) => (await service(request)).options()
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/mobile/crm/call-enquiries",
    schemas: { body: mobileCallCapturePayload, response: record },
    handler: async ({ body, request }) => {
      await requireCallLogAdministrator(request);
      return (await service(request)).captureMobileCall(body);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: mobileJobsPath,
    schemas: { querystring: mobileJobsQuery, response: z.array(record) },
    handler: async ({ query, request }) =>
      (await service(request)).list({ status: query.status, view: "assigned" })
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${mobileJobsPath}/summary`,
    schemas: { response: overview },
    handler: async ({ request }) => (await service(request)).overview()
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${mobileJobsPath}/:id/comments`,
    schemas: { body: mobileCommentPayload, params, response: record },
    handler: async ({ body, params, request }) =>
      (await service(request)).addMessage(params.id, {
        comment: body.comment,
        messageType: "comment"
      })
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${mobileJobsPath}/:id/start`,
    schemas: { params, response: record },
    handler: async ({ params, request }) => (await service(request)).startJob(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${mobileJobsPath}/:id/jobs/:jobName/stop`,
    schemas: { params: jobParams, response: record },
    handler: async ({ params, request }) =>
      (await service(request)).stopJob(params.id, params.jobName)
  });
}

async function requireCallLogAdministrator(request: Parameters<typeof identityContext>[0]) {
  const actor = await identityContext(request).actorUser();
  if (!actor || !["admin", "super-admin"].includes(actor.role)) {
    throw AppError.forbidden("Administrator access is required for device call logs.");
  }
}
