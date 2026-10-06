import { AppError } from "@codexsun/framework/errors";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import type { FrappeLiveStaffRequest } from "../frappe/frappe.types.js";
import type {
  HrDuty,
  HrRequestApproval,
  HrRequestContext,
  HrStaffRequest,
  HrStaffRequestSavePayload
} from "./hr.types.js";

type LiveGateway = ReturnType<PlatformModuleDependencies["frappeLiveStaffRequestGateway"]>;
type SopDutyGateway = ReturnType<PlatformModuleDependencies["frappeLiveSopDutyGateway"]>;

export class HrService {
  constructor(
    private readonly context: HrRequestContext,
    private readonly gateway: LiveGateway,
    private readonly sopDutyGateway: SopDutyGateway
  ) {}

  async approve(name: string) {
    const actor = await this.requireAdministrator("hr.request.approve");
    const comment = `Approved by ${actor.name} on ${new Date().toISOString()}.`;
    return this.map(await this.gateway.addApprovalComment(name, comment));
  }

  async create(input: HrStaffRequestSavePayload) {
    await this.context.authorize("hr.request.create");
    return this.map(await this.gateway.create(this.employee(), input));
  }

  async get(name: string) {
    const request = await this.gateway.get(name);
    await this.authorizeRequest(request);
    return this.map(request);
  }

  async list(view: "all" | "my") {
    if (view === "all") await this.requireAdministrator("hr.request.all.view");
    else await this.context.authorize("hr.request.own.view");
    return (await this.gateway.list(view === "my" ? { employee: this.employee() } : {})).map(
      (request) => this.map(request)
    );
  }

  async duties(): Promise<HrDuty[]> {
    await this.context.authorize("hr.request.own.view");
    return this.sopDutyGateway.list(this.employee());
  }

  async reportDuty(sopItem: string, actions: string): Promise<HrDuty> {
    await this.context.authorize("hr.request.create");
    const duty = (await this.duties()).find((candidate) => candidate.sopItem === sopItem.trim());
    if (!duty) throw AppError.forbidden("This SOP is not assigned to the signed-in employee.");
    const report = await this.sopDutyGateway.createReport({ actions, sopItem });
    return { ...duty, reports: [report, ...duty.reports] };
  }

  async update(name: string, input: HrStaffRequestSavePayload) {
    await this.context.authorize("hr.request.own.update");
    const request = await this.gateway.get(name);
    if (request.employee !== this.employee()) {
      throw AppError.forbidden("You can update only your own Staff Requests.");
    }
    if (hasApproval(request)) {
      throw AppError.conflict("An approved Staff Request cannot be changed.");
    }
    return this.map(await this.gateway.update(name, request.employee, input));
  }

  private async authorizeRequest(request: FrappeLiveStaffRequest) {
    const actor = await this.context.actorUser();
    if (actor?.role === "admin") {
      await this.context.authorize("hr.request.all.view");
      return;
    }
    await this.context.authorize("hr.request.own.view");
    if (request.employee !== this.employee()) {
      throw AppError.forbidden("You can view only your own Staff Requests.");
    }
  }

  private employee() {
    const employee = this.context.frappeEmployeeCode?.trim();
    if (!employee) {
      throw AppError.conflict(
        "The signed-in Frappe user must be linked to an Employee before using HR requests."
      );
    }
    return employee;
  }

  private map(request: FrappeLiveStaffRequest): HrStaffRequest {
    return {
      approvals: request.comments.flatMap((comment) => {
        const approval = approvalFromComment(comment.content, comment.createdAt);
        return approval ? [{ ...approval, approvedBy: comment.createdBy }] : [];
      }),
      createdAt: request.createdAt,
      days: request.days,
      date: request.date,
      details: request.details,
      employee: request.employee,
      modifiedAt: request.modifiedAt,
      name: request.name,
      requestType: request.requestType
    };
  }

  private async requireAdministrator(permission: "hr.request.all.view" | "hr.request.approve") {
    const actor = await this.context.actorUser();
    if (actor?.role !== "admin") {
      throw AppError.forbidden("Only an Admin can view or approve all Staff Requests.");
    }
    await this.context.authorize(permission);
    return actor;
  }
}

function approvalFromComment(
  comment: string,
  fallback: string
): Omit<HrRequestApproval, "approvedBy"> | null {
  if (!comment.startsWith("Approved by ")) return null;
  const approvedAt = comment.match(/on (.+)\.$/u)?.[1] ?? fallback;
  return { approvedAt, comment };
}

function hasApproval(request: FrappeLiveStaffRequest) {
  return request.comments.some((comment) => comment.content.startsWith("Approved by "));
}
