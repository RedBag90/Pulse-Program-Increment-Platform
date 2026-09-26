"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatEUR } from "@/lib/formatting";
import { CandidateWorksheet } from "@/modules/budgeting/features/components/period/candidate-worksheet";

export interface SheetModel {
  cycleLabel: string;
  poolTotal: number;
  distributable: number;
  groups: { id: string; name: string }[];
  candidates: {
    id: string;
    title: string;
    ask: number;
    kind: string;
    valueStreamName: string | null;
    solutionName: string | null;
  }[];
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
export function Sheets({ model }: { model: SheetModel }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const groups = model.groups.length > 0 ? model.groups : [{ id: "_", name: "Gruppe" }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">
          {model.groups.length > 0
            ? t("budgeting.period.anzahlVerteilboegen", { count: model.groups.length })
            : t("budgeting.period.nochKeineGruppenBeispielbogen")}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("budgeting.period.drucken")}
        </button>
      </div>

      {groups.map((g) => (
        <section
          key={g.id}
          className="rounded-lg border bg-white p-6 text-black print:break-after-page print:rounded-none print:border-0 print:p-0"
        >
          <header className="flex items-baseline justify-between border-b pb-2">
            <h2 className="text-lg font-bold">
              {t("budgeting.period.verteilbogenGruppe", { name: g.name })}
            </h2>
            <span className="text-sm">{model.cycleLabel}</span>
          </header>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">{t("budgeting.period.topf")}</dt>
              <dd className="font-semibold tabular-nums">{formatEUR(model.poolTotal)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("budgeting.period.verteilbar")}</dt>
              <dd className="font-semibold tabular-nums">{formatEUR(model.distributable)}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <CandidateWorksheet
              items={model.candidates}
              sortBy={(c) => c.ask}
              columns={[
                { key: "ask", label: "Anfrage", value: (c) => c.ask, width: "110px" },
                {
                  key: "amount",
                  label: "Betrag",
                  value: () => 0,
                  width: "120px",
                  cell: () => (
                    <span className="inline-block w-24 border-b border-gray-400">{"\u00a0"}</span>
                  ),
                },
              ]}
              title={(c) => <span>{c.title}</span>}
              // Auf Papier gibt es nichts zum Auf- und Zuklappen.
              alwaysOpen
              empty="Keine Kandidaten — die Runde ist nicht gestartet."
            />
          </div>

          <p className="mt-4 text-xs text-gray-500">
            {t("budgeting.period.summeDarfNichtUeberschreiten", {
              amount: formatEUR(model.distributable, locale),
            })}
          </p>
        </section>
      ))}
    </div>
  );
}
