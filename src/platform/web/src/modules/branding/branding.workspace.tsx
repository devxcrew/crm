import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@codexsun/ui/components/card";
import { Input } from "@codexsun/ui/components/input";
import { toast } from "@codexsun/ui/components/sonner";
import { WorkspaceFormField, WorkspaceFormFooter } from "@codexsun/ui/workspace/upsert";
import { useAppBrand, type AppBrand } from "../../shared/brand/app-brand";
import { apiPut } from "../../shared/api/platform-api";

export function BrandingWorkspace() {
  const brand = useAppBrand();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(brand);
  const mutation = useMutation({
    mutationFn: (input: AppBrand) => apiPut<AppBrand>("/app-branding", input),
    onSuccess: async (saved) => {
      queryClient.setQueryData(["app-branding"], saved);
      await queryClient.invalidateQueries({ queryKey: ["app-branding"] });
      toast.success("App branding saved");
    }
  });

  useEffect(() => setValue(brand), [brand]);

  return (
    <Card className="max-w-2xl shadow-sm">
      <CardHeader>
        <CardTitle>App branding</CardTitle>
        <p className="text-sm text-muted-foreground">
          Update the title and tagline shown in the login screen and application navigation.
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void mutation.mutateAsync({ tagline: value.tagline.trim(), title: value.title.trim() });
          }}
        >
          <WorkspaceFormField label="App title" required>
            <Input
              maxLength={80}
              value={value.title}
              onChange={(event) =>
                setValue((current) => ({ ...current, title: event.target.value }))
              }
            />
          </WorkspaceFormField>
          <WorkspaceFormField label="Tagline" required>
            <Input
              maxLength={180}
              value={value.tagline}
              onChange={(event) =>
                setValue((current) => ({ ...current, tagline: event.target.value }))
              }
            />
          </WorkspaceFormField>
          <WorkspaceFormFooter
            onCancel={() => setValue(brand)}
            primaryLabel="Save branding"
            primaryLoading={mutation.isPending}
          />
          {mutation.isError ? (
            <p className="text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Branding could not be saved."}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
