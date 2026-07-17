import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Breadcrumb / back-link block above the title. */
  breadcrumb?: ReactNode;
  /** Small eyebrow line above the title (status pill, meta). */
  eyebrow?: ReactNode;
  /** Right-aligned actions cluster (buttons, toggles). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page header — breadcrumb, title, subtitle, actions. Built to be a
 * direct child of `<Page>`. The page wrapper owns the gap to the next section.
 *
 * See `docs/design-tokens.md`.
 */
export function PageHeader({ title, subtitle, breadcrumb, eyebrow, actions, className }: Props) {
  return (
    <header className={cn("space-y-3", className)}>
      {breadcrumb}
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          {eyebrow && <div className="text-xs text-muted-foreground">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
