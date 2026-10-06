import type { ReactNode } from "react";
import { MDXProvider } from "@mdx-js/react";
import type { MDXComponents } from "mdx/types";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@codexsun/ui/lib/utils";

const contentComponents: MDXComponents = {
  a: ({ className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4", className)}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]", className)}
      {...props}
    />
  ),
  h1: ({ className, ...props }) => (
    <h1
      className={cn("text-3xl font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "border-b border-border/70 pb-2 text-xl font-semibold text-foreground",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("pl-1", className)} {...props} />,
  ol: ({ className, ...props }) => (
    <ol className={cn("list-decimal space-y-2 pl-6", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("leading-7 text-foreground/80", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn("overflow-x-auto rounded-lg border bg-muted/60 p-4 text-sm", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn("border-b border-r px-3 py-2 align-top last:border-r-0", className)}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border-b border-r bg-muted/60 px-3 py-2 text-left font-semibold last:border-r-0",
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("list-disc space-y-2 pl-6", className)} {...props} />
  )
};

export function MdxDocument({ children }: { children: ReactNode }) {
  return <MDXProvider components={contentComponents}>{children}</MDXProvider>;
}

export function MarkdownDocument({ source }: { source: string }) {
  return (
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {source}
    </ReactMarkdown>
  );
}

// MDX and react-markdown describe the same HTML overrides with incompatible generic aliases.
const markdownComponents = contentComponents as unknown as Components;
