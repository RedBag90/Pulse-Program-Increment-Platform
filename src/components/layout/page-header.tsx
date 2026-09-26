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
      {/* **Schmal bricht die Zeile um.** Die Aktionen standen `shrink-0`
          daneben und drückten den Titel auf drei Wörter je Zeile; ein breiter
          Umschalter lief über den Rand. Der Titel braucht jetzt 16rem, sonst
          rutschen die Aktionen darunter. */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[min(100%,16rem)] flex-1 space-y-1">
          {eyebrow && <div className="text-xs text-muted-foreground">{eyebrow}</div>}
          {/* `font-heading` wie in `EntityDetailShell` — die beiden H1 des Systems
              waren bisher identisch bis auf dieses Wort. Solange das Token
              nichts tat, fiel es nicht auf. */}
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex max-w-full shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
