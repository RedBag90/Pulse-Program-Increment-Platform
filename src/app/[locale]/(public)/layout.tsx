import type { ReactNode } from "react";
import { Zap } from "lucide-react";

/**
 * Öffentliches Layout (kein Auth) für Selbst-Service-Flächen wie `/join` und
 * `/request-tenant`. Bewusst eigene, minimale Chrome — die Seiten rufen NICHT
 * `requirePrincipal`. Eigene Route-Gruppe `(public)`, damit weder das
 * Dashboard- noch das Auth-Layout greift.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="size-5 text-primary-foreground" strokeWidth={2.5} />
        </span>
        <span className="font-heading text-lg font-semibold tracking-tight">Pulse</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
