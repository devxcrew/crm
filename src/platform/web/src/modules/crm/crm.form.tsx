import { useEffect, useState } from "react";
import { History, MessageSquareText, Save, UserRound } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspaceDatePicker } from "@codexsun/ui/workspace/date-picker";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceMinimalEditor } from "@codexsun/ui/workspace/minimal-editor";
import { WorkspaceSelect } from "@codexsun/ui/workspace/select";
import {
  WorkspaceFormBanner,
  WorkspaceFormField,
  WorkspaceFormFooter,
  WorkspaceFormGrid,
  WorkspaceUpsertDialog
} from "@codexsun/ui/workspace/upsert";
import { cn } from "@codexsun/ui/lib/utils";
import { useCrmCustomerReferencesQuery, useCrmEnquiryMobileMatchesQuery } from "./crm.hooks";
import { useCrmOptionLists } from "./crm.options";
import { crmEnquirySchema } from "./crm.schema";
import type {
  CrmEnquiry,
  CrmEnquiryMobileMatch,
  CrmEnquirySavePayload,
  CrmUserReference
} from "./crm.types";

export const emptyEnquiry: CrmEnquirySavePayload = {
  assignedToUserId: null,
  customer: "",
  enquiryDate: null,
  enquiryGroup: "",
  messages: [],
  mobile: "",
  priority: "normal",
  schedules: [],
  status: "new",
  title: "",
  workspace: ""
};

export function CrmForm({
  canAssign,
  canMobileLookup,
  error,
  loading,
  onCancel,
  onOpenExisting,
  onSubmit,
  open,
  record,
  users
}: {
  canAssign: boolean;
  canMobileLookup: boolean;
  error?: string;
  loading: boolean;
  onCancel: () => void;
  onOpenExisting: (match: CrmEnquiryMobileMatch) => void;
  onSubmit: (value: CrmEnquirySavePayload) => void;
  open: boolean;
  record: CrmEnquiry | null;
  users: CrmUserReference[];
}) {
  return (
    <WorkspaceUpsertDialog
      className={cn(
        "h-[100dvh] w-full max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-lg",
        record ? "sm:max-w-6xl" : "sm:max-w-7xl"
      )}
      description="Create or update a customer enquiry."
      onClose={onCancel}
      open={open}
      title={`${record ? "Edit" : "New"} enquiry`}
    >
      <CrmEnquiryForm
        key={`${record?.id ?? "new"}:${open}`}
        {...(error ? { error } : {})}
        initialValue={
          record
            ? {
                assignedToUserId: record.assignedToUserId,
                customer: record.customer,
                enquiryDate: record.enquiryDate,
                enquiryGroup: record.enquiryGroup,
                messages: record.messages.map(({ comment }) => ({ comment })),
                mobile: record.mobile,
                priority: record.priority,
                schedules: record.schedules.map(({ scheduledOn }) => ({ scheduledOn })),
                status: record.status,
                title: record.title,
                workspace: record.workspace || record.title
              }
            : emptyEnquiry
        }
        loading={loading}
        onCancel={onCancel}
        onOpenExisting={onOpenExisting}
        onSubmit={onSubmit}
        open={open}
        record={record}
        canAssign={canAssign}
        canMobileLookup={canMobileLookup}
        users={users}
      />
    </WorkspaceUpsertDialog>
  );
}

