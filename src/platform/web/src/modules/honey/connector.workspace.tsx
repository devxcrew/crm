import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CircleIcon,
  ExternalLinkIcon,
  RadioTowerIcon,
  TerminalIcon
} from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { apiGet, apiPost } from "../../shared/api/platform-api";

type Status = {
  accountType: string | null;
  available: boolean;
  connected: boolean;
  email: string | null;
  error: string | null;
  planType: string | null;
};
type Login = { authUrl?: string; loginId: string; userCode?: string; verificationUrl?: string };

export function AgentConnectorWorkspace() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ["honey", "connector"],
    queryFn: () => apiGet<Status>("/ai/connector/status"),
    refetchInterval: 5000
  });
  const connect = useMutation({
    mutationFn: (type: "browser" | "device") => apiPost<Login>(`/ai/connector/${type}-login`),
    onSuccess: (login) => {
      if (login.authUrl) window.open(login.authUrl, "_blank");
      if (login.verificationUrl) {
        void navigator.clipboard.writeText(login.userCode ?? "");
        window.open(login.verificationUrl, "_blank");
      }
    }
  });
  const logout = useMutation({
    mutationFn: () => apiPost("/ai/connector/logout"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["honey", "connector"] })
  });
  return (
    <main className="min-h-[calc(100svh-9rem)] rounded-2xl border bg-background">
      <header className="flex items-center gap-3 border-b p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-stone-950 text-white">
          <RadioTowerIcon className="size-4" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Agent Connector</h1>
          <p className="text-sm text-muted-foreground">
            System administrator ChatGPT device authorization
          </p>
        </div>
      </header>
      <section className="flex flex-wrap items-center gap-4 border-b p-5">
        <span className="grid size-9 place-items-center rounded-lg border">
          <TerminalIcon className="size-4" />
        </span>
        <div className="mr-auto">
          <h2 className="font-semibold">Codex</h2>
          <p className="text-sm text-muted-foreground">Independent local runtime</p>
        </div>
        {status.data?.connected ? (
          <>
            <span className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2Icon className="size-4" />
              Connected
            </span>
            <span>{status.data.email}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              {status.data.planType ?? status.data.accountType}
            </span>
            <Button onClick={() => logout.mutate()} variant="ghost">
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 text-muted-foreground">
              <CircleIcon className="size-3 fill-current" />
              Disconnected
            </span>
            <Button onClick={() => connect.mutate("browser")}>
              <ExternalLinkIcon />
              Connect in browser
            </Button>
            <Button onClick={() => connect.mutate("device")} variant="outline">
              <TerminalIcon />
              Use device code
            </Button>
          </>
        )}
      </section>
      {connect.data?.userCode ? (
        <div className="m-5 rounded-xl border bg-muted/30 p-5">
          <p className="text-sm text-muted-foreground">
            Enter this device code in the opened authentication page:
          </p>
          <p className="pt-2 font-mono text-2xl font-semibold tracking-widest">
            {connect.data.userCode}
          </p>
        </div>
      ) : null}
      {status.data?.error ? (
        <p className="p-5 text-sm text-destructive">{status.data.error}</p>
      ) : null}
    </main>
  );
}
