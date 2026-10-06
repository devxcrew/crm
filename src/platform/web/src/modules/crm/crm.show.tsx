import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  CornerUpLeft,
  Ellipsis,
  ListChecks,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Send,
  Square,
  ScrollText,
  Timer,
  X
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@codexsun/ui/components/alert-dialog";
import { Button } from "@codexsun/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@codexsun/ui/components/dropdown-menu";
import { Input } from "@codexsun/ui/components/input";
import { toast } from "@codexsun/ui/components/sonner";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceAnimatedTabs } from "@codexsun/ui/workspace/animated-tabs";
import { WorkspaceDatePicker } from "@codexsun/ui/workspace/date-picker";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceMinimalEditor } from "@codexsun/ui/workspace/minimal-editor";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { WorkspaceRowActions } from "@codexsun/ui/workspace/row-actions";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import { WorkspaceDetailTable, WorkspaceShowCard } from "@codexsun/ui/workspace/show";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import { WorkspaceTableEmptyState, WorkspaceTableHeaderCell } from "@codexsun/ui/workspace/table";
import { EstimateEnquiryTab } from "../estimate";
import { QuotationEnquiryTab } from "../quotation";
import { useCrmEnquiryChildMutations, useCrmEnquiryMutations, useCrmUsersQuery } from "./crm.hooks";
import { CrmJobForm } from "./crm.job-form";
import { useCrmOptionLists } from "./crm.options";
import { enquiryPropertyPayload } from "./crm.property-payload";
import type {
  CrmEnquiry,
  CrmEnquirySavePayload,
  CrmJobExecution,
  CrmJobSavePayload,
  CrmUserReference
} from "./crm.types";

type CrmShowTab =
  "activity" | "attachments" | "comments" | "estimate" | "jobs" | "quotation" | "tasks";

const whatsappButtonClassName =
  "bg-[#25D366] text-white hover:bg-[#20bd5a] hover:text-white active:bg-[#128C7E]";

