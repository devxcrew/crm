import { useState } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { Label } from "@codexsun/ui/components/label";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceDatePicker } from "@codexsun/ui/workspace/date-picker";
import type { HrStaffRequest, HrStaffRequestSavePayload } from "./hr.types";

const requestTypes = ["Leave", "Permission", "Work from home", "Other"];

export function HrStaffRequestForm({
  error,
  loading,
  onCancel,
  onSubmit,
  record
}: {
  error?: string;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (value: HrStaffRequestSavePayload) => void;
  record: HrStaffRequest | null;
}) {
  const [date, setDate] = useState(record?.date ?? "");
  const [days, setDays] = useState(String(record?.days ?? 1));
  const [details, setDetails] = useState(record?.details ?? "");
  const [requestType, setRequestType] = useState(record?.requestType ?? "Leave");
  const [validation, setValidation] = useState("");

  function submit() {
    const parsedDays = Number(days);
    if (!date || !details.trim() || !Number.isInteger(parsedDays) || parsedDays < 1) {
      setValidation("Enter a date, a whole number of days, and request details.");
      return;
    }
    onSubmit({ date, days: parsedDays, details: details.trim(), requestType });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 rounded-lg border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">{record ? "Edit request" : "New request"}</h2>
        <p className="text-sm text-muted-foreground">Your employee identity is added automatically.</p>
      </div>
      {error || validation ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error ?? validation}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <Label>Request type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => setRequestType(event.target.value)}
            value={requestType}
          >
            {requestTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <Label>Days</Label>
          <Input min="1" onChange={(event) => setDays(event.target.value)} type="number" value={days} />
        </label>
        <div className="space-y-2">
          <Label>Date</Label>
          <WorkspaceDatePicker ariaLabel="Request date" onValueChange={setDate} value={date} />
        </div>
      </div>
      <label className="block space-y-2">
        <Label>Details</Label>
        <Textarea className="min-h-40 resize-y" onChange={(event) => setDetails(event.target.value)} value={details} />
      </label>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button disabled={loading} onClick={submit} type="button">
          {record ? "Update request" : "Send request"}
        </Button>
        <Button disabled={loading} onClick={onCancel} type="button" variant="outline">Cancel</Button>
      </div>
    </div>
  );
}
