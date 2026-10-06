import {
  ArrowUpRightIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  Clock3Icon,
  MessageSquareTextIcon,
  PhoneCallIcon
} from "lucide-react";
import { Card, CardContent } from "@codexsun/ui/components/card";
import { Skeleton } from "@codexsun/ui/components/skeleton";
import { useCrmOverviewQuery } from "./crm.hooks";
import type {
  CrmEnquiryOverview,
  CrmEnquiryOverviewGroup,
  CrmEnquiryPriority,
  CrmEnquiryStatus
} from "./crm.types";

const number = new Intl.NumberFormat();

const statusRows: CrmEnquiryStatus[] = [
  "new",
  "open",
  "hold-for-approval",
  "hold-for-spares",
  "hold-for-job-out",
  "long-hold",
  "escalation",
  "reopen",
  "won",
  "lost"
];

export function CrmOverview({ userName }: { userName: string | undefined }) {
  const query = useCrmOverviewQuery();

  return (
    <section className="space-y-4">
      {query.isLoading ? <OverviewSkeleton /> : null}
      {query.isError ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
          <CardContent className="p-4 text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Enquiry overview could not be loaded."}
          </CardContent>
        </Card>
      ) : null}
      {query.data ? <EnquiryOverviewTable stats={query.data.stats} userName={userName} /> : null}
    </section>
  );
}

