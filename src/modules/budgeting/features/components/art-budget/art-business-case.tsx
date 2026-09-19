import { formatEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  ORIGIN_GROUP_LABELS,
  type ArtBudgetOrigin,
  type OriginGroup,
} from "@/modules/budgeting/domain/art-budget-origin";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * **Woher das Geld dieses ARTs kommt** — ein Nachschlagewerk, keine
 * Arbeitsfläche: keine Schiene, keine Schrittnummer, kein Knopf.
 *
 * Sie steht **über** der Verteilfläche, weil sie die Handlung begründet
 * (`art-budget-process-layout.md`, REQ-4): erst sieht man, worüber man
 * entscheidet, dann entscheidet man.
 *
 * Die Tabelle beantwortet drei Fragen auf einmal, und die Spaltenköpfe sagen
 * welche: *wie viel* (Betrag), *wie gewichtig* (Anteil an Σ gesamt) und *was
 * kostet es dauerhaft* (p. a. — nur Betrieb, siehe unten).
 */

const GROUPS: OriginGroup[] = ["change", "operating"];

/** Was die Gruppe finanziert — der Satz, der die Trennung trägt. */
const GROUP_NOTE: Record<OriginGroup, string> = {
  change: "finanziert Vorhaben",
  operating: "bezahlt kein Feature",
};

/** Die Überschrift der Betragsspalte (REQ-8). */
const BASIS_LABEL: Record<ArtBudgetOrigin["basis"], string> = {
  awarded: "zugesprochen",
  planned: "beantragt",
  mixed: "gemischt",
};

export function ArtBusinessCase({
  origin,
  artName,
}: {
  origin: ArtBudgetOrigin;
  /** Steht im Titel: er ist die oberste Karte des ART-Reiters und benennt ihn. */
  artName: string;
}) {
  const hj = halfYearLabel(origin.cycleKey);
  const titel = `Business Case · ${artName}`;

  if (origin.isEmpty) {
    return (
      <SectionCard title={titel}>
        <EmptyState
          title={`An diesem ART landet in ${hj} kein Geld`}
          body="Weder aus einer Budget-Kachel, noch aus einem ART-Rahmen, noch aus einer Betriebsposition. Sobald eine Kachel für dieses Halbjahr festgeschrieben ist, steht die Herkunft hier."
        />
      </SectionCard>
    );
  }

  const subtotal = (g: OriginGroup) =>
    g === "change" ? origin.changeTotal : origin.operatingTotal;
  const prozent = (share: number) => `${Math.round(share * 100)} %`;

  return (
    <SectionCard
      title={titel}
      description={`Woher das Geld kommt, das in ${hj} an diesem ART landet. Σ gesamt heisst „was dieses ART hat“ — der zugesprochene, noch nicht verteilte Rahmen zählt mit.`}
      bleed
      contentClassName="space-y-3"
    >
      <div className="overflow-x-auto border-y">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-meta uppercase tracking-[0.1em] text-muted-foreground">
              <th className="p-2 text-left font-medium">Herkunft</th>
              <th className="p-2 text-right font-medium">
                {hj}
                <span className="ml-1 normal-case tracking-normal">
                  · {BASIS_LABEL[origin.basis]}
                </span>
              </th>
              <th className="p-2 text-right font-medium">
                Anteil
                <span className="ml-1 normal-case tracking-normal">· an Σ gesamt</span>
              </th>
              {/*
                Die halbe Spalte bleibt leer, und das ist keine Datenlücke:
                Veränderungsgeld wird je Halbjahr entschieden und hat keinen
                Jahreswert. Ohne diesen Zusatz sieht die Leere wie ein Fehler aus.
              */}
              <th className="border-l p-2 text-right font-medium">
                p. a.
                <span className="ml-1 normal-case tracking-normal">· nur Betrieb, geplant</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <ArtBusinessCaseGroup
                key={g}
                group={g}
                rows={origin.rows.filter((r) => r.group === g)}
                subtotal={subtotal(g)}
                prozent={prozent}
              />
            ))}
            <tr className="border-t-2 font-semibold">
              <td className="p-2">Σ gesamt</td>
              <td className="p-2 text-right tabular-nums">{formatEUR(origin.total)}</td>
              <td className="p-2 text-right tabular-nums">100 %</td>
              <td className="border-l p-2" />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="px-3 text-meta text-muted-foreground">
        {origin.basis === "mixed"
          ? `Gemischt: was aus der Kachel kommt, ist entschieden; die Betriebspositionen sind für ${hj} noch nicht aufgeteilt und stehen mit ihrem beantragten Betrag.`
          : origin.basis === "planned"
            ? `Für ${hj} ist der Zuspruch des Wertstroms noch nicht aufgeteilt — die Betriebspositionen stehen mit ihrem beantragten Betrag.`
            : "Alle Beträge sind für dieses Halbjahr zugesprochen."}{" "}
        Betrieb und Veränderung stehen getrennt: Deckung, Lücke und der €-Satz rechnen ohne den
        Betrieb.
      </p>
    </SectionCard>
  );
}

function ArtBusinessCaseGroup({
  group,
  rows,
  subtotal,
  prozent,
}: {
  group: OriginGroup;
  rows: ArtBudgetOrigin["rows"];
  subtotal: number;
  prozent: (share: number) => string;
}) {
  return (
    <>
      <tr className="border-b bg-surface-frame/60">
        {/*
          Dieselbe Leiter wie in „Einrichten": die Gruppe ist ein
          Unterabschnitt und trägt `text-sm` wie ihre Zeilen — unterschieden
          wird über das Gewicht. `text-label` (10 px) ist laut ADR-0021 das
          **Versal**-Mikrolabel und war hier zwei Stufen zu klein.
        */}
        <td colSpan={4} className="px-2 pb-1.5 pt-3 text-sm font-semibold">
          {ORIGIN_GROUP_LABELS[group]}
          <span className="ml-2 text-meta font-normal text-muted-foreground">
            — {GROUP_NOTE[group]}
          </span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.key} className="border-b">
          <td className="p-2 pl-4">
            {r.label}
            {r.estimated && (
              // Ein gleichmässiger Schlüssel ist keine Messung. Ohne das Wort
              // hält jemand die Zahl für zugeordnet — und rechnet mit ihr weiter.
              <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-meta text-muted-foreground">
                geschätzt
              </span>
            )}
          </td>
          <td className="p-2 text-right tabular-nums">{formatEUR(r.amount)}</td>
          <td className="p-2 text-right tabular-nums text-muted-foreground">{prozent(r.share)}</td>
          <td className="border-l p-2 text-right tabular-nums text-muted-foreground">
            {r.annual == null ? <span aria-hidden>—</span> : formatEUR(r.annual)}
          </td>
        </tr>
      ))}
      <tr className="border-b font-medium">
        <td className="p-2 pl-4">Σ {ORIGIN_GROUP_LABELS[group]}</td>
        <td className="p-2 text-right tabular-nums">{formatEUR(subtotal)}</td>
        <td className="p-2" />
        <td className="border-l p-2" />
      </tr>
    </>
  );
}