export function CrmEnquiryForm({
  error,
  canAssign,
  canMobileLookup,
  displayMode = "dialog",
  hideMobile = false,
  initialValue,
  loading,
  onCancel,
  onOpenExisting,
  onSubmit,
  open,
  record,
  users
}: {
  canAssign: boolean;
  canMobileLookup: boolean;
  displayMode?: "dialog" | "page";
  error?: string;
  hideMobile?: boolean;
  initialValue: CrmEnquirySavePayload;
  loading: boolean;
  onCancel: () => void;
  onOpenExisting: (match: CrmEnquiryMobileMatch) => void;
  onSubmit: (value: CrmEnquirySavePayload) => void;
  open: boolean;
  record: CrmEnquiry | null;
  users: CrmUserReference[];
}) {
  const crmOptions = useCrmOptionLists();
  const [value, setValue] = useState(initialValue);
  const [customerSearch, setCustomerSearch] = useState(initialValue.customer);
  const [settledCustomerSearch, setSettledCustomerSearch] = useState(initialValue.customer);
  const [validationError, setValidationError] = useState("");
  const [mobileBlurred, setMobileBlurred] = useState(false);
  const [settledMobile, setSettledMobile] = useState(initialValue.mobile);
  const customers = useCrmCustomerReferencesQuery(settledCustomerSearch, open);
  const mobileMatches = useCrmEnquiryMobileMatchesQuery(
    settledMobile,
    canMobileLookup && open && !record && !hideMobile && settledMobile === value.mobile
  );
  const customerError = customers.error instanceof Error ? customers.error.message : "";
  const shownError = validationError || error || customerError;
  const mobileHint = mobileDigitHint(value.mobile);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledCustomerSearch(customerSearch), 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledMobile(value.mobile), 300);
    return () => window.clearTimeout(timer);
  }, [value.mobile]);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const message = getPlainText(value.workspace);
        if (message.length < 2) {
          setValidationError("Enquiry message is required.");
          return;
        }
        const parsed = crmEnquirySchema.safeParse(value);
        if (!parsed.success) {
          setValidationError(parsed.error.issues[0]?.message ?? "Check the enquiry details.");
          return;
        }
        setValidationError("");
        onSubmit({
          ...parsed.data,
          messages: record ? parsed.data.messages : [{ comment: value.workspace.trim() }]
        });
      }}
      className={cn("flex min-h-0 flex-col", displayMode === "dialog" && "overflow-hidden")}
    >
      <div className={cn("min-h-0 flex-1", displayMode === "dialog" && "overflow-y-auto pr-2")}>
        {shownError ? (
          <WorkspaceFormBanner title="Unable to save">{shownError}</WorkspaceFormBanner>
        ) : null}
        <div
          className={cn(
            "grid gap-4",
            displayMode === "page"
              ? "xl:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)]"
              : record
                ? "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)]"
                : "lg:grid-cols-[14rem_minmax(0,1fr)_18rem]"
          )}
        >
          {!record && !hideMobile ? (
            <MobileHistoryDrawer
              canMobileLookup={canMobileLookup}
              loading={mobileMatches.isFetching}
              matches={settledMobile === value.mobile ? (mobileMatches.data ?? []) : []}
              mobile={value.mobile}
              onOpen={onOpenExisting}
              {...(mobileMatches.error instanceof Error
                ? { error: mobileMatches.error.message }
                : {})}
            />
          ) : null}
          <section className="flex min-w-0 flex-col gap-5 rounded-md border border-border/80 bg-muted/10 p-4">
            <WorkspaceFormGrid columns={hideMobile ? 1 : 2}>
              {!hideMobile ? (
                <WorkspaceFormField label="Mobile" required>
                  <div className="grid gap-1.5">
                    <Input
                      {...(mobileHint ? { "aria-describedby": "enquiry-mobile-hint" } : {})}
                      aria-invalid={value.mobile.length > 0 && value.mobile.length !== 10}
                      autoFocus
                      className={
                        mobileBlurred && value.mobile.length === 10
                          ? "border-emerald-500 focus-visible:ring-emerald-500"
                          : undefined
                      }
                      inputMode="tel"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      required
                      value={value.mobile}
                      onBlur={() => setMobileBlurred(true)}
                      onChange={(event) => {
                        setMobileBlurred(false);
                        setValue((current) => ({
                          ...current,
                          mobile: normalizeMobile(event.target.value)
                        }));
                      }}
                      onFocus={() => setMobileBlurred(false)}
                    />
                    {mobileHint ? (
                      <p className="text-xs text-muted-foreground" id="enquiry-mobile-hint">
                        {mobileHint}
                      </p>
                    ) : null}
                  </div>
                </WorkspaceFormField>
              ) : null}
              <WorkspaceFormField label="Customer">
                <WorkspaceLookup
                  allowTextValue={false}
                  loading={customers.isFetching}
                  onTextChange={setCustomerSearch}
                  options={(customers.data ?? []).map((customer) => ({
                    label: customer.name,
                    value: customer.id
                  }))}
                  placeholder="Search existing customer"
                  showAllOptionsOnFocus
                  value={value.customer}
                  onValueChange={(customer) => setValue((current) => ({ ...current, customer }))}
                />
              </WorkspaceFormField>
            </WorkspaceFormGrid>
            <WorkspaceFormField
              className="min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]"
              label="Enquiry message"
              required
            >
              <WorkspaceMinimalEditor
                className="flex min-h-52 flex-1 flex-col sm:min-h-[18rem] [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&_.tiptap]:h-full [&_.tiptap]:min-h-full"
                content={value.workspace}
                placeholder="Enter the customer enquiry..."
                onChange={(workspace) =>
                  setValue((current) => ({
                    ...current,
                    title: shouldUseMessageTitle(current)
                      ? titleFromMessage(workspace)
                      : current.title,
                    workspace
                  }))
                }
              />
            </WorkspaceFormField>
            <WorkspaceFormField label="Title">
              <Input
                maxLength={220}
                placeholder="Auto-filled from the enquiry message"
                value={value.title}
                onChange={(event) =>
                  setValue((current) => ({ ...current, title: event.target.value }))
                }
              />
            </WorkspaceFormField>
          </section>

          <section className="min-w-0 space-y-5 rounded-md border border-border/80 bg-muted/10 p-4">
            <WorkspaceFormGrid columns={1}>
              <WorkspaceFormField label="List in">
                <WorkspaceSelect
                  options={crmOptions.groups}
                  placeholder="Choose Frappe group"
                  value={value.enquiryGroup}
                  onValueChange={(enquiryGroup) =>
                    setValue((current) => ({ ...current, enquiryGroup }))
                  }
                />
              </WorkspaceFormField>
              <WorkspaceFormField label="Assigned to">
                <WorkspaceLookup
                  allowTextValue={false}
                  disabled={!canAssign}
                  options={users.map((user) => ({
                    description: user.email,
                    label: user.name,
                    value: String(user.id)
                  }))}
                  placeholder="Unassigned"
                  showAllOptionsOnFocus
                  value={value.assignedToUserId ? String(value.assignedToUserId) : ""}
                  onValueChange={(userId) =>
                    setValue((current) => ({
                      ...current,
                      assignedToUserId: userId || null
                    }))
                  }
                />
              </WorkspaceFormField>
              <WorkspaceFormField label="Priority" required>
                <WorkspaceSelect
                  options={[
                    { label: "Low", swatchClassName: "bg-sky-500", value: "low" },
                    { label: "Normal", swatchClassName: "bg-teal-500", value: "normal" },
                    { label: "High", swatchClassName: "bg-amber-500", value: "high" },
                    { label: "Urgent", swatchClassName: "bg-red-500", value: "urgent" }
                  ]}
                  value={value.priority}
                  onValueChange={(priority) =>
                    setValue((current) => ({
                      ...current,
                      priority: priority as CrmEnquirySavePayload["priority"]
                    }))
                  }
                />
              </WorkspaceFormField>
              <WorkspaceFormField label="Status" required>
                <WorkspaceSelect
                  options={crmOptions.statuses}
                  value={value.status}
                  onValueChange={(status) =>
                    setValue((current) => ({
                      ...current,
                      status: status as CrmEnquirySavePayload["status"]
                    }))
                  }
                />
              </WorkspaceFormField>
              <WorkspaceFormField label="Due date">
                <WorkspaceDatePicker
                  ariaLabel="Enquiry due date"
                  value={value.enquiryDate ?? ""}
                  onValueChange={(enquiryDate) =>
                    setValue((current) => ({ ...current, enquiryDate: enquiryDate || null }))
                  }
                />
              </WorkspaceFormField>
            </WorkspaceFormGrid>
          </section>
        </div>
      </div>
      <WorkspaceFormFooter
        className={cn(
          "mt-4 shrink-0 border-t pt-4",
          !record && !hideMobile && "lg:ml-[calc(14rem+1rem)]"
        )}
        onCancel={onCancel}
        primaryLabel={record ? "Update enquiry" : "Save enquiry"}
        primaryLoading={loading}
        primaryProps={{
          children: (
            <>
              <Save className="size-4" />
              {record ? "Update enquiry" : "Save enquiry"}
            </>
          )
        }}
      ></WorkspaceFormFooter>
    </form>
  );
}

