"use client";

import { useActionState, startTransition } from "react";
import Link from "next/link";
import type {
  ZieleModel,
  ZieleKpiLibraryEntry,
  ZieleKrContribution,
} from "@/server/views/ziele-view";
import { ValuePerUnitInput } from "@/features/controlling/components/value-per-unit-input";
import { bindKpiAction, unbindKpiAction } from "@/features/controlling/actions/kr-kpi-binding";

/**
 * KPI-Coverage-Surface im Controlling (Refactor-Plan §B). Bedient zwei
 * Aufgaben in einer Sicht:
 *
 *   1. **KPI-Bibliothek** — alle Tenant-KPIs mit `valuePerUnit`-Inline-
 *      Edit. Pflicht-Bewertung durch Finance-Controller; ohne Wert
 *      bleibt der KR-Rollup € null.
 *
 *   2. **KR-Coverage** — pro KR eine Zeile mit den gebundenen KPIs als
 *      Chips (Weight, €/Unit-Override, Unbind-Button) + Picker fuer
 *      eine neue Bindung. KRs mit `formula="auto_from_kpi"` ohne
 *      Bindung werden oben hervorgehoben („Setup offen").
 *
 * Pflege der Strategie-Hierarchie (Vision/Theme/Objective/KR) bleibt
 * unter `/strategy`; die Coverage hier ist nur die Bewertungs-Bruecke
 * zwischen Strategie und KPIs.
 */
interface Props {
  model: ZieleModel;
  canEdit: boolean;
}

interface KrRow {
  krId: string;
  krTitle: string;
  formula: string;
  themeId: string;
  themeTitle: string;
  contributions: ZieleKrContribution[];
}

