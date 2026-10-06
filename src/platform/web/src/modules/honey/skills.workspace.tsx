import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SaveIcon, SparklesIcon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Textarea } from "@codexsun/ui/components/textarea";
import { apiGet, apiPut } from "../../shared/api/platform-api";
import { getHoneyAvailability, updateHoneyAvailability } from "./honey.services";

type Skill = { description: string; enabled: boolean; instructions: string; name: string };
export function SkillLibraryWorkspace() {
  const client = useQueryClient();
  const skills = useQuery({
    queryKey: ["honey", "skills"],
    queryFn: () => apiGet<Skill[]>("/ai/skills")
  });
  const availability = useQuery({
    queryFn: getHoneyAvailability,
    queryKey: ["honey", "availability"]
  });
  const updateAvailability = useMutation({
    mutationFn: updateHoneyAvailability,
    onSuccess: (data) => client.setQueryData(["honey", "availability"], data)
  });
  const save = useMutation({
    mutationFn: (skill: Skill) => apiPut<Skill>(`/ai/skills/${skill.name}`, skill),
    onSuccess: () => client.invalidateQueries({ queryKey: ["honey", "skills"] })
  });
  return (
    <main className="min-h-[calc(100svh-9rem)] rounded-2xl border bg-background">
      <header className="flex items-center gap-3 border-b p-5">
        <SparklesIcon />
        <div>
          <h1 className="font-semibold">TEMA Skill Library</h1>
          <p className="text-sm text-muted-foreground">
            System administrator business knowledge for chat and reviews
          </p>
        </div>
      </header>
      <div className="grid gap-4 p-5">
        <section className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Global TEMA availability</h2>
            <p className="text-sm text-muted-foreground">
              Hide the mascot and chat from all users, and stop new TEMA requests.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium">
            <input
              checked={availability.data?.enabled ?? false}
              disabled={availability.isPending || updateAvailability.isPending}
              onChange={(event) => updateAvailability.mutate(event.target.checked)}
              type="checkbox"
            />
            {availability.data?.enabled ? "Visible and enabled" : "Hidden and disabled"}
          </label>
          {updateAvailability.isError ? (
            <p className="w-full text-sm text-destructive">TEMA availability could not be saved.</p>
          ) : null}
        </section>
        {skills.data?.map((skill) => (
          <SkillCard key={skill.name} skill={skill} onSave={(next) => save.mutate(next)} />
        ))}
      </div>
    </main>
  );
}
function SkillCard({ skill, onSave }: { skill: Skill; onSave: (skill: Skill) => void }) {
  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          name: skill.name,
          description: String(data.get("description")),
          instructions: String(data.get("instructions")),
          enabled: data.get("enabled") === "on"
        });
      }}
    >
      <div className="flex items-center gap-3">
        <h2 className="font-semibold">{skill.name}</h2>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input defaultChecked={skill.enabled} name="enabled" type="checkbox" />
          Use in TEMA
        </label>
      </div>
      <input
        className="h-10 rounded-md border px-3 text-sm"
        defaultValue={skill.description}
        name="description"
      />
      <Textarea className="min-h-28" defaultValue={skill.instructions} name="instructions" />
      <Button className="w-fit" type="submit">
        <SaveIcon />
        Save skill
      </Button>
    </form>
  );
}
