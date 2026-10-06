import { BookOpen, ChevronRight, Clock3 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@codexsun/ui/components/card";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import changelog from "../../../../../../assist/documentation/CHANGELOG.md?raw";
import CrmUsage from "./content/crm-usage.mdx";
import { MarkdownDocument, MdxDocument } from "./docs.content";

export type DocsPage = "changelog" | "crm" | "index";

const documents = [
  {
    description: "Create, find, update, and follow live Frappe enquiries.",
    icon: BookOpen,
    page: "crm" as const,
    title: "Use CRM"
  },
  {
    description: "Read application changes from the repository release log.",
    icon: Clock3,
    page: "changelog" as const,
    title: "Changelog"
  }
];

export function DocsWorkspace({ page }: { page: DocsPage }) {
  const navigate = useNavigate();
  const open = (target: DocsPage) =>
    void navigate({ to: target === "index" ? "/app/docs" : `/app/docs/${target}` });

  if (page === "crm") {
    return (
      <DocsArticle
        description="A practical guide for daily enquiry work."
        onBack={() => open("index")}
      >
        <MdxDocument>
          <CrmUsage />
        </MdxDocument>
      </DocsArticle>
    );
  }

  if (page === "changelog") {
    return (
      <DocsArticle
        description="The release log from assist/documentation/CHANGELOG.md."
        onBack={() => open("index")}
      >
        <MarkdownDocument source={changelog} />
      </DocsArticle>
    );
  }

  return (
    <WorkspacePage
      description="Guides and release information for CRM."
      technicalName="page.docs.index"
      title="Docs"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {documents.map((document) => (
          <button
            className="text-left"
            key={document.page}
            type="button"
            onClick={() => open(document.page)}
          >
            <Card className="h-full transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <document.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{document.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {document.description}
                  </span>
                </span>
                <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </WorkspacePage>
  );
}

function DocsArticle({
  children,
  description,
  onBack
}: {
  children: React.ReactNode;
  description: string;
  onBack: () => void;
}) {
  return (
    <WorkspacePage
      description={description}
      onBack={onBack}
      technicalName="page.docs.article"
      title="Docs"
    >
      <article className="mx-auto grid w-full max-w-4xl gap-5 rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-8 [&>*]:min-w-0">
        {children}
      </article>
    </WorkspacePage>
  );
}
