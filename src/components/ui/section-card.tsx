import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * **Ein Abschnitt ist eine Karte** — der eine Behälter, an dem das Auge eine
 * Fläche als Fläche erkennt.
 *
 * Gehoben aus `epic-overview-tab.tsx`, wo dasselbe Bauteil lokal entstand, weil
 * dort vier Kartenstile nebeneinanderstanden. Es war dort richtig und ist
 * überall richtig; eine zweite Kopie wäre der Anfang des nächsten Zoos.
 *
 * **Warum `SectionLabel` statt `CardTitle`:** `CardTitle` rendert ein `<div>`.
 * Ein Abschnittstitel ist aber eine Überschrift — `SectionLabel` ist ein `<h2>`
 * und trägt bereits das Rezept, das ADR-0021 für die Mikro-Beschriftung
 * festlegt. So stimmt die Gliederung auch für den Screenreader und nicht nur
 * fürs Auge.
 *
 * **Warum das 10-px-Versal über 14-px-Inhalt steht und trotzdem führt:** das
 * Versal-Mikrolabel liest sich als *Etikett*, nicht als konkurrierende
 * Überschrift. Genau so machen es die dreizehn Portfolio-Blöcke, und genau
 * daran erkennt man auf einer dichten Zahlenfläche, wo ein Abschnitt beginnt.
 *
 * Server-Komponente: keine Hooks, damit sie Server-Inhalt umschließen kann.
 */
export function SectionCard({
  title,
  description,
  action,
  bleed = false,
  className,
  contentClassName,
  children,
}: {
  /** Der Abschnittstitel — kurz, er wird versal gesetzt. */
  title: ReactNode;
  /** Ein Satz darunter, der sagt, was man sieht. Optional. */
  description?: ReactNode;
  /** Knopf oder Link rechts im Kopf. */
  action?: ReactNode;
  /**
   * Inhalt bis an die Kartenkante — für breite Zahlentabellen, die sonst 32 px
   * Breite an das Kartenpolster verlieren.
   */
  bleed?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <SectionLabel>{title}</SectionLabel>
        {description != null && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
        {action != null && <CardAction>{action}</CardAction>}
      </CardHeader>
      {/*
        Beide Stufen nötig: `CardContent` setzt `px-4` **und**
        `group-data-[size=sm]/card:px-3`. `tailwind-merge` räumt Varianten
        getrennt auf — ein blosses `px-0` liesse das `px-3` der Variante stehen,
        und die Tabelle behielte ein Polster, das sie nicht haben soll.
      */}
      <CardContent
        className={`${bleed ? "px-0 group-data-[size=sm]/card:px-0" : ""} ${
          contentClassName ?? ""
        }`.trim()}
      >
        {children}
      </CardContent>
    </Card>
  );
}