function getPlainText(value: string) {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/\s+/gu, " ")
    .trim();
}

function titleFromMessage(value: string) {
  return getPlainText(value).split(/\s+/u).slice(0, 8).join(" ");
}

function shouldUseMessageTitle(value: CrmEnquirySavePayload) {
  return !value.title.trim() || value.title === titleFromMessage(value.workspace);
}

function normalizeMobile(value: string) {
  return value.replace(/\D/gu, "").slice(0, 10);
}

function mobileDigitHint(value: string) {
  if (!value.length || value.length === 10) return "";
  return `${10 - value.length} digit${value.length === 9 ? "" : "s"} remaining`;
}

function MobileHistoryDrawer({
  canMobileLookup,
  error,
  loading,
  matches,
  mobile,
  onOpen
}: {
  canMobileLookup: boolean;
  error?: string;
  loading: boolean;
  matches: CrmEnquiryMobileMatch[];
  mobile: string;
  onOpen: (match: CrmEnquiryMobileMatch) => void;
}) {
  const ready = mobile.length === 10;
  return (
    <aside
      className="order-first min-h-48 overflow-y-scroll rounded-md border border-border/80 bg-muted/20 [scrollbar-color:hsl(var(--muted-foreground)/0.42)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-track]:bg-transparent lg:min-h-0"
      dir="rtl"
    >
      <div className="flex min-h-full flex-col p-3" dir="ltr">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-primary" /> Previous enquiries
        </div>
        {!ready ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {!canMobileLookup
              ? "Mobile history is not enabled for this role."
              : "Enter a 10-digit mobile number to check earlier enquiries."}
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {!canMobileLookup ? (
            <p className="text-sm text-muted-foreground">
              Ask an administrator to enable Mobile enquiry lookup for your role.
            </p>
          ) : !ready ? null : loading ? (
            <p className="text-sm text-muted-foreground">Checking live enquiries...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : matches.length ? (
            matches.map((match) => (
              <Button
                className="h-auto w-full items-start justify-start whitespace-normal rounded-md border bg-background px-3 py-2 text-left hover:bg-accent"
                key={match.frappeName}
                type="button"
                variant="ghost"
                onClick={() => onOpen(match)}
              >
                <span className="grid min-w-0 gap-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquareText className="size-3.5" /> #{match.id} ·{" "}
                    {statusLabel(match.status)}
                  </span>
                  <span className="line-clamp-2 text-sm font-medium">{match.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserRound className="size-3.5" /> {match.assignedTo?.name ?? "Unassigned"}
                  </span>
                </span>
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No previous enquiries match this number. Create a new enquiry.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function statusLabel(value: CrmEnquiryMobileMatch["status"]) {
  return value.replace(/-/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}