export function KpiCoverageView({ model, canEdit }: Props) {
  const { kpiLibrary, themes } = model;

  const krRows: KrRow[] = [];
  for (const t of themes) {
    for (const kr of t.keyResults) {
      krRows.push({
        krId: kr.id,
        krTitle: kr.title,
        formula: kr.formula,
        themeId: t.id,
        themeTitle: t.title,
        contributions: kr.contributions,
      });
    }
  }

  const setupOffen = krRows.filter(
    (r) => r.formula === "auto_from_kpi" && r.contributions.length === 0,
  );
  const gebunden = krRows.filter(
    (r) => r.contributions.length > 0 || r.formula !== "auto_from_kpi",
  );
  const missingValue = kpiLibrary.filter((k) => k.valuePerUnit == null).length;

  return (
    <div className="space-y-6">
      {/* KPI-Bibliothek */}
      <section className="rounded-lg border bg-card">
        <header className="flex items-baseline justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">KPI-Bibliothek</h3>
            <p className="text-[11px] text-muted-foreground">
              {kpiLibrary.length} KPIs · {missingValue} ohne valuePerUnit
            </p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>KPI</Th>
                <Th>Einheit</Th>
                <Th align="right">€/Einheit</Th>
                <Th>Epic</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kpiLibrary.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Keine KPIs im Tenant — leg im Portfolio-Modul welche an.
                  </td>
                </tr>
              )}
              {kpiLibrary.map((k) => (
                <tr key={k.id} className="hover:bg-muted/30">
                  <Td>{k.name}</Td>
                  <Td>
                    <span className="text-muted-foreground">{k.unit ?? "—"}</span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    <ValuePerUnitInput
                      kind="kpi"
                      id={k.id}
                      value={k.valuePerUnit}
                      canEdit={canEdit}
                      {...(k.unit ? { unitLabel: `€/${k.unit}` } : {})}
                    />
                  </Td>
                  <Td>
                    <Link
                      href={`/portfolio/epics/${k.epicId}` as never}
                      className="truncate hover:underline"
                    >
                      {k.epicTitle}
                    </Link>
                  </Td>
                  <Td align="right">
                    {k.valuePerUnit == null ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        Setup offen
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600">✓</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Setup offen (Auto-KRs ohne Bindung) */}
      {setupOffen.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50">
          <header className="border-b border-amber-200/60 px-4 py-3">
            <h3 className="text-sm font-semibold text-amber-900">
              Setup offen — {setupOffen.length} KR(s) ohne KPI-Bindung
            </h3>
            <p className="text-[11px] text-amber-800/80">
              Diese Key Results haben Formel „aus KPI aggregiert" — bis eine KPI gebunden ist,
              liefern sie keinen €-Beitrag im Rollup.
            </p>
          </header>
          <ul className="space-y-2 p-3">
            {setupOffen.map((row) => (
              <KrCoverageRow key={row.krId} row={row} library={kpiLibrary} canEdit={canEdit} />
            ))}
          </ul>
        </section>
      )}

      {/* Bereits-gebundene KRs (Bind/Unbind-Pflege) */}
      <section className="rounded-lg border bg-card">
        <header className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">KR ↔ KPI Bindungen</h3>
          <p className="text-[11px] text-muted-foreground">
            Pro Key Result die gebundenen KPIs mit Weight + €/Einheit-Override. Strategie-Pflege
            (Title/Beschreibung) lebt unter{" "}
            <Link href={"/strategy" as never} className="text-primary hover:underline">
              Strategie
            </Link>
            .
          </p>
        </header>
        <ul className="divide-y">
          {gebunden.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              Keine Key Results vorhanden.
            </li>
          )}
          {gebunden.map((row) => (
            <li key={row.krId} className="px-4 py-3">
              <KrCoverageRow row={row} library={kpiLibrary} canEdit={canEdit} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KrCoverageRow({
  row,
  library,
  canEdit,
}: {
  row: KrRow;
  library: ZieleKpiLibraryEntry[];
  canEdit: boolean;
}) {
  const boundIds = new Set(row.contributions.map((c) => c.kpiId));
  const available = library.filter((k) => !boundIds.has(k.id));
  const weightSum = row.contributions.reduce(
    (s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0),
    0,
  );

  return (
    <div className="space-y-2">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.krTitle}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {row.themeTitle}{" "}
            {row.formula === "manual" && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase">
                manual
              </span>
            )}
          </p>
        </div>
        {row.contributions.length > 0 && (
          <span
            className={`text-[10px] tabular-nums ${
              Math.abs(weightSum - 1) < 0.001 ? "text-emerald-600" : "text-amber-600"
            }`}
            title="Soll-Summe 100 %"
          >
            Σ Weights {(weightSum * 100).toFixed(0)} %
          </span>
        )}
      </header>

      {row.contributions.length > 0 && (
        <ul className="space-y-1.5">
          {row.contributions.map((c) => (
            <ContributionEditor key={c.kpiId} keyResultId={row.krId} c={c} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit && available.length > 0 && <PickerRow keyResultId={row.krId} options={available} />}
    </div>
  );
}

function ContributionEditor({
  keyResultId,
  c,
  canEdit,
}: {
  keyResultId: string;
  c: ZieleKrContribution;
  canEdit: boolean;
}) {
  const [bindState, bindRun, bindPending] = useActionState(bindKpiAction, {});
  const [unbindState, unbindRun, unbindPending] = useActionState(unbindKpiAction, {});
  const pending = bindPending || unbindPending;
  const err = bindState.error || unbindState.error;

  function rebind(fd: FormData) {
    fd.set("keyResultId", keyResultId);
    fd.set("kpiId", c.kpiId);
    startTransition(() => bindRun(fd));
  }
  function unbind() {
    if (!confirm(`„${c.kpiName}" entkoppeln?`)) return;
    const fd = new FormData();
    fd.set("keyResultId", keyResultId);
    fd.set("kpiId", c.kpiId);
    startTransition(() => unbindRun(fd));
  }

  return (
    <li className="rounded-md border bg-background p-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{c.kpiName}</p>
          <p className="truncate text-[10px] text-muted-foreground">Epic · {c.epicTitle}</p>
        </div>
        <span className="tabular-nums text-[10px] text-muted-foreground">
          {c.achievement != null
            ? `${Math.round(c.achievement * 100)}% · €${Math.round(c.contributionRealized).toLocaleString("de-DE")}`
            : "—"}
        </span>
      </div>
      <form action={rebind} className="mt-2 flex items-center gap-2">
        <label className="flex-1">
          <span className="block text-[10px] uppercase text-muted-foreground">Weight</span>
          <input
            name="weight"
            type="number"
            step="0.05"
            min={0}
            max={1}
            defaultValue={c.weight}
            disabled={!canEdit || pending}
            className="h-7 w-full rounded-md border bg-background px-2 text-xs tabular-nums"
          />
        </label>
        <label className="flex-1">
          <span className="block text-[10px] uppercase text-muted-foreground">
            €/Einheit Override
          </span>
          <input
            name="valuePerUnitOverride"
            type="number"
            step="any"
            defaultValue={c.valuePerUnitOverride ?? ""}
            placeholder="—"
            disabled={!canEdit || pending}
            className="h-7 w-full rounded-md border bg-background px-2 text-xs tabular-nums"
          />
        </label>
        {canEdit && (
          <button
            type="submit"
            disabled={pending}
            className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Speichern
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={unbind}
            disabled={pending}
            className="h-7 rounded-md border px-2 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Entfernen
          </button>
        )}
      </form>
      {err && <p className="mt-1 text-[10px] text-destructive">{err}</p>}
    </li>
  );
}

function PickerRow({
  keyResultId,
  options,
}: {
  keyResultId: string;
  options: ZieleKpiLibraryEntry[];
}) {
  const [state, run, pending] = useActionState(bindKpiAction, {});

  function submit(fd: FormData) {
    fd.set("keyResultId", keyResultId);
    if (!fd.get("weight")) fd.set("weight", "1");
    startTransition(() => run(fd));
  }

  return (
    <form
      action={submit}
      className="flex items-center gap-2 rounded-md border border-dashed bg-card/40 p-2"
    >
      <select
        name="kpiId"
        required
        defaultValue=""
        disabled={pending}
        className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          + KPI binden …
        </option>
        {options.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name} · {k.epicTitle}
            {k.valuePerUnit != null ? ` · €${k.valuePerUnit}/Einheit` : ""}
          </option>
        ))}
      </select>
      <input
        name="weight"
        type="number"
        step="0.05"
        min={0}
        max={1}
        defaultValue="1"
        disabled={pending}
        className="h-7 w-20 rounded-md border bg-background px-2 text-xs tabular-nums"
        title="Weight 0..1"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Hinzufuegen
      </button>
      {state.error && <span className="text-[10px] text-destructive">{state.error}</span>}
    </form>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" | "left" }) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children?: React.ReactNode;
  align?: "right" | "left";
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 align-middle ${
        align === "right" ? "text-right" : "text-left"
      } ${className ?? ""}`}
    >
      {children}
    </td>
  );
}
