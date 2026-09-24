"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { ToggleGroup, type ToggleGroupOption } from "@/components/ui/toggle-group";
import { STAGE_GATE_KEYS, STAGE_SHORT_KEYS } from "@/components/detail/initiative-labels";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import {
  HORIZON_HEX,
  HORIZON_NONE_HEX,
} from "@/modules/core/org/features/solution/components/horizon-tokens";
import { HORIZON_KEYS, type Horizon } from "@/modules/work/domain/portfolio-guardrails";
import type {
  HorizonColumn,
  StageTowerEpic,
} from "@/modules/work/server/views/portfolio-guardrails-view";
import type { StageGate } from "@/modules/core/kernel/domain/types";

type TowerMode = "stage" | "horizon";

const MODE_OPTIONS: ReadonlyArray<ToggleGroupOption<TowerMode>> = [
  { id: "stage", label: "nach Stage" },
  { id: "horizon", label: "nach Horizont" },
];

/** Spaltenreihenfolge, lokal gehalten: nur Typen kommen aus dem View-Modul,
 *  damit der Client-Bundle keinen Server-View als Laufzeit-Import zieht. */
const HORIZON_COLUMNS: readonly HorizonColumn[] = ["h3", "h2", "h1", "h0", "none"];

const HORIZON_COLUMN_LABEL: Record<HorizonColumn, string> = {
  h3: "H3",
  h2: "H2",
  h1: "H1",
  h0: "H0",
  none: "ohne",
};

function hexFor(horizon: Horizon | null): string {
  return horizon == null ? HORIZON_NONE_HEX : HORIZON_HEX[horizon];
}

/**
 * Epic-Turm: ein Quadrat je Epic, Farbe = Investitionshorizont.
 *
 * Zwei Modi aus einem Bauteil — die Spalten sind entweder die Reifegrade
 * (L0–L5) oder die Horizonte. Die Sortierung innerhalb der Spalten liefert das
 * Page-Model bereits (Stage-Spalten nach Horizont gruppiert, Horizont-Spalten
 * nach Stage); hier wird bewusst **nicht** nachsortiert.
 *
 * Die Quadrate tragen `title` statt eines Tooltip-Bauteils: bei mehreren
 * hundert Epics waeren ebenso viele Tooltip-Instanzen im DOM, fuer denselben
 * Text. Gleiche Wahl wie in `epics-funnel-bar.tsx`.
 */
export function EpicTower({
  epicsByStage,
  epicsByHorizon,
}: {
  epicsByStage: Record<StageGate, StageTowerEpic[]>;
  epicsByHorizon: Record<HorizonColumn, StageTowerEpic[]>;
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<TowerMode>("stage");

  const columns =
    mode === "stage"
      ? STAGE_GATES.map((g) => ({
          key: g as string,
          top: g as string,
          bottom: t(STAGE_SHORT_KEYS[g] ?? ""),
          epics: epicsByStage[g] ?? [],
        }))
      : HORIZON_COLUMNS.map((c) => ({
          key: c as string,
          top: HORIZON_COLUMN_LABEL[c],
          bottom: c === "none" ? "Horizont" : (t(HORIZON_KEYS[c]).split("·")[1]?.trim() ?? ""),
          epics: epicsByHorizon[c] ?? [],
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("work.guardrails.epicTuerme")}</CardTitle>
        <CardDescription className="text-xs">
          Ein Quadrat = ein Epic. Farbe = Horizont. Klick öffnet das Epic.
        </CardDescription>
        <CardAction>
          <ToggleGroup
            value={mode}
            options={MODE_OPTIONS}
            onChange={setMode}
            ariaLabel={t("work.guardrails.turmAchse")}
            className="bg-card text-meta"
          />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2.5">
          {columns.map((col) => (
            <div key={col.key} className="flex flex-1 flex-col items-center gap-1.5">
              {/* wrap-reverse stapelt von unten: die Spalte waechst nach oben,
                  statt eine 37 Eintraege hohe Saeule zu bilden. */}
              <div className="flex w-full flex-wrap-reverse content-start justify-center gap-0.5">
                {col.epics.map((e) => (
                  <Link
                    key={e.id}
                    href={`/portfolio/epics/${e.id}`}
                    title={`${e.title} — ${t(STAGE_GATE_KEYS[e.stageGate] ?? e.stageGate)}`}
                    aria-label={e.title}
                    className={`size-2.5 rounded-[2px] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      e.needsSteeringAttention
                        ? "ring-1 ring-destructive ring-offset-1 ring-offset-card"
                        : ""
                    }`}
                    style={{ backgroundColor: hexFor(e.horizon) }}
                  />
                ))}
              </div>
              <span className="font-mono text-meta text-muted-foreground">{col.epics.length}</span>
              <span className="text-center text-label leading-tight text-muted-foreground">
                {col.top}
                <br />
                {col.bottom}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-label text-muted-foreground">
          {(["h3", "h2", "h1", "h0"] as const).map((h) => (
            <Legend key={h} color={HORIZON_HEX[h]} label={t(HORIZON_KEYS[h])} />
          ))}
          <Legend color={HORIZON_NONE_HEX} label={t("work.guardrails.ohneHorizont")} />
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[2px] ring-1 ring-destructive ring-offset-1 ring-offset-card"
              style={{ backgroundColor: HORIZON_NONE_HEX }}
              aria-hidden
            />
            {t("work.guardrails.brauchtSteuerung")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}
