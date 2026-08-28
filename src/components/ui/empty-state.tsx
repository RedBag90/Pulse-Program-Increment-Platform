import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Geteilter Leer-Zustand — ein zentriertes Titel/Text/Aktion-Muster, das zuvor
 * in jeder Fläche als Eigenbau-`grid place-items-center …` dupliziert war
 * (Cockpit-Board/Tabelle/Netz/Fahrplan, Dependencies-Übersicht). Rein
 * präsentational; Höhe/Rahmen über `className` steuerbar.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
  className,
}: {
  title: string;
  body?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg border bg-muted/20 p-8 text-center",
        className,
      )}
    >
      <div className="max-w-md">
        {icon && <div className="mb-3 flex justify-center text-muted-foreground">{icon}</div>}
        <p className="font-medium">{title}</p>
        {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