export function CrmShow({
  canAssign,
  canCreateEstimate,
  canCreateQuotation,
  canManageJobs,
  canUpdate,
  canUpdateEstimate,
  canUpdateQuotation,
  onBack,
  onNext,
  onRecordChange,
  record,
  showActivity,
  showProperties,
  view
}: {
  canAssign: boolean;
  canCreateEstimate: boolean;
  canCreateQuotation: boolean;
  canManageJobs: boolean;
  canUpdate: boolean;
  canUpdateEstimate: boolean;
  canUpdateQuotation: boolean;
  onBack: () => void;
  onNext?: () => void;
  onRecordChange: (record: CrmEnquiry) => void;
  record: CrmEnquiry;
  showActivity: boolean;
  showProperties: boolean;
  view: "assigned" | "created" | "open";
}) {
  const [activeTab, setActiveTab] = useState<CrmShowTab>("comments");
  const childMutations = useCrmEnquiryChildMutations(onRecordChange);
  const enquiryMutations = useCrmEnquiryMutations();
  const users = useCrmUsersQuery();
  const whatsappTargets = view === "open" ? null : buildWhatsAppTargets(record);
  async function saveChild(label: string, operation: () => Promise<CrmEnquiry>, action = "added") {
    try {
      await operation();
      toast.success(`${label} ${action}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label} could not be ${action}.`);
      throw error;
    }
  }
  const jobLoading =
    childMutations.jobCreate.isPending ||
    childMutations.jobStart.isPending ||
    childMutations.jobStop.isPending ||
    childMutations.jobUpdate.isPending;
  const startJob = () =>
    saveChild("Job", () => childMutations.jobStart.mutateAsync(record.frappeName), "started");
  const stopJob = (jobName: string) =>
    saveChild(
      "Job",
      () => childMutations.jobStop.mutateAsync([record.frappeName, jobName]),
      "stopped"
    );
  const createJob = (payload: CrmJobSavePayload) =>
    saveChild(
      "Job",
      () => childMutations.jobCreate.mutateAsync([record.frappeName, payload]),
      "created"
    );
  const updateJob = (jobName: string, payload: CrmJobSavePayload) =>
    saveChild(
      "Job",
      () => childMutations.jobUpdate.mutateAsync([record.frappeName, jobName, payload]),
      "updated"
    );
  async function updateProperties(
    patch: Partial<
      Pick<
        CrmEnquirySavePayload,
        "assignedToUserId" | "enquiryGroup" | "priority" | "schedules" | "status"
      >
    >
  ) {
    try {
      const saved = await enquiryMutations.update.mutateAsync({
        id: record.frappeName,
        payload: enquiryPropertyPayload(record, patch)
      });
      onRecordChange(saved);
      toast.success("Enquiry properties updated", {
        description: "The change was saved to Frappe and added to the activity feed."
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The enquiry properties could not be updated."
      );
      throw error;
    }
  }
  const tabs = [
    {
      content: (
        <CommentsTab
          key={`comments-${record.id}`}
          loading={childMutations.message.isPending || childMutations.messageSuspend.isPending}
          record={record}
          onAdd={(input) =>
            saveChild(input.messageType === "reply" ? "Reply" : "Comment", () =>
              childMutations.message.mutateAsync([record.frappeName, input])
            )
          }
          onSuspend={(message) =>
            saveChild(
              message.messageType === "reply" ? "Reply" : "Comment",
              () => childMutations.messageSuspend.mutateAsync([record.frappeName, message.id]),
              "suspended"
            )
          }
          onUpdate={async () => undefined}
        />
      ),
      label: (
        <TabLabel
          count={record.messages.length}
          icon={<MessageSquare className="size-4" />}
          label="Comments"
        />
      ),
      value: "comments"
    },
    {
      content: (
        <JobsTab
          canManage={canManageJobs}
          key={`jobs-${record.id}`}
          loading={jobLoading}
          users={users.data ?? []}
          record={record}
          onCreate={createJob}
          onStart={startJob}
          onStop={stopJob}
          onUpdate={updateJob}
        />
      ),
      label: (
        <TabLabel count={record.jobs.length} icon={<Timer className="size-4" />} label="Jobs" />
      ),
      value: "jobs"
    },
    {
      content: (
        <EstimateEnquiryTab
          canCreate={canCreateEstimate}
          canUpdate={canUpdateEstimate}
          enquiry={record.frappeName}
        />
      ),
      label: <TabLabel icon={<ReceiptText className="size-4" />} label="Estimate" />,
      value: "estimate"
    },
    {
      content: (
        <QuotationEnquiryTab
          canCreate={canCreateQuotation}
          canUpdate={canUpdateQuotation}
          enquiry={record.frappeName}
        />
      ),
      label: <TabLabel icon={<ScrollText className="size-4" />} label="Quotation" />,
      value: "quotation"
    },
    {
      content: (
        <TasksTab
          key={`tasks-${record.id}`}
          loading={childMutations.task.isPending}
          record={record}
          onAdd={(input) =>
            saveChild("Task", () => childMutations.task.mutateAsync([record.frappeName, input]))
          }
        />
      ),
      label: <TabLabel icon={<ListChecks className="size-4" />} label="Tasks" />,
      value: "tasks"
    },
    {
      content: (
        <AttachmentsTab
          key={`attachments-${record.id}`}
          loading={childMutations.attachment.isPending}
          record={record}
          onAdd={(input) =>
            saveChild("Attachment", () =>
              childMutations.attachment.mutateAsync([record.frappeName, input])
            )
          }
        />
      ),
      label: <TabLabel icon={<Paperclip className="size-4" />} label="Attachments" />,
      value: "attachments"
    },
    {
      content: <ActivityTab key={`activity-${record.id}`} record={record} />,
      label: <TabLabel icon={<Activity className="size-4" />} label="Activity" />,
      value: "activity"
    }
  ].filter(
    (tab) =>
      !["attachments", "quotation", "tasks"].includes(tab.value) &&
      (tab.value !== "activity" || showActivity)
  );

  return (
    <WorkspacePage
      actions={
        <div className="flex items-center gap-2">
          <Button
            className="mobile-enquiry-back hidden"
            onClick={onBack}
            type="button"
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {whatsappTargets ? (
            <Button
              className={whatsappButtonClassName}
              onClick={() => openWhatsApp(whatsappTargets)}
              type="button"
            >
              <WhatsAppIcon />
              WhatsApp
            </Button>
          ) : view !== "open" ? (
            <Button
              className={whatsappButtonClassName}
              disabled
              title="Add a valid mobile number to use WhatsApp"
              type="button"
            >
              <WhatsAppIcon />
              WhatsApp
            </Button>
          ) : null}
          {view === "open" ? (
            <>
              <Button
                className="desktop-enquiry-back"
                onClick={onBack}
                type="button"
                variant="outline"
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button disabled={!onNext} onClick={onNext} type="button">
                Next
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      }
      className="!w-full !max-w-none px-1 lg:px-2"
      technicalName="page.crm.enquiry.show"
      title={enquiryHeading(record)}
    >
      <EnquirySummary record={record} />

      <div
        className={
          showProperties ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]" : undefined
        }
      >
        <div className="min-w-0 overflow-hidden rounded-md border border-border/70 bg-card/95 shadow-sm">
          <WorkspaceAnimatedTabs
            contentClassName="mt-0 pb-0"
            listClassName="px-3"
            onValueChange={(value) => setActiveTab(value as CrmShowTab)}
            tabs={tabs}
            value={activeTab}
          />
        </div>

        {showProperties ? (
          <EnquiryProperties
            canAssign={canAssign}
            canUpdate={canUpdate}
            jobLoading={jobLoading}
            loading={enquiryMutations.update.isPending}
            record={record}
            users={users.data ?? []}
            onSave={updateProperties}
            onStartJob={startJob}
            onStopJob={stopJob}
          />
        ) : null}
      </div>
    </WorkspacePage>
  );
}

function JobsTab({
  canManage,
  loading,
  onCreate,
  onStart,
  onStop,
  onUpdate,
  record,
  users
}: {
  canManage: boolean;
  loading: boolean;
  onCreate: (payload: CrmJobSavePayload) => Promise<unknown>;
  onStart: () => Promise<unknown>;
  onStop: (jobName: string) => Promise<unknown>;
  onUpdate: (jobName: string, payload: CrmJobSavePayload) => Promise<unknown>;
  record: CrmEnquiry;
  users: CrmUserReference[];
}) {
  const [editing, setEditing] = useState<CrmJobExecution | null | undefined>(undefined);
  const running = record.jobs.filter((job) => job.status === "Running");
  const active = running[0];
  return (
    <section className="min-h-[calc(100dvh-21rem)] bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Live job time recorded directly against this enquiry in Frappe.
        </p>
        <div className="flex items-center gap-2">
          {canManage ? (
            <Button disabled={loading} onClick={() => setEditing(null)} type="button">
              <Plus className="size-4" />
              New job
            </Button>
          ) : null}
          <JobControlButton
            active={active}
            loading={loading}
            runningCount={running.length}
            onStart={onStart}
            onStop={onStop}
          />
        </div>
      </div>
      {running.length > 1 ? (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Frappe returned more than one running job. Stop the duplicate records in Frappe before
          continuing.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-md border border-border/70">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">Stop</th>
              <th className="px-3 py-2">Hours</th>
              <th className="px-3 py-2">Rate/hr</th>
              <th className="px-3 py-2">Cost</th>
              <th className="px-3 py-2">Status</th>
              {canManage ? <th className="px-3 py-2 text-right">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {record.jobs.map((job) => (
              <tr className="border-t border-border/70" key={job.name}>
                <td className="px-3 py-2 font-medium">{job.name}</td>
                <td className="px-3 py-2">{job.employee}</td>
                <td className="px-3 py-2">{job.startTime || "—"}</td>
                <td className="px-3 py-2">{job.stopTime || "—"}</td>
                <td className="px-3 py-2">
                  {job.status === "Running" ? "Running" : job.hours.toFixed(2)}
                </td>
                <td className="px-3 py-2">₹{job.employeeCostPerHour.toFixed(2)}</td>
                <td className="px-3 py-2">{job.totalCost.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <WorkspaceStatusBadge
                    label={job.status}
                    tone={
                      job.status === "Completed"
                        ? "success"
                        : job.status === "Cancelled"
                          ? "neutral"
                          : "warning"
                    }
                  />
                </td>
                {canManage ? (
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <WorkspaceRowActions
                        onEdit={() => setEditing(job)}
                        title={`Job ${job.name}`}
                      />
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {record.jobs.length === 0 ? (
          <WorkspaceTableEmptyState>No jobs have been recorded.</WorkspaceTableEmptyState>
        ) : null}
      </div>
      {editing !== undefined ? (
        <CrmJobForm
          key={editing?.name ?? "new"}
          loading={loading}
          onCancel={() => setEditing(undefined)}
          onSubmit={(value) => {
            const operation = editing ? onUpdate(editing.name, value) : onCreate(value);
            void operation.then(() => setEditing(undefined)).catch(() => undefined);
          }}
          record={editing}
          users={users}
        />
      ) : null}
    </section>
  );
}

function JobControlButton({
  active,
  fullWidth = false,
  loading,
  onStart,
  onStop,
  runningCount
}: {
  active: CrmEnquiry["jobs"][number] | undefined;
  fullWidth?: boolean;
  loading: boolean;
  onStart: () => Promise<unknown>;
  onStop: (jobName: string) => Promise<unknown>;
  runningCount: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) {
    return (
      <Button
        className={fullWidth ? "w-full" : undefined}
        disabled={loading}
        type="button"
        variant="secondary"
        onClick={() => void onStart()}
      >
        <Timer className="size-4" />
        Start job
      </Button>
    );
  }

  return (
    <Button
      className={`${fullWidth ? "w-full" : ""} bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white active:bg-emerald-700`}
      disabled={loading || runningCount > 1}
      type="button"
      onClick={() => void onStop(active.name)}
    >
      <Square className="size-3.5 fill-current" />
      Stop · {elapsedJobTime(active.createdAt, now)}
    </Button>
  );
}

function EnquirySummary({ record }: { record: CrmEnquiry }) {
  return (
    <section className="rounded-md border border-border/70 bg-card/95 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="font-mono text-xs text-muted-foreground">#{record.id}</span>
          <h2 className="mt-1 break-words text-lg font-semibold text-foreground">
            {enquiryDisplayTitle(record)}
          </h2>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <WorkspaceStatusBadge
              className="h-7 px-3 text-xs"
              label={`List in · ${record.enquiryGroup || "Unlisted"}`}
              showIcon={false}
              tone="info"
            />
            <WorkspaceStatusBadge
              label={
                record.lifecycleStatus === "suspended" ? "Suspended" : capitalize(record.status)
              }
              tone={record.lifecycleStatus === "suspended" ? "danger" : statusTone(record.status)}
            />
            <WorkspaceStatusBadge label={capitalize(record.priority)} tone="neutral" />
          </div>
          <p className="text-xs text-muted-foreground sm:text-right">
            Created by{" "}
            <span className="font-medium text-foreground/80">{record.createdBy.name}</span>
            <span aria-hidden="true"> · </span>
            <time dateTime={record.createdAt} title={formatDateTime(record.createdAt)}>
              {formatRelativeTime(record.createdAt)}
            </time>
          </p>
        </div>
      </div>
    </section>
  );
}

function CommentsTab({
  loading,
  onAdd,
  onSuspend,
  onUpdate,
  record
}: {
  loading: boolean;
  onAdd: (input: { comment: string; messageType: "comment" | "reply" }) => Promise<unknown>;
  onSuspend: (message: CrmEnquiry["messages"][number]) => Promise<unknown>;
  onUpdate: (message: CrmEnquiry["messages"][number], comment: string) => Promise<unknown>;
  record: CrmEnquiry;
}) {
  const [comment, setComment] = useState("");
  const messageType = defaultCommentMessageType();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState("");
  const [suspendingMessage, setSuspendingMessage] = useState<CrmEnquiry["messages"][number] | null>(
    null
  );
  const commentCount = record.messages.filter(
    (message) => message.messageType === "comment"
  ).length;

  function save(nextMessageType: "comment" | "reply") {
    return onAdd({ comment: comment.trim(), messageType: nextMessageType })
      .then(() => setComment(""))
      .catch(() => undefined);
  }

  return (
    <section className="flex min-h-[calc(100dvh-21rem)] flex-col">
      <div className="border-b border-border/70 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
          <span aria-hidden="true"> · </span>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-card px-5 pb-5 pt-2">
        <div>
          {record.messages.map((message, messageIndex) => {
            const author = messageAuthorDetails(record, message.createdByUserId);
            const isReply = message.messageType === "reply";
            const nextMessage = record.messages[messageIndex + 1];
            const endsConversationGroup = !nextMessage || nextMessage.messageType === "comment";
            return (
              <div
                className={
                  endsConversationGroup ? "border-b border-border/70 py-0.5 last:border-b-0" : ""
                }
                key={message.id}
              >
                <article
                  className={`relative py-1.5 pl-8 ${
                    isReply ? "ml-7 border-l border-border/70 md:ml-10" : ""
                  }`}
                >
                  <div
                    className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground ${
                      isReply ? "-left-2.5 size-5" : "left-0 size-6"
                    }`}
                  >
                    {isReply ? (
                      <CornerUpLeft className="size-3" />
                    ) : (
                      <MessageSquare className="size-3.5" />
                    )}
                  </div>
                  <div className="bg-card px-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {editingMessageId === message.id ? (
                          <div className="rounded-md border border-border bg-card p-2">
                            <WorkspaceMinimalEditor
                              className="!bg-background shadow-none [&_.tiptap]:min-h-20"
                              content={editingComment}
                              placeholder={`Edit ${isReply ? "reply" : "comment"}…`}
                              onChange={setEditingComment}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <Button
                                className="h-7 text-xs"
                                disabled={loading}
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingComment("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                className="h-7 text-xs"
                                disabled={loading || !plainText(editingComment)}
                                size="sm"
                                type="button"
                                onClick={() =>
                                  void onUpdate(message, editingComment.trim())
                                    .then(() => {
                                      setEditingMessageId(null);
                                      setEditingComment("");
                                    })
                                    .catch(() => undefined)
                                }
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`prose prose-sm max-w-none rounded-md bg-muted/20 px-3 py-0.5 text-base leading-6 text-foreground [&_p]:my-0 [&_p+p]:mt-2 ${message.isSuspended ? "opacity-60 line-through [&_*]:line-through" : ""}`}
                              dangerouslySetInnerHTML={{
                                __html: sanitizeRichText(message.comment)
                              }}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pt-0.5">
                        <p className="whitespace-nowrap text-xs text-muted-foreground/75">
                          <span className="font-medium text-foreground/70">{author.name}</span>
                          <span aria-hidden="true"> - </span>
                          <RelativeTime value={message.createdAt} />
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={`${isReply ? "Reply" : "Comment"} options`}
                              className="size-6 shrink-0"
                              size="icon"
                              title="More options"
                              type="button"
                              variant="ghost"
                            >
                              <Ellipsis className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            {message.isSuspended && !message.isSuspended ? (
                              <DropdownMenuItem
                                disabled={loading || !message.canSuspend}
                                onSelect={() => {
                                  setEditingMessageId(message.id);
                                  setEditingComment(message.comment);
                                }}
                              >
                                <Pencil className="mr-2 size-4" />
                                Edit
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={loading || !message.canSuspend}
                              onSelect={() => setSuspendingMessage(message)}
                            >
                              <Ban className="mr-2 size-4" />
                              Suspend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
        {record.messages.length === 0 ? (
          <WorkspaceTableEmptyState>No comments have been added.</WorkspaceTableEmptyState>
        ) : null}
      </div>

      <div className="sticky bottom-0 border-t border-border/80 bg-card/95 p-3 backdrop-blur">
        <div className="overflow-hidden rounded-md border border-border/80 bg-background shadow-sm">
          <WorkspaceMinimalEditor
            className="!rounded-none !border-0 !bg-background shadow-none [&_.tiptap]:min-h-24"
            content={comment}
            placeholder={messageType === "reply" ? "Write a reply…" : "Write a comment…"}
            onChange={setComment}
          />
          <div
            aria-label="Comment tools"
            className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/25 px-2 py-1.5"
            role="toolbar"
          >
            <Button
              disabled={loading || !plainText(comment)}
              size="sm"
              type="button"
              onClick={() => void save("comment")}
            >
              <Send className="size-4" />
              Comment
            </Button>
            <Button
              disabled={loading || !plainText(comment) || !latestComment(record)}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void save("reply")}
            >
              <CornerUpLeft className="size-4" /> Reply
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={suspendingMessage !== null}
        onOpenChange={(open) => !open && setSuspendingMessage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend this conversation entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the entry in the enquiry history and marks it as suspended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading || !suspendingMessage}
              onClick={(event) => {
                event.preventDefault();
                if (!suspendingMessage) return;
                void onSuspend(suspendingMessage)
                  .then(() => setSuspendingMessage(null))
                  .catch(() => undefined);
              }}
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function latestComment(record: CrmEnquiry) {
  return [...record.messages].reverse().find((message) => message.messageType === "comment");
}

function defaultCommentMessageType(): "comment" | "reply" {
  return "comment";
}

function TasksTab({
  loading,
  onAdd,
  record
}: {
  loading: boolean;
  onAdd: (input: { dueOn: string | null; status: "pending"; title: string }) => Promise<unknown>;
  record: CrmEnquiry;
}) {
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  return (
    <TabSurface>
      <TabRecordCount count={record.tasks.length} />
      <ChildTable
        columns={["Task", "Status", "Due"]}
        empty="No tasks have been added."
        rows={record.tasks.map((task) => [
          task.title,
          capitalize(task.status),
          task.dueOn ? formatDate(task.dueOn) : "—"
        ])}
      />
      <TabComposer>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_18rem]">
          <Input
            aria-label="Task title"
            disabled={loading}
            placeholder="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <WorkspaceDatePicker
            ariaLabel="Task due date"
            placeholder="Due date"
            value={dueOn}
            onValueChange={setDueOn}
          />
        </div>
        <ComposerAction
          disabled={loading || !title.trim()}
          label="Add task"
          onClick={() =>
            void onAdd({ dueOn: dueOn || null, status: "pending", title: title.trim() })
              .then(() => {
                setTitle("");
                setDueOn("");
              })
              .catch(() => undefined)
          }
        />
      </TabComposer>
    </TabSurface>
  );
}

function _NotesTab({
  loading,
  onAdd,
  record
}: {
  loading: boolean;
  onAdd: (input: { note: string }) => Promise<unknown>;
  record: CrmEnquiry;
}) {
  const [note, setNote] = useState("");
  return (
    <TabSurface>
      <TabRecordCount count={record.notes.length} />
      <ChildTable
        columns={["Note", "Created"]}
        empty="No notes have been added."
        rows={record.notes.map((item) => [item.note, formatDateTime(item.createdAt)])}
      />
      <TabComposer>
        <Textarea
          aria-label="New note"
          className="min-h-24 resize-none"
          disabled={loading}
          placeholder="Write a note…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <ComposerAction
          disabled={loading || !note.trim()}
          label="Add note"
          onClick={() =>
            void onAdd({ note: note.trim() })
              .then(() => setNote(""))
              .catch(() => undefined)
          }
        />
      </TabComposer>
    </TabSurface>
  );
}

function AttachmentsTab({
  loading,
  onAdd,
  record
}: {
  loading: boolean;
  onAdd: (input: { fileName: string; fileUrl: string }) => Promise<unknown>;
  record: CrmEnquiry;
}) {
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  return (
    <TabSurface>
      <TabRecordCount count={record.attachments.length} />
      <ChildTable
        columns={["File", "Link", "Created"]}
        empty="No attachments have been added."
        rows={record.attachments.map((attachment) => [
          attachment.fileName,
          <a
            className="font-medium text-primary hover:underline"
            href={attachment.fileUrl}
            key={attachment.uuid}
            rel="noreferrer"
            target="_blank"
          >
            Open
          </a>,
          formatDateTime(attachment.createdAt)
        ])}
      />
      <TabComposer>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            aria-label="Attachment file name"
            disabled={loading}
            placeholder="File name"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
          />
          <Input
            aria-label="Attachment URL"
            disabled={loading}
            placeholder="https://…"
            value={fileUrl}
            onChange={(event) => setFileUrl(event.target.value)}
          />
        </div>
        <ComposerAction
          disabled={loading || !fileName.trim() || !fileUrl.trim()}
          label="Add attachment"
          onClick={() =>
            void onAdd({ fileName: fileName.trim(), fileUrl: fileUrl.trim() })
              .then(() => {
                setFileName("");
                setFileUrl("");
              })
              .catch(() => undefined)
          }
        />
      </TabComposer>
    </TabSurface>
  );
}

function ActivityTab({ record }: { record: CrmEnquiry }) {
  return (
    <TabSurface>
      <TabRecordCount count={record.activities.length} />
      <ChildTable
        columns={["Action", "Details", "Created"]}
        empty="No activity has been recorded."
        rows={record.activities.map((activity) => [
          activity.action.replace(/-/gu, " "),
          activity.details,
          formatDateTime(activity.createdAt)
        ])}
      />
    </TabSurface>
  );
}

function EnquiryProperties({
  canAssign,
  canUpdate,
  jobLoading,
  loading,
  onSave,
  onStartJob,
  onStopJob,
  record,
  users
}: {
  canAssign: boolean;
  canUpdate: boolean;
  jobLoading: boolean;
  loading: boolean;
  onSave: (
    patch: Partial<
      Pick<
        CrmEnquirySavePayload,
        "assignedToUserId" | "enquiryGroup" | "priority" | "schedules" | "status"
      >
    >
  ) => Promise<void>;
  onStartJob: () => Promise<unknown>;
  onStopJob: (jobName: string) => Promise<unknown>;
  record: CrmEnquiry;
  users: CrmUserReference[];
}) {
  const crmOptions = useCrmOptionLists();
  const runningJobs = record.jobs.filter((job) => job.status === "Running");
  const [editing, setEditing] = useState<
    "assignedToUserId" | "enquiryGroup" | "priority" | "schedules" | "status" | null
  >(null);
  const [assignedToUserId, setAssignedToUserId] = useState(record.assignedToUserId ?? "");
  const [enquiryGroup, setEnquiryGroup] = useState(record.enquiryGroup);
  const [priority, setPriority] = useState(record.priority);
  const [scheduleDate, setScheduleDate] = useState(record.schedules[0]?.scheduledOn ?? "");
  const [status, setStatus] = useState(record.status);

  useEffect(() => {
    setAssignedToUserId(record.assignedToUserId ?? "");
    setEnquiryGroup(record.enquiryGroup);
    setPriority(record.priority);
    setScheduleDate(record.schedules[0]?.scheduledOn ?? "");
    setStatus(record.status);
  }, [record]);

  const groupOptions = Array.from(
    new Set([record.enquiryGroup, ...crmOptions.groups.map(({ value }) => value)])
  )
    .filter(Boolean)
    .map((value) => ({ label: value, value }));

  function cancelEdit() {
    setAssignedToUserId(record.assignedToUserId ?? "");
    setEnquiryGroup(record.enquiryGroup);
    setPriority(record.priority);
    setScheduleDate(record.schedules[0]?.scheduledOn ?? "");
    setStatus(record.status);
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const patch =
      editing === "assignedToUserId"
        ? { assignedToUserId: assignedToUserId || null }
        : editing === "enquiryGroup"
          ? { enquiryGroup }
          : editing === "priority"
            ? { priority }
            : editing === "schedules"
              ? { schedules: scheduleDate ? [{ scheduledOn: scheduleDate }] : [] }
              : { status };
    await onSave(patch);
    setEditing(null);
  }

  return (
    <aside className="space-y-4 xl:sticky xl:top-4 xl:[&_td]:whitespace-nowrap xl:[&_th]:whitespace-nowrap">
      <WorkspaceShowCard title="Properties">
        <EditablePropertyRow
          disabled={!canUpdate}
          editing={editing === "enquiryGroup"}
          label="List in"
          loading={loading}
          value={record.enquiryGroup || "—"}
          onCancel={cancelEdit}
          onEdit={() => setEditing("enquiryGroup")}
          onSave={saveEdit}
        >
          <WorkspaceSelect
            options={groupOptions}
            placeholder="Choose list"
            value={enquiryGroup}
            onValueChange={setEnquiryGroup}
          />
        </EditablePropertyRow>
        <EditablePropertyRow
          disabled={!canUpdate}
          editing={editing === "priority"}
          label="Priority"
          loading={loading}
          value={capitalize(record.priority)}
          onCancel={cancelEdit}
          onEdit={() => setEditing("priority")}
          onSave={saveEdit}
        >
          <WorkspaceSelect
            options={[
              { label: "Low", swatchClassName: "bg-sky-500", value: "low" },
              { label: "Normal", swatchClassName: "bg-teal-500", value: "normal" },
              { label: "High", swatchClassName: "bg-amber-500", value: "high" },
              { label: "Urgent", swatchClassName: "bg-red-500", value: "urgent" }
            ]}
            value={priority}
            onValueChange={(value) => setPriority(value as CrmEnquirySavePayload["priority"])}
          />
        </EditablePropertyRow>
        <EditablePropertyRow
          disabled={!canUpdate || !canAssign}
          editing={editing === "assignedToUserId"}
          label="Assigned to"
          loading={loading}
          value={record.assignedTo?.name ?? "Unassigned"}
          onCancel={cancelEdit}
          onEdit={() => setEditing("assignedToUserId")}
          onSave={saveEdit}
        >
          <WorkspaceLookup
            allowTextValue={false}
            options={users.map((user) => ({
              description: user.email,
              label: user.name,
              value: user.id
            }))}
            placeholder="Unassigned"
            showAllOptionsOnFocus
            value={assignedToUserId}
            onValueChange={setAssignedToUserId}
          />
        </EditablePropertyRow>
        <EditablePropertyRow
          disabled={!canUpdate}
          editing={editing === "schedules"}
          label="Schedule date"
          loading={loading}
          value={scheduleDate ? formatDate(scheduleDate) : "—"}
          onCancel={cancelEdit}
          onEdit={() => setEditing("schedules")}
          onSave={saveEdit}
        >
          <WorkspaceDatePicker
            ariaLabel="Enquiry schedule date"
            placeholder="Schedule date"
            value={scheduleDate}
            onValueChange={setScheduleDate}
          />
        </EditablePropertyRow>
        <div className="border-y border-border/70 p-3">
          <JobControlButton
            active={runningJobs[0]}
            fullWidth
            loading={jobLoading}
            runningCount={runningJobs.length}
            onStart={onStartJob}
            onStop={onStopJob}
          />
        </div>
        <EditablePropertyRow
          disabled={!canUpdate}
          editing={editing === "status"}
          label="Status"
          loading={loading}
          value={capitalize(record.status)}
          onCancel={cancelEdit}
          onEdit={() => setEditing("status")}
          onSave={saveEdit}
        >
          <WorkspaceSelect
            options={crmOptions.statuses}
            value={status}
            onValueChange={(value) => setStatus(value as CrmEnquirySavePayload["status"])}
          />
        </EditablePropertyRow>
        <WorkspaceDetailTable rows={[["Updated", formatDateTime(record.updatedAt)]]} />
      </WorkspaceShowCard>

      <WorkspaceShowCard title="Customer">
        <WorkspaceDetailTable
          rows={[
            ["Customer", record.customer || "—"],
            ["Mobile", record.mobile || "—"],
            ["Enquiry date", record.enquiryDate || "—"],
            [
              "Schedule date",
              record.schedules.length
                ? record.schedules.map((item) => item.scheduledOn).join(", ")
                : "—"
            ]
          ]}
        />
      </WorkspaceShowCard>
    </aside>
  );
}

function EditablePropertyRow({
  children,
  disabled = false,
  editing,
  label,
  loading,
  onCancel,
  onEdit,
  onSave,
  value
}: {
  children: ReactNode;
  disabled?: boolean;
  editing: boolean;
  label: string;
  loading: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => Promise<void>;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-border/70 text-sm last:border-b-0">
      <div className="bg-muted/30 px-3 py-3 text-xs uppercase text-muted-foreground">{label}</div>
      <div className="min-w-0 px-2 py-1.5">
        {editing ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="min-w-0 flex-1">{children}</div>
            <Button
              aria-label={`Save ${label}`}
              className="size-8 shrink-0"
              disabled={loading}
              size="icon"
              title="Save"
              type="button"
              onClick={() => void onSave().catch(() => undefined)}
            >
              <Check className="size-4" />
            </Button>
            <Button
              aria-label={`Cancel editing ${label}`}
              className="size-8 shrink-0"
              disabled={loading}
              size="icon"
              title="Cancel"
              type="button"
              variant="ghost"
              onClick={onCancel}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex min-h-10 min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{value}</span>
            <Button
              aria-label={`Edit ${label}`}
              className="size-8 shrink-0"
              disabled={disabled}
              size="icon"
              title={disabled ? "Update permission is required" : `Edit ${label}`}
              type="button"
              variant="ghost"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TabSurface({ children }: { children: ReactNode }) {
  return <section className="flex min-h-[calc(100dvh-21rem)] flex-col">{children}</section>;
}

function TabRecordCount({ count }: { count: number }) {
  return (
    <div className="border-b border-border/70 px-4 py-2">
      <p className="text-xs text-muted-foreground">
        {count} {count === 1 ? "record" : "records"}
      </p>
    </div>
  );
}

function ChildTable({
  columns,
  empty,
  rows
}: {
  columns: string[];
  empty: string;
  rows: ReactNode[][];
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => (
              <WorkspaceTableHeaderCell key={column}>{column}</WorkspaceTableHeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-b border-border/70 last:border-b-0" key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td className="px-4 py-3 align-top first:font-medium" key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <WorkspaceTableEmptyState>{empty}</WorkspaceTableEmptyState> : null}
    </div>
  );
}

function TabComposer({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 border-t border-border/80 bg-card/95 p-3 backdrop-blur">
      {children}
    </div>
  );
}

function ComposerAction({
  disabled,
  label,
  onClick
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-2 flex justify-end">
      <Button disabled={disabled} type="button" onClick={onClick}>
        <Send className="size-4" />
        {label}
      </Button>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00+05:30`));
}

function TabLabel({ count, icon, label }: { count?: number; icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {label}
      {count !== undefined ? (
        <span
          aria-label={`${count} ${label.toLowerCase()}`}
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground"
        >
          {count > 999 ? "999+" : count}
        </span>
      ) : null}
    </span>
  );
}

function capitalize(value: string) {
  return value[0]!.toUpperCase() + value.slice(1);
}

function statusTone(status: CrmEnquiry["status"]): "danger" | "neutral" | "success" | "warning" {
  if (status === "won") return "success";
  if (status === "lost") return "neutral";
  if (status === "escalation") return "danger";
  return status.startsWith("hold-") || status === "long-hold" ? "warning" : "success";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
    year: "numeric"
  }).format(new Date(value));
}

function RelativeTime({ value }: { value: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time dateTime={value} title={formatDateTime(value)}>
      {formatRelativeTime(value, now)}
    </time>
  );
}

function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown time";

  const seconds = Math.round((now - timestamp) / 1_000);
  const future = seconds < 0;
  const absoluteSeconds = Math.abs(seconds);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"]
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [secondsPerUnit, unit] of units) {
    if (absoluteSeconds >= secondsPerUnit) {
      const amount = Math.round(seconds / secondsPerUnit);
      return formatter.format(amount, unit);
    }
  }
  return future ? "in a moment" : "just now";
}

function messageAuthorDetails(record: CrmEnquiry, userId: string | null) {
  const normalizedUserId = userId?.trim().toLowerCase() ?? "";
  const knownUsers = [record.createdBy, record.assignedTo].filter(
    (user): user is CrmUserReference => user !== null
  );
  const knownUser = knownUsers.find(
    (user) =>
      user.id.toLowerCase() === normalizedUserId || user.email.toLowerCase() === normalizedUserId
  );
  if (knownUser) {
    return { email: knownUser.email, name: knownUser.name };
  }
  if (!userId) {
    return { email: "", name: "System" };
  }
  if (userId.includes("@")) {
    const localName = userId
      .split("@")[0]!
      .split(/[._-]+/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return { email: userId, name: localName || userId };
  }
  return { email: "", name: userId };
}

function plainText(value: string) {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

function enquiryDisplayTitle(record: Pick<CrmEnquiry, "title" | "workspace">) {
  return record.title || plainText(record.workspace);
}

function enquiryHeading(
  record: Pick<CrmEnquiry, "customer" | "id" | "mobile" | "title" | "workspace">
) {
  const title = record.customer || enquiryDisplayTitle(record);
  return `#${record.id} · ${record.mobile || "—"} · ${truncateHeadingTitle(title)}`;
}

function truncateHeadingTitle(value: string, maximumLength = 56) {
  const title = value.trim();
  if (title.length <= maximumLength) return title;
  return `${title.slice(0, maximumLength - 3).trimEnd()}...`;
}

function buildWhatsAppTargets(record: Pick<CrmEnquiry, "mobile">) {
  const phone = normalizeWhatsAppPhone(record.mobile);
  if (!phone) return null;

  return {
    web: `https://wa.me/${phone}`
  };
}

function openWhatsApp(targets: NonNullable<ReturnType<typeof buildWhatsAppTargets>>) {
  const page = window.open(targets.web, "_blank", "noopener,noreferrer");
  if (page) page.opener = null;
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" className="size-4 fill-current" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.99c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.14 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function normalizeWhatsAppPhone(value: string) {
  const digits = value.trim().replace(/^00/u, "").replace(/\D/gu, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function elapsedJobTime(createdAt: string, now: number) {
  const started = Date.parse(createdAt);
  const seconds = Math.max(0, Math.floor((now - (Number.isNaN(started) ? now : started)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

function sanitizeRichText(value: string) {
  if (!/<\/?[a-z][^>]*>/iu.test(value)) {
    return escapeHtml(value).replace(/\n/gu, "<br>");
  }

  const document = new DOMParser().parseFromString(value, "text/html");
  const allowedTags = new Set([
    "BLOCKQUOTE",
    "BR",
    "CODE",
    "EM",
    "H1",
    "H2",
    "H3",
    "HR",
    "LI",
    "OL",
    "P",
    "PRE",
    "S",
    "STRONG",
    "UL"
  ]);

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ""));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
  }

  return document.body.innerHTML;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#039;");
}
