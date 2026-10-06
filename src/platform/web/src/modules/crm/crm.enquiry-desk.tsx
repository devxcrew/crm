import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode
} from "react";
import { LoaderCircle, MessageSquareText, Search, Send, UserRound } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
import { toast } from "@codexsun/ui/components/sonner";
import { WorkspaceStatusBadge } from "@codexsun/ui/workspace/status";
import {
  enquiryFilterFromUrl,
  matchesEnquiryFilter,
  type CrmEnquiryListFilter
} from "./crm.enquiry-filters";
import { useCrmEnquiriesQuery, useCrmEnquiryChildMutations } from "./crm.hooks";
import { crmEnquiryStatusOptions } from "./crm.options";
import { getCrmEnquiry } from "./crm.services";
import type { CrmEnquiry, CrmEnquiryStatus, CrmUserReference } from "./crm.types";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata"
});

export function CrmEnquiryDesk({ actorEmail }: { actorEmail: string }) {
  const [filter] = useState<CrmEnquiryListFilter>(enquiryFilterFromUrl);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CrmEnquiry | null>(null);
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);
  const query = useCrmEnquiriesQuery({ status: "all", view: "all" }, { poll: true });
  const messageMutation = useCrmEnquiryChildMutations(setSelected).message;
  const records = useMemo(
    () => filterAndSortEnquiries(query.data ?? [], filter, search),
    [filter, query.data, search]
  );

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ block: "end" });
  }, [selected?.messages.length]);

  async function open(record: CrmEnquiry) {
    setLoadingName(record.frappeName);
    try {
      setSelected(await getCrmEnquiry(record.frappeName));
      setComment("");
      if (window.matchMedia("(max-width: 1023px)").matches) {
        window.setTimeout(
          () => document.querySelector("#enquiry-conversation")?.scrollIntoView(),
          0
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The enquiry could not be loaded.");
    } finally {
      setLoadingName(null);
    }
  }

  async function saveComment() {
    if (!selected || !comment.trim()) return;
    try {
      await messageMutation.mutateAsync([
        selected.frappeName,
        { comment: comment.trim(), messageType: "comment" }
      ]);
      setComment("");
      toast.success("Comment saved to Frappe");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The comment could not be saved.");
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="grid min-h-[calc(100dvh-7rem)] lg:grid-cols-[minmax(19rem,34%)_minmax(0,1fr)]">
        <aside className="flex min-h-[34rem] flex-col border-b lg:max-h-[calc(100dvh-7rem)] lg:border-b-0 lg:border-r">
          <DeskListHeader
            count={records.length}
            filter={filter}
            search={search}
            setSearch={setSearch}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted/90 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="w-20 border-b px-4 py-3 text-left font-medium">ID</th>
                  <th className="w-16 border-b px-2 py-3 text-center font-medium">Age</th>
                  <th className="border-b px-3 py-3 text-left font-medium">Title</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <EnquiryRow
                    active={selected?.frappeName === record.frappeName}
                    key={record.frappeName}
                    loading={loadingName === record.frappeName}
                    onOpen={() => void open(record)}
                    record={record}
                  />
                ))}
              </tbody>
            </table>
            {query.isLoading ? <ListMessage>Loading live enquiries…</ListMessage> : null}
            {query.isError ? <ListMessage>Live enquiries could not be loaded.</ListMessage> : null}
            {!query.isLoading && !query.isError && records.length === 0 ? (
              <ListMessage>No enquiries match this filter.</ListMessage>
            ) : null}
          </div>
        </aside>
        <ConversationPane
          actorEmail={actorEmail}
          comment={comment}
          loading={messageMutation.isPending}
          onCommentChange={setComment}
          onSave={() => void saveComment()}
          record={selected}
          ref={conversationEnd}
        />
      </div>
    </section>
  );
}

function DeskListHeader({
  count,
  filter,
  search,
  setSearch
}: {
  count: number;
  filter: CrmEnquiryListFilter;
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <header className="space-y-3 border-b px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold">{filterLabel(filter)}</h1>
          <p className="text-xs text-muted-foreground">{count.toLocaleString("en-IN")} enquiries</p>
        </div>
        <MessageSquareText className="size-5 text-muted-foreground" />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search enquiries"
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ID, title, mobile, or customer"
          value={search}
        />
      </div>
    </header>
  );
}

function EnquiryRow({
  active,
  loading,
  onOpen,
  record
}: {
  active: boolean;
  loading: boolean;
  onOpen: () => void;
  record: CrmEnquiry;
}) {
  return (
    <tr className={active ? "bg-primary/[0.08]" : "hover:bg-muted/60"}>
      <td className="border-b p-0" colSpan={3}>
        <button
          className="grid w-full cursor-pointer grid-cols-[5rem_4rem_minmax(0,1fr)] items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
          onClick={onOpen}
          type="button"
        >
          <span className="px-4 py-3 font-mono text-xs font-semibold">#{record.id}</span>
          <span className="px-2 py-3 text-center text-xs tabular-nums text-muted-foreground">
            {ageInDays(record.createdAt)}d
          </span>
          <span className="flex min-w-0 items-center gap-2 px-3 py-3">
            <span className="min-w-0 flex-1 truncate font-medium" title={record.title}>
              {record.title || plainText(record.workspace) || "Untitled enquiry"}
            </span>
            {loading ? <LoaderCircle className="size-4 shrink-0 animate-spin" /> : null}
          </span>
        </button>
      </td>
    </tr>
  );
}

