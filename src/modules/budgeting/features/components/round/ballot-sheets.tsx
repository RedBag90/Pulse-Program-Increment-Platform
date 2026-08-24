"use client";

import type { RoundSetupModel } from "@/modules/budgeting/server/views/round-view";

const EUR = (n: number) => `${n.toLocaleString("de-DE")} €`;

/**
 * Verteilbögen (F-B3): ein druckbarer Bogen je Gruppe mit den Ballot-Epics,
 * Kosten und dem verteilbaren Topf. Groups verteilen unabhängig — jeder Bogen
 * ist identisch, nur der Gruppenname wechselt. Bildschirm: Vorschau + Drucken;
 * Druck: ein Bogen pro Seite (`break-after`).
 */
export function BallotSheets({ model }: { model: RoundSetupModel }) {
  const round = model.round;
  const distributable = (round?.poolTotal ?? 0) - model.mandatorySum;
  const demand = model.ballot.reduce((s, e) => s + e.cost, 0);

  const groups = model.groups.length > 0 ? model.groups : [{ id: "_", name: "Gruppe", members: [], spokespersonId: null }];

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
            <span className="text-sm">{model.cycleKey}</span>
          </header>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">Topf</dt>
              <dd className="font-semibold tabular-nums">{EUR(round?.poolTotal ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Pflichtvorhaben</dt>
              <dd className="font-semibold tabular-nums">{EUR(model.mandatorySum)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Verteilbar</dt>
              <dd className="font-semibold tabular-nums">{EUR(distributable)}</dd>
            </div>
          </dl>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5 pr-2 font-medium">Epic</th>
                <th className="py-1.5 pr-2 text-right font-medium">Kosten</th>
                <th className="w-24 py-1.5 text-center font-medium">finanzieren</th>
              </tr>
            </thead>
            <tbody>
              {model.ballot.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-1.5 pr-2">{e.title}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{EUR(e.cost)}</td>
                  <td className="py-1.5 text-center">☐ Ja&nbsp;&nbsp;☐ Nein</td>
                </tr>
              ))}
              {model.ballot.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-500">
                    Keine Ballot-Epics.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-1.5 pr-2">Nachfrage gesamt</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{EUR(demand)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          <p className="mt-4 text-xs text-gray-500">
            Verteilbar {EUR(distributable)} — die Summe der mit „Ja" markierten Epics sollte den
            verteilbaren Topf nicht überschreiten.
          </p>
        </section>
      ))}
    </div>
  );
}