function EnquiryOverviewTable({
  stats,
  userName
}: {
  stats: CrmEnquiryOverview["stats"];
  userName: string | undefined;
}) {
  const activeJobs = activeCount(stats.myJob);
  const newJobs = countFor(stats.myJob, "new");
  const inProgressJobs = stats.myJob.inProgress;
  const attentionJobs = countForPriority(stats.myJob, "urgent") + countForPriority(stats.myJob, "high");
  const visibleStatuses = statusRows.filter(
    (status) => countFor(stats.myJob, status) + countFor(stats.myCalls, status) > 0
  );
  const greetingName = firstName(userName);

  return (
    <div className="mx-auto w-full md:w-[70%]">
      <Card className="overflow-hidden border-0 bg-transparent shadow-none">
        <CardContent className="p-0">
          <div className="border-b bg-background px-4 py-6 sm:px-5 sm:py-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">Welcome back</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{greetingName || "My jobs"}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{workSummary({ activeJobs, inProgressJobs, newJobs })}</p>
              </div>
              <a className="inline-flex min-h-10 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-semibold shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground" href={nextActionHref({ attentionJobs, newJobs })}>
                {nextActionLabel({ attentionJobs, newJobs })} <ArrowUpRightIcon className="size-4" />
              </a>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3">
              {([
                { href: "/app/crm/assigned?status=new", label: "New to open", tone: "sky", value: newJobs },
                { href: "/app/crm/assigned?status=active", label: "Needs attention", tone: "amber", value: attentionJobs },
                { href: "/app/crm/assigned?status=active", label: "Active follow-ups", tone: "blue", value: activeJobs }
              ] as const).filter((metric) => metric.value > 0).map((metric) => <FocusMetric {...metric} key={metric.label} />)}
            </div>
          </div>
          <DashboardInsights stats={stats} />
          <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-muted/25 px-4 py-6 sm:px-5 sm:py-7">
            <div>
              <h2 className="text-base font-semibold">Your work mix</h2>
              <p className="text-sm text-muted-foreground">
                A clear view of what needs action, what is progressing, and what you have created.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto overscroll-x-contain px-3 py-5 sm:px-4 sm:py-6">
            <table className="min-w-[580px] w-full border-collapse border border-border text-xs sm:min-w-[620px] sm:text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[38%] border border-border px-4 py-3 font-medium">Status</th>
                <Header icon={BriefcaseBusinessIcon} label="My Job" subtitle="Assigned to me" />
                <Header icon={PhoneCallIcon} label="My Calls" subtitle="Created by me" />
              </tr>
            </thead>
            <tbody>
              <SummaryRow job={stats.myJob.total} calls={stats.myCalls.total} label="All calls" status="all" />
              {activeJobs + activeCount(stats.myCalls) > 0 ? <SummaryRow job={activeJobs} calls={activeCount(stats.myCalls)} label="Active" status="active" /> : null}
              {inProgressJobs + stats.myCalls.inProgress > 0 ? <SummaryRow job={inProgressJobs} calls={stats.myCalls.inProgress} label="In progress" status="in-progress" /> : null}
              {visibleStatuses.map((status) => (
                <StatusRow calls={countFor(stats.myCalls, status)} job={countFor(stats.myJob, status)} key={status} status={status} />
              ))}
              {activeJobs + activeCount(stats.myCalls) > 0 ? <tr className="bg-muted/60 font-medium">
                <td className="border border-border px-4 py-3">Oldest active call</td>
                <td className="border border-border px-4 py-3 text-center tabular-nums">{stats.myJob.oldestActiveDays} days</td>
                <td className="border border-border px-4 py-3 text-center tabular-nums">{stats.myCalls.oldestActiveDays} days</td>
              </tr> : null}
            </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardInsights({ stats }: { stats: CrmEnquiryOverview["stats"] }) {
  const priorityRows = stats.myJob.priorityCounts.filter((entry) => entry.count > 0);
  const attention = countForPriority(stats.myJob, "urgent") + countForPriority(stats.myJob, "high");

  return (
    <div className="grid gap-5 border-b bg-muted/[0.16] px-4 py-6 sm:grid-cols-2 sm:px-5 sm:py-7">
      <InsightCard icon={BarChart3Icon} title="Priority focus">
        {priorityRows.length ? <PriorityChart rows={priorityRows} /> : <EmptyMetric>No assigned priorities right now.</EmptyMetric>}
      </InsightCard>
      <InsightCard icon={Clock3Icon} title="Attention and activity">
        <MetricGrid
          metrics={[
            { href: "/app/crm/assigned?status=active", label: "Needs attention", value: attention },
            { href: "/app/crm/assigned?status=all", label: "Updated this week", value: stats.myJob.activity.updatedLast7Days },
            { href: "/app/crm/assigned?status=all", label: "Created in 7 days", value: stats.myJob.activity.createdLast7Days },
            { href: "/app/crm/assigned?status=all", label: "Created in 30 days", value: stats.myJob.activity.createdLast30Days }
          ]}
        />
      </InsightCard>
      <InsightCard icon={MessageSquareTextIcon} title="Your call activity">
        <MetricGrid
          metrics={[
            { href: "/app/crm/assigned?status=all", label: "Your reactions, 7 days", value: stats.myJob.activity.reactionsLast7Days },
            { href: "/app/crm/assigned?status=all", label: "Your reactions, 30 days", value: stats.myJob.activity.reactionsLast30Days },
            { href: "/app/crm/created?status=all", label: "Comments by you, 30 days", value: stats.commentsByMeLast30Days },
            { href: "/app/crm/assigned?status=all", label: "Calls updated, 30 days", value: stats.myJob.activity.updatedLast30Days }
          ]}
        />
      </InsightCard>
      <InsightCard icon={PhoneCallIcon} title="My Calls at a glance">
        <MetricGrid
          metrics={[
            { href: "/app/crm/created?status=all", label: "Created by you", value: stats.myCalls.total },
            { href: "/app/crm/created?status=active", label: "Active", value: activeCount(stats.myCalls) },
            { href: "/app/crm/created?status=in-progress", label: "In progress", value: stats.myCalls.inProgress },
            { href: "/app/crm/created?status=active", label: "Oldest active call", value: stats.myCalls.oldestActiveDays, suffix: " days" }
          ]}
        />
      </InsightCard>
    </div>
  );
}

function InsightCard({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof BarChart3Icon; title: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-4" /></span>{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PriorityChart({ rows }: { rows: Array<{ count: number; priority: CrmEnquiryPriority }> }) {
  const largest = Math.max(...rows.map((entry) => entry.count));
  return (
    <div className="space-y-2.5">
      {rows.map(({ count, priority }) => (
        <a className="block rounded-sm px-1 py-0.5 transition-colors hover:bg-muted" href={`/app/crm/assigned?status=all&priority=${priority}`} key={priority}>
          <div className="mb-1 flex items-center justify-between text-xs"><span className="capitalize text-muted-foreground">{priority}</span><span className="font-medium tabular-nums">{number.format(count)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${priorityBarClass(priority)}`} style={{ width: `${Math.max(8, (count / largest) * 100)}%` }} /></div>
        </a>
      ))}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<{ href: string; label: string; suffix?: string; value: number | null }> }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border">
      {metrics.map(({ href, label, suffix, value }) => <a className="bg-background px-3 py-2.5 transition-colors hover:bg-primary/[0.06]" href={href} key={label}><p className="text-xs leading-4 text-muted-foreground">{label}</p><p className="mt-0.5 text-base font-semibold tabular-nums">{value === null ? "—" : `${number.format(value)}${suffix ?? ""}`}</p></a>)}
    </div>
  );
}

function EmptyMetric({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }

function FocusMetric({
  href,
  label,
  tone,
  value
}: {
  href: string;
  label: string;
  tone: "amber" | "blue" | "sky";
  value: number;
}) {
  return (
    <a
      className={`rounded-md border border-border/70 border-l-2 bg-background px-3 py-2.5 transition-colors hover:border-primary/40 ${focusMetricTone(tone)}`}
      href={href}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{number.format(value)}</p>
    </a>
  );
}

function focusMetricTone(tone: "amber" | "blue" | "sky") {
  return {
    amber: "border-l-amber-500 hover:bg-amber-50/40",
    blue: "border-l-blue-600 hover:bg-blue-50/40",
    sky: "border-l-sky-500 hover:bg-sky-50/40"
  }[tone];
}

function Header({ icon: Icon, label, subtitle }: { icon: typeof BriefcaseBusinessIcon; label: string; subtitle: string }) {
  return (
    <th className="border border-border px-4 py-3 text-center font-medium">
      <span className="flex items-center justify-center gap-1.5 text-foreground"><Icon className="size-4 text-primary" />{label}</span>
      <span className="mt-0.5 block normal-case tracking-normal text-muted-foreground">{subtitle}</span>
    </th>
  );
}

function SummaryRow({ job, calls, label, status }: { job: number; calls: number; label: string; status: "active" | "all" | "in-progress" }) {
  return (
    <tr className="bg-primary/[0.035] font-medium transition-colors hover:bg-primary/[0.10]">
      <StatusLink label={label} status={status} />
      <CountLink count={job} href={`/app/crm/assigned?status=${status}`} />
      <CountLink count={calls} href={`/app/crm/created?status=${status}`} />
    </tr>
  );
}

function StatusRow({ calls, job, status }: { calls: number; job: number; status: CrmEnquiryStatus }) {
  return (
    <tr className="transition-colors hover:bg-muted/70">
      <StatusLink label={statusLabel(status)} status={status} />
      <CountLink count={job} href={`/app/crm/assigned?status=${status}`} />
      <CountLink count={calls} href={`/app/crm/created?status=${status}`} />
    </tr>
  );
}

function CountLink({ count, href }: { count: number; href: string }) {
  return (
    <td className="border border-border p-0 text-center">
      <a className={`flex min-h-11 w-full items-center justify-center px-4 py-2.5 tabular-nums transition-colors hover:bg-primary/10 hover:text-primary ${count ? "font-semibold" : "text-muted-foreground/60"}`} href={href}>{number.format(count)}</a>
    </td>
  );
}

function StatusLink({ label, status }: { label: string; status: "active" | "all" | "in-progress" | CrmEnquiryStatus }) {
  return <td className="border border-border p-0"><a className="flex min-h-11 w-full items-center px-4 py-2.5 font-medium transition-colors hover:bg-primary/10 hover:text-primary" href={`/app/crm/assigned?status=${status}`}>{label}</a></td>;
}

function activeCount(group: CrmEnquiryOverviewGroup) { return group.total - countFor(group, "won") - countFor(group, "lost"); }
function countFor(group: CrmEnquiryOverviewGroup, status: CrmEnquiryStatus) { return group.statusCounts.find((entry) => entry.status === status)?.count ?? 0; }
function countForPriority(group: CrmEnquiryOverviewGroup, priority: CrmEnquiryPriority) { return group.priorityCounts.find((entry) => entry.priority === priority)?.count ?? 0; }
function priorityBarClass(priority: CrmEnquiryPriority) { return { high: "bg-amber-500", low: "bg-sky-500", normal: "bg-teal-500", urgent: "bg-rose-500" }[priority]; }
function statusLabel(status: CrmEnquiryStatus) { return status.replace(/-/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()); }
function firstName(userName: string | undefined) { return userName?.trim().split(/\s+/u)[0] ?? ""; }
function workSummary({ activeJobs, inProgressJobs, newJobs }: { activeJobs: number; inProgressJobs: number; newJobs: number }) {
  if (newJobs > 0) return `${number.format(newJobs)} new call${newJobs === 1 ? "" : "s"} need your attention.`;
  if (inProgressJobs > 0) return `${number.format(inProgressJobs)} job${inProgressJobs === 1 ? "" : "s"} are in progress.`;
  if (activeJobs > 0) return `${number.format(activeJobs)} active job${activeJobs === 1 ? "" : "s"} are ready for follow-up.`;
  return "You have no active jobs assigned right now.";
}
function nextActionLabel({ attentionJobs, newJobs }: { attentionJobs: number; newJobs: number }) {
  if (newJobs > 0) return "Open new jobs";
  if (attentionJobs > 0) return "Review attention calls";
  return "Open My Job";
}
function nextActionHref({ attentionJobs, newJobs }: { attentionJobs: number; newJobs: number }) {
  if (newJobs > 0) return "/app/crm/assigned?status=new";
  return attentionJobs > 0 ? "/app/crm/assigned?status=active" : "/app/crm/assigned?status=all";
}
function OverviewSkeleton() {
  return <Card className="overflow-hidden shadow-sm"><CardContent className="space-y-3 p-4"><Skeleton className="h-5 w-40" />{Array.from({ length: 8 }, (_, index) => <Skeleton className="h-10 w-full" key={index} />)}</CardContent></Card>;
}
