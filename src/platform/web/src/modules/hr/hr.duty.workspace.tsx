import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Send } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Card, CardContent } from "@codexsun/ui/components/card";
import { Textarea } from "@codexsun/ui/components/textarea";
import { toast } from "@codexsun/ui/components/sonner";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { useHrDutiesQuery, useHrDutyMutations } from "./hr.hooks";
import type { HrDuty } from "./hr.types";

export function HrDutyWorkspace() {
  const query = useHrDutiesQuery();
  const mutations = useHrDutyMutations();
  const [reporting, setReporting] = useState<HrDuty | null>(null);
  const [actions, setActions] = useState("");

  async function submitReport() {
    if (!reporting || !actions.trim()) return;
    try {
      await mutations.report.mutateAsync({ actions: actions.trim(), sopItem: reporting.sopItem });
      toast.success("Duty report submitted", { description: reporting.sopName });
      setActions("");
      setReporting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Duty report could not be submitted.");
    }
  }

  return (
    <WorkspacePage
      description="Your SOP duties are read live from the connected Frappe site. Add a completion report when work is done."
      technicalName="page.hr.duties"
      title="Duties"
    >
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading live duties…</p>
      ) : null}
      {query.isError ? (
        <p className="text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Duties could not be loaded."}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(query.data ?? []).map((duty) => (
          <DutyCard duty={duty} key={duty.sopItem} onReport={() => setReporting(duty)} />
        ))}
      </div>
      {!query.isLoading && !query.isError && !query.data?.length ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No SOP duties are assigned to your Frappe employee.
          </CardContent>
        </Card>
      ) : null}
      {reporting ? (
        <Card className="sticky bottom-4 border-primary/30 shadow-lg">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="font-semibold">Report: {reporting.sopName}</p>
              <p className="text-sm text-muted-foreground">
                Describe the action completed or note any issue.
              </p>
            </div>
            <Textarea
              autoFocus
              className="min-h-28"
              onChange={(event) => setActions(event.target.value)}
              placeholder="Completed counter opening checks and updated the register."
              value={actions}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setReporting(null)} type="button" variant="outline">
                Cancel
              </Button>
              <Button
                disabled={!actions.trim() || mutations.report.isPending}
                onClick={() => void submitReport()}
                type="button"
              >
                <Send className="size-4" /> Submit report
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </WorkspacePage>
  );
}

function DutyCard({ duty, onReport }: { duty: HrDuty; onReport: () => void }) {
  const latest = duty.reports[0];
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{duty.sopName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {duty.department} · {duty.frequency}
            </p>
          </div>
        </div>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {duty.steps || "No SOP steps were provided."}
        </p>
        {latest ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" /> Last report: {formatDate(latest.createdAt)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No report recorded yet.</p>
        )}
        <Button className="w-full" onClick={onReport} type="button" variant="outline">
          Add report
        </Button>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