const ConversationPane = forwardRef(function ConversationPane(
  {
    actorEmail,
    comment,
    loading,
    onCommentChange,
    onSave,
    record
  }: {
    actorEmail: string;
    comment: string;
    loading: boolean;
    onCommentChange: (value: string) => void;
    onSave: () => void;
    record: CrmEnquiry | null;
  },
  conversationEnd: ForwardedRef<HTMLDivElement>
) {
  if (!record) {
    return (
      <div
        className="grid min-h-[34rem] place-items-center px-6 text-center"
        id="enquiry-conversation"
      >
        <div className="max-w-sm">
          <MessageSquareText className="mx-auto size-9 text-muted-foreground/60" />
          <h2 className="mt-4 font-semibold">Select an enquiry</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Choose a call from the list to read its conversation and add a comment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className="flex min-h-[40rem] min-w-0 flex-col lg:max-h-[calc(100dvh-7rem)]"
      id="enquiry-conversation"
    >
      <ConversationHeader record={record} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/[0.12] px-4 py-5 sm:px-6">
        {record.messages.length ? (
          record.messages.map((message) => {
            const author = messageAuthor(record, message.createdByUserId);
            const mine = author.email.toLowerCase() === actorEmail.toLowerCase();
            return (
              <article
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                <div
                  className={`max-w-[88%] rounded-2xl border px-4 py-3 sm:max-w-[72%] ${mine ? "rounded-br-md border-primary/20 bg-primary/10" : "rounded-bl-md bg-background"}`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {commentText(message.comment)}
                  </p>
                  <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
                    <span>{author.name}</span>
                    <span aria-hidden="true">·</span>
                    <time>{formatDateTime(message.createdAt)}</time>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No comments yet.
          </div>
        )}
        <div ref={conversationEnd} />
      </div>
      <footer className="border-t bg-background p-4 sm:p-5">
        <Textarea
          className="min-h-24 resize-y"
          onChange={(event) => onCommentChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (comment.trim() && !loading) onSave();
            }
          }}
          placeholder="Write a comment…"
          value={comment}
        />
        <div className="mt-3 flex justify-end">
          <Button disabled={!comment.trim() || loading} onClick={onSave} type="button">
            {loading ? <LoaderCircle className="animate-spin" /> : <Send />} Save comment
          </Button>
        </div>
      </footer>
    </section>
  );
});

function ConversationHeader({ record }: { record: CrmEnquiry }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary">
          #{record.id} · {ageInDays(record.createdAt)} days
        </p>
        <h2 className="mt-1 truncate text-lg font-semibold" title={record.title}>
          {record.title}
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className="size-3.5" /> {record.assignedTo?.name ?? "Unassigned"}
        </p>
      </div>
      <WorkspaceStatusBadge label={statusLabel(record.status)} tone={statusTone(record.status)} />
    </header>
  );
}

function ListMessage({ children }: { children: ReactNode }) {
  return <div className="px-5 py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

function filterAndSortEnquiries(
  records: CrmEnquiry[],
  filter: CrmEnquiryListFilter,
  search: string
) {
  const needle = search.trim().toLowerCase();
  return records
    .filter((record) => matchesEnquiryFilter(record, filter))
    .filter((record) => !needle || enquirySearchText(record).includes(needle))
    .sort((left, right) => right.id - left.id);
}

function enquirySearchText(record: CrmEnquiry) {
  return [
    record.id,
    record.title,
    record.workspace,
    record.mobile,
    record.customer,
    record.customerName
  ]
    .join(" ")
    .toLowerCase();
}

function filterLabel(filter: CrmEnquiryListFilter) {
  const labels: Record<string, string> = {
    all: "All calls",
    unassigned: "Unassigned",
    active: "Active calls",
    hold: "Hold calls",
    other: "Other calls",
    "in-progress": "Calls in progress",
    closed: "Closed calls"
  };
  return labels[filter] ?? statusLabel(filter as CrmEnquiryStatus);
}

function statusLabel(status: CrmEnquiryStatus) {
  return crmEnquiryStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function statusTone(
  status: CrmEnquiryStatus
): "danger" | "info" | "neutral" | "success" | "warning" {
  if (status === "won") return "success";
  if (status === "lost") return "danger";
  if (status === "open" || status === "new" || status === "reopen") return "info";
  if (status.startsWith("hold") || status === "long-hold" || status === "escalation")
    return "warning";
  return "neutral";
}

function ageInDays(createdAt: string) {
  const created = Date.parse(createdAt);
  return Number.isNaN(created) ? 0 : Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTime.format(parsed);
}

function messageAuthor(record: CrmEnquiry, userId: string | null) {
  const normalized = userId?.trim().toLowerCase() ?? "";
  const users = [record.createdBy, record.assignedTo].filter(
    (user): user is CrmUserReference => user !== null
  );
  const known = users.find(
    (user) => user.id.toLowerCase() === normalized || user.email.toLowerCase() === normalized
  );
  if (known) return known;
  if (!userId) return { email: "", id: "system", name: "System", uuid: "system" };
  return {
    email: userId.includes("@") ? userId : "",
    id: userId,
    name: readableName(userId),
    uuid: userId
  };
}

function readableName(value: string) {
  return (
    value
      .split("@")[0]!
      .split(/[._-]+/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || value
  );
}

function plainText(value: string) {
  return commentText(value).replace(/\s+/gu, " ").trim();
}

function commentText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<\/(?:blockquote|div|li|ol|p|pre|ul)>/giu, "\n")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/[\t ]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}
