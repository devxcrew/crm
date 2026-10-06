import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock3, Phone, Search } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { toast } from "@codexsun/ui/components/sonner";
import { cn } from "@codexsun/ui/lib/utils";
import {
  WorkspaceFormBanner,
  WorkspaceFormSurface,
  WorkspaceUpsertPage
} from "@codexsun/ui/workspace/upsert";
import { CrmEnquiryForm, emptyEnquiry } from "./crm.form";
import {
  useCrmEnquiryMobileMatchesQuery,
  useCrmEnquiryMutations,
  useCrmUsersQuery
} from "./crm.hooks";
import { CrmMobileReferenceColumn } from "./crm.mobile-reference";
import type { CrmEnquirySavePayload } from "./crm.types";

export function CrmEnquiryUpsertPage({
  canAssign,
  canUpdate,
  historyScope
}: {
  canAssign: boolean;
  canUpdate: boolean;
  historyScope: string;
}) {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [searchedMobile, setSearchedMobile] = useState("");
  const [searchError, setSearchError] = useState("");
  const [recentMobiles, setRecentMobiles] = useState<string[]>([]);
  const matches = useCrmEnquiryMobileMatchesQuery(searchedMobile, Boolean(searchedMobile));
  const users = useCrmUsersQuery();
  const mutations = useCrmEnquiryMutations();
  const searchComplete =
    Boolean(searchedMobile) && matches.data !== undefined && !matches.isFetching;
  const latest = searchComplete ? (matches.data[0] ?? null) : null;
  const validMobile = /^\d{10}$/u.test(mobile);
  const recentSuggestions =
    mobile && mobile !== searchedMobile
      ? recentMobiles.filter((recent) => recent.includes(mobile)).slice(0, 5)
      : [];

  useEffect(() => setRecentMobiles(loadRecentMobiles(historyScope)), [historyScope]);

  function searchMobile() {
    if (!/^\d{10}$/u.test(mobile)) {
      setSearchError("Enter exactly 10 numeric digits.");
      return;
    }
    setSearchError("");
    rememberMobile(mobile, historyScope, setRecentMobiles);
    if (mobile === searchedMobile) {
      void matches.refetch();
      return;
    }
    setSearchedMobile(mobile);
  }

  function selectRecentMobile(recentMobile: string) {
    setMobile(recentMobile);
    setSearchError("");
    rememberMobile(recentMobile, historyScope, setRecentMobiles);
    if (recentMobile === searchedMobile) void matches.refetch();
    else setSearchedMobile(recentMobile);
  }

  function clearRecentMobiles() {
    setRecentMobiles([]);
    if (typeof window !== "undefined" && historyScope.trim()) {
      window.sessionStorage.removeItem(recentMobileStorageKey(historyScope));
    }
  }

  async function save(value: CrmEnquirySavePayload) {
    try {
      const saved = await mutations.create.mutateAsync(value);
      toast.success("Enquiry created", { description: `#${saved.id} - ${saved.title}` });
      await navigate({ to: "/app/crm/created" });
    } catch {}
  }

  return (
    <WorkspaceUpsertPage
      backLabel="My Calls"
      className="space-y-5"
      description="Search by mobile, then record the call."
      onBack={() => void navigate({ to: "/app/crm/created" })}
      title="New enquiry"
    >
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          searchMobile();
        }}
      >
        <label className="text-sm font-semibold text-foreground" htmlFor="new-enquiry-mobile">
          Mobile number <span className="text-destructive">*</span>
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center">
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              {...(searchError ? { "aria-describedby": "new-enquiry-mobile-error" } : {})}
              {...(recentSuggestions.length
                ? { "aria-controls": "recent-mobile-suggestions" }
                : {})}
              aria-autocomplete="list"
              aria-invalid={Boolean(searchError)}
              autoFocus
              className={cn(
                "h-11 pl-10 text-base",
                validMobile &&
                  "border-emerald-500 ring-2 ring-emerald-500/20 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
              )}
              id="new-enquiry-mobile"
              inputMode="tel"
              maxLength={10}
              pattern="[0-9]{10}"
              placeholder="Enter 10-digit mobile number"
              value={mobile}
              onChange={(event) => {
                setMobile(normalizeMobile(event.target.value));
                setSearchError("");
              }}
            />
            {recentSuggestions.length ? (
              <div
                className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
                id="recent-mobile-suggestions"
                role="listbox"
              >
                {recentSuggestions.map((recent) => (
                  <Button
                    aria-selected="false"
                    className="h-9 w-full justify-start gap-2 px-2.5 font-normal"
                    key={recent}
                    role="option"
                    type="button"
                    variant="ghost"
                    onClick={() => selectRecentMobile(recent)}
                  >
                    <Clock3 className="size-3.5 text-muted-foreground" />
                    <span className="tabular-nums">{recent}</span>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <Button className="h-11 w-full" disabled={matches.isFetching} type="submit">
            <Search className={cn("size-4", matches.isFetching && "animate-pulse")} />
            {matches.isFetching ? "Searching" : "Search"}
          </Button>
        </div>
        {searchError ? (
          <p className="text-xs text-destructive" id="new-enquiry-mobile-error">
            {searchError}
          </p>
        ) : null}
      </form>

      {matches.error instanceof Error ? (
        <WorkspaceFormBanner title="Unable to search">{matches.error.message}</WorkspaceFormBanner>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.8fr)]">
        <CrmMobileReferenceColumn
          canEdit={canUpdate}
          latest={latest}
          loading={matches.isFetching}
          onEdit={(match) =>
            void navigate({ to: `/app/crm/created?edit=${encodeURIComponent(match.frappeName)}` })
          }
          onOpen={(match) =>
            void navigate({ to: `/app/crm/created?show=${encodeURIComponent(match.frappeName)}` })
          }
          onClearRecent={clearRecentMobiles}
          onSelectRecent={selectRecentMobile}
          recentMobiles={recentMobiles}
          searched={Boolean(searchedMobile)}
        />

        <WorkspaceFormSurface className="p-4 sm:p-5">
          {searchComplete ? (
            <>
              <div className="border-b border-border/80 pb-4">
                <h2 className="text-base font-semibold text-foreground">New enquiry form</h2>
              </div>
              <CrmEnquiryForm
                key={searchedMobile}
                canAssign={canAssign}
                canMobileLookup={false}
                displayMode="page"
                hideMobile
                initialValue={{ ...emptyEnquiry, mobile: searchedMobile }}
                loading={mutations.create.isPending}
                onCancel={() => void navigate({ to: "/app/crm/created" })}
                onOpenExisting={() => undefined}
                onSubmit={(value) => void save(value)}
                open
                record={null}
                users={users.data ?? []}
                {...(mutations.create.error instanceof Error
                  ? { error: mutations.create.error.message }
                  : {})}
              />
            </>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <Search className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Search before creating</h2>
                <p className="mt-1 text-sm text-muted-foreground">Enter a mobile number above.</p>
              </div>
            </div>
          )}
        </WorkspaceFormSurface>
      </div>
    </WorkspaceUpsertPage>
  );
}

function normalizeMobile(value: string) {
  return value.replace(/\D/gu, "").slice(0, 10);
}

function recentMobileStorageKey(scope: string) {
  return `techmedia.crm.recent-mobiles.${encodeURIComponent(scope.trim().toLowerCase())}`;
}

function loadRecentMobiles(scope: string) {
  if (typeof window === "undefined" || !scope.trim()) return [];
  try {
    const value = JSON.parse(window.sessionStorage.getItem(recentMobileStorageKey(scope)) ?? "[]");
    return Array.isArray(value)
      ? value.filter((mobile): mobile is string => /^\d{10}$/u.test(mobile)).slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function rememberMobile(
  mobile: string,
  scope: string,
  setRecentMobiles: Dispatch<SetStateAction<string[]>>
) {
  setRecentMobiles((current) => {
    const next = [mobile, ...current.filter((recent) => recent !== mobile)].slice(0, 8);
    if (typeof window !== "undefined" && scope.trim()) {
      try {
        window.sessionStorage.setItem(recentMobileStorageKey(scope), JSON.stringify(next));
      } catch {
        return next;
      }
    }
    return next;
  });
}
