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
 * **Zwei Sorten, ohne Lesen unterscheidbar** (`art-budget-process-layout.md`
 * REQ-3). Eine Fläche aus lauter gleichen Karten ist keine Gliederung: sie
 * tilgt den Unterschied zwischen *hier tue ich etwas* und *hier sehe ich nach*.
 * Deshalb trägt eine **Arbeitsfläche** eine linke Akzentschiene, die Nummer
 * ihres Prozessschritts und ihre Aktion; ein **Nachschlagewerk** trägt nichts
 * davon und bleibt still.
 *
 * Die Schiene ist mit ADR-0021 vereinbar: `border-l-*` ist dort ausdrücklich
 * als **Akzentschiene** erlaubt und vom `HAND_CARD`-Wächter ausgenommen —
 * verboten ist nur der `border` als Kartenumriss.
 *
 * Server-Komponente: keine Hooks, damit sie Server-Inhalt umschließen kann.
 */
export function SectionCard({
  title,
  description,
  action,
  step,
  work = false,
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
   * Nummer des Prozessschritts, den diese Fläche bedient — erscheint als
   * „Schritt n ·" vor dem Titel und macht die Fläche zur **Arbeitsfläche**.
   *
   * Die Nummer ist dieselbe wie in der Finanzierungsleiste
   * (`art-funding-phases.ts`). Damit muss man nichts lesen, um sich zu
   * orientieren — man gleicht die Nummer mit der Leiste ab.
   */
  step?: number;
  /**
   * Arbeitsfläche **ohne** Schrittnummer — für Handlungen ausserhalb einer
   * Kette. `step` setzt das implizit; beides zugleich ist erlaubt und meint
   * dasselbe.
   */
  work?: boolean;
  /**
   * Inhalt bis an die Kartenkante — für breite Zahlentabellen, die sonst 32 px
   * Breite an das Kartenpolster verlieren.
   */
  bleed?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const isWork = work || step != null;
  return (
    <Card
      size="sm"
      className={`${isWork ? "border-l-2 border-l-primary" : ""} ${className ?? ""}`.trim()}
    >
      <CardHeader>
        <SectionLabel>
          {step != null && <span className="text-primary">Schritt {step} · </span>}
          {title}
        </SectionLabel>
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
