import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorIcon, Settings2Icon, SmartphoneIcon } from "lucide-react";
import { Switch } from "@codexsun/ui/components/switch";
import {
  getHoneyPetVisibility,
  updateHoneyPetVisibility,
  type HoneyPetVisibility
} from "./honey.services";

export function TemaControlWorkspace() {
  const client = useQueryClient();
  const visibility = useQuery({
    queryFn: getHoneyPetVisibility,
    queryKey: ["honey", "pet-visibility"]
  });
  const update = useMutation({
    mutationFn: updateHoneyPetVisibility,
    onSuccess: (data) => client.setQueryData(["honey", "pet-visibility"], data)
  });

  function change(next: Partial<HoneyPetVisibility>) {
    if (!visibility.data) return;
    update.mutate({ ...visibility.data, ...next });
  }

  return (
    <main className="min-h-[calc(100svh-9rem)] rounded-2xl border bg-background">
      <header className="flex items-center gap-3 border-b p-5">
        <Settings2Icon className="size-5" />
        <div>
          <h1 className="font-semibold">TEMA control</h1>
          <p className="text-sm text-muted-foreground">
            Basic pet visibility controls. More controls can be added here later.
          </p>
        </div>
      </header>
      <div className="divide-y px-5">
        <PlatformToggle
          checked={visibility.data?.webEnabled ?? false}
          disabled={visibility.isPending || update.isPending}
          icon={MonitorIcon}
          label="Web pet"
          onChange={(checked) => change({ webEnabled: checked })}
          text="Allow users to show the TEMA pet in the web application."
        />
        <PlatformToggle
          checked={visibility.data?.mobileEnabled ?? false}
          disabled={visibility.isPending || update.isPending}
          icon={SmartphoneIcon}
          label="Mobile pet"
          onChange={(checked) => change({ mobileEnabled: checked })}
          text="Allow users to show the TEMA pet in the mobile application."
        />
        {update.isError ? (
          <p className="py-4 text-sm text-destructive">TEMA pet settings could not be saved.</p>
        ) : null}
      </div>
    </main>
  );
}

function PlatformToggle({
  checked,
  disabled,
  icon: Icon,
  label,
  onChange,
  text
}: {
  checked: boolean;
  disabled: boolean;
  icon: typeof MonitorIcon;
  label: string;
  onChange: (checked: boolean) => void;
  text: string;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 py-4">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <Switch
        aria-label={`Enable ${label.toLowerCase()}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
