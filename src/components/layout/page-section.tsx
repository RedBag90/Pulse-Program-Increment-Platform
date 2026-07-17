import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Optional uppercase eyebrow heading above the section content. */
  title?: ReactNode;
  /** Right-aligned actions next to the title (only rendered when title is set). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Section block inside a `<Page>` — owns the gap between its own children.
 * The page wrapper owns the gap between sibling sections.
 *
 * See `docs/design-tokens.md`.
 */
export function PageSection({ children, title, actions, className }: Props) {
  return (
    <section className={cn("space-y-4", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
