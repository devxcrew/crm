import type { ReactNode } from "react";
import { CalendarDays, Clock3, History, Pencil, Phone, UserRound } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { crmEnquiryStatusOptions } from "./crm.options";
import type { CrmEnquiryMobileMatch } from "./crm.types";

export function CrmMobileReferenceColumn({
  canEdit,
  latest,
  loading,
  onEdit,
  onOpen,
  onClearRecent,
  onSelectRecent,
  recentMobiles,
  searched
}: {
  canEdit: boolean;
  latest: CrmEnquiryMobileMatch | null;
  loading: boolean;
  onEdit: (match: CrmEnquiryMobileMatch) => void;
  onOpen: (match: CrmEnquiryMobileMatch) => void;
  onClearRecent: () => void;
  onSelectRecent: (mobile: string) => void;
  recentMobiles: string[];
  searched: boolean;
}) {
  return (
    <div className="grid gap-3 lg:sticky lg:top-4">
      <LatestEnquiryCard
        canEdit={canEdit}
        latest={latest}
        loading={loading}
        onEdit={onEdit}
        onOpen={onOpen}
        searched={searched}
      />
      {recentMobiles.length ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Clock3 className="size-4 shrink-0 text-muted-foreground" />
              <h2 className="truncate text-sm font-semibold text-foreground">
                Recent mobile numbers
              </h2>
            </div>
            <Button
              className="h-7 shrink-0 px-2 text-xs"
              type="button"
              variant="ghost"
              onClick={onClearRecent}
            >
              Clear
            </Button>
          </div>
          <div className="grid h-52 content-start overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1">
            {recentMobiles.map((mobile, index) => (
              <Button
                className="h-9 justify-start gap-3 px-2.5 font-normal"
                key={mobile}
                type="button"
                variant="ghost"
                onClick={() => onSelectRecent(mobile)}
              >
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {recentMobiles.length - index}
                </span>
                <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="tabular-nums">{mobile}</span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LatestEnquiryCard({
  canEdit,
  latest,
  loading,
  onEdit,
  onOpen,
  searched
}: {
  canEdit: boolean;
  latest: CrmEnquiryMobileMatch | null;
  loading: boolean;
  onEdit: (match: CrmEnquiryMobileMatch) => void;
  onOpen: (match: CrmEnquiryMobileMatch) => void;
  searched: boolean;
}) {
  if (loading) {
    return (
      <aside className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Checking live Frappe enquiries...</p>
      </aside>
    );
  }
  if (!searched) {
    return (
      <aside className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="size-4" /> Latest enquiry
        </div>
      </aside>
    );
  }
  if (!latest) {
    return (
      <aside className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="size-4 text-primary" /> No previous enquiry
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Create the first enquiry for this number.
        </p>
      </aside>
    );
  }
  return (
    <aside className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="h-0.5 bg-primary" />
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              #{latest.id} ({formatRelativeTime(latest.createdAt)})
            </p>
            <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-foreground">
              {latest.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              className="h-7 rounded-full px-2.5 text-xs"
              type="button"
              variant="secondary"
              onClick={() => onOpen(latest)}
            >
              Open
            </Button>
            {canEdit && latest.canEdit ? (
              <Button
                aria-label={`Edit enquiry ${latest.id}`}
                className="size-7 rounded-full p-0"
                title="Edit enquiry"
                type="button"
                variant="ghost"
                onClick={() => onEdit(latest)}
              >
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {statusLabel(latest.status)}
          {latest.closedAt && latest.closedBy ? (
            <span className="ml-auto text-right text-foreground">
              Closed by {latest.closedBy} ({formatRelativeTime(latest.closedAt)})
            </span>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm">
          <LatestDetail
            icon={<UserRound className="size-4" />}
            label="Assigned to"
            value={latest.assignedTo?.name ?? "Unassigned"}
          />
          <LatestDetail
            icon={<CalendarDays className="size-4" />}
            label="Created"
            value={formatDate(latest.createdAt)}
          />
        </dl>
      </div>
    </aside>
  );
}

function LatestDetail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function statusLabel(status: CrmEnquiryMobileMatch["status"]) {
  return crmEnquiryStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "unknown time";

  const seconds = Math.round((Date.now() - timestamp) / 1_000);
  const absoluteSeconds = Math.abs(seconds);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"]
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  for (const [secondsPerUnit, unit] of units) {
    if (absoluteSeconds >= secondsPerUnit) {
      return formatter.format(Math.round(-seconds / secondsPerUnit), unit);
    }
  }
  return seconds < 0 ? "in a moment" : "just now";
}
