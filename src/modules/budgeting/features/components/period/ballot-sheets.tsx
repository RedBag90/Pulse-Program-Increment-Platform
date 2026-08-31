"use client";

import { formatEUR } from "@/lib/formatting";

export interface BallotSheetModel {
  cycleLabel: string;
  poolTotal: number;
  distributable: number;
  groups: { id: string; name: string }[];
  candidates: { id: string; title: string; ask: number; kind: string }[];
}

/**
 * Verteilbögen: ein druckbarer Bogen je Gruppe mit den Kandidaten dieser Kachel.
 * Alle Bögen sind identisch, nur der Gruppenname wechselt — die Gruppen
 * verteilen unabhängig voneinander.
 *
 * Lag früher unter `/budgeting/rounds/sheet` und zeigte die Runde des
 * tenant-weiten „aktiven Zyklus" — im Kachel-Modell mehrdeutig. Jetzt hängt der
 * Bogen an genau der Kachel, aus der er gedruckt wird.
 */
export function BallotSheets({ model }: { model: BallotSheetModel }) {
  const demand = model.candidates.reduce((s, c) => s + c.ask, 0);
  const groups = model.groups.length > 0 ? model.groups : [{ id: "_", name: "Gruppe" }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">
          {model.groups.length > 0
            ? `${model.groups.length} Verteilbögen (ein Bogen je Gruppe)`
            : "Noch keine Gruppen — Beispielbogen"}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
        >
          Drucken
        </button>
      </div>

      {groups.map((g) => (
        <section
          key={g.id}
          className="rounded-lg border bg-white p-6 text-black print:break-after-page print:rounded-none print:border-0 print:p-0"
        >
          <header className="flex items-baseline justify-between border-b pb-2">
            <h2 className="text-lg font-bold">Verteilbogen · {g.name}</h2>
            <span className="text-sm">{model.cycleLabel}</span>
          </header>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">Topf</dt>
              <dd className="font-semibold tabular-nums">{formatEUR(model.poolTotal)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Verteilbar</dt>
              <dd className="font-semibold tabular-nums">{formatEUR(model.distributable)}</dd>
            </div>
          </dl>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5 pr-2 font-medium">Kandidat</th>
                <th className="py-1.5 pr-2 text-right font-medium">Anfrage</th>
                <th className="w-28 py-1.5 text-right font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {model.candidates.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-1.5 pr-2">
                    {c.title}
                    {c.kind === "rtb" && <span className="ml-1 text-xs">(RtB)</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatEUR(c.ask)}</td>
                  <td className="py-1.5 text-right">____________ €</td>
                </tr>
              ))}
              {model.candidates.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-500">
                    Keine Kandidaten — die Runde ist nicht gestartet.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-1.5 pr-2">Nachfrage gesamt</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatEUR(demand)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          <p className="mt-4 text-xs text-gray-500">
            Die Summe der verteilten Beträge darf {formatEUR(model.distributable)} nicht
            überschreiten.
          </p>
        </section>
      ))}
    </div>
  );
}
