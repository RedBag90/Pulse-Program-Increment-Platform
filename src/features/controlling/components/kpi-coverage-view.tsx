"use client";

import { useActionState, startTransition, useMemo, useState } from "react";
import Link from "next/link";
import type { KpiInventory, ZieleKrLibraryEntry } from "@/server/views/ziele-view";
import { ValuePerUnitInput } from "@/features/controlling/components/value-per-unit-input";
import { setKpiBindingAction } from "@/features/controlling/actions/kr-kpi-binding";

/**
 * KPI-Coverage als reine Tabelle (Refactor §KPI-Coverage als reine Tabelle).
 *
 * Eine Zeile pro KPI. Inline editierbar: `€/Einheit` (operative
 * Bewertung), Ziel-KR (Dropdown), Weight + €/Einheit-Override. Pro
 * Pyramid-Invariante hat jede KPI maximal eine KR-Bindung; ein
 * Re-Bind laeuft atomar via `setKpiBindingAction`.
 *
 * Header zeigt vier Stats (KPIs / Bewertet / Σ Realisierter Beitrag /
 * Setup offen), darunter eine Suchleiste mit Status-Filter.
 */
interface Props {
  inventory: KpiInventory;
  canEdit: boolean;
}

type StatusFilter = "alle" | "setup_offen" | "ungebunden";

export function KpiCoverageView({ inventory, canEdit }: Props) {
  const { kpiLibrary, krLibrary } = inventory;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("alle");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kpiLibrary.filter((k) => {
      if (q && !`${k.name} ${k.epicTitle}`.toLowerCase().includes(q)) return false;
      if (status === "setup_offen" && k.valuePerUnit != null) return false;
      if (status === "ungebunden" && k.binding != null) return false;
      return true;
    });
  }, [kpiLibrary, query, status]);

  const valuedKpis = kpiLibrary.filter((k) => k.valuePerUnit != null).length;
  const missingValue = kpiLibrary.length - valuedKpis;
  const realizedTotal = kpiLibrary.reduce(
    (sum, k) => sum + (k.binding?.contributionRealized ?? 0),
    0,
  );
  const setupOffen = kpiLibrary.filter((k) => k.valuePerUnit == null).length;

  // KRs nach Theme gruppieren — fuer `<optgroup>` im Select.
  const krByTheme = useMemo(() => {
    const map = new Map<string, ZieleKrLibraryEntry[]>();
    for (const kr of krLibrary) {
      const arr = map.get(kr.themeTitle) ?? [];
      arr.push(kr);
      map.set(kr.themeTitle, arr);
    }
    return Array.from(map.entries());
  }, [krLibrary]);

  return (
    <div className="space-y-4">
      {/* Headline-Stats */}
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="KPIs" value={kpiLibrary.length.toString()} />
        <Stat label="Bewertet" value={valuedKpis.toString()} hint={`${missingValue} offen`} />
        <Stat label="Σ Realisierter Beitrag" value={fmtEur(realizedTotal)} tone="emerald" />
        <Stat
          label="Setup offen"
          value={setupOffen.toString()}
          tone={setupOffen === 0 ? "emerald" : "amber"}
        />
      </section>

      {/* Filter-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-[11px]">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="KPI oder Epic suchen…"
            className="h-7 w-64 rounded-md border bg-background px-2 text-xs"
          />
          <FilterChip label="Alle" active={status === "alle"} onClick={() => setStatus("alle")} />
          <FilterChip
            label="Setup offen"
            active={status === "setup_offen"}
            onClick={() => setStatus("setup_offen")}
          />
          <FilterChip
            label="Ungebunden"
            active={status === "ungebunden"}
            onClick={() => setStatus("ungebunden")}
          />
        </div>
        <span className="text-muted-foreground tabular-nums">{filtered.length} sichtbar</span>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>KPI</Th>
              <Th>Epic</Th>
              <Th>Einheit</Th>
              <Th align="right">€/Einheit</Th>
              <Th>Gebunden an KR</Th>
              <Th align="right">Weight</Th>
              <Th align="right">Σ Beitrag</Th>
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Keine KPI passt zum Filter.
                </td>
              </tr>
            )}
            {filtered.map((k) => (
              <KpiRow key={k.id} kpi={k} krByTheme={krByTheme} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiRow({
  kpi,
  krByTheme,
  canEdit,
}: {
  kpi: KpiInventory["kpiLibrary"][number];
  krByTheme: Array<[string, ZieleKrLibraryEntry[]]>;
  canEdit: boolean;
}) {
  const [state, run, pending] = useActionState(setKpiBindingAction, {});

  function submit(formData: FormData) {
    formData.set("kpiId", kpi.id);
    startTransition(() => run(formData));
  }

  const bound = kpi.binding;
  const hasValue = kpi.valuePerUnit != null;

  return (
    <tr id={`kpi-${kpi.id}`} className="hover:bg-muted/30">
      <Td>
        <p className="truncate text-xs font-medium" title={kpi.name}>
          {kpi.name}
        </p>
      </Td>
      <Td>
        <Link
          href={`/portfolio/epics/${kpi.epicId}` as never}
          className="truncate text-xs text-muted-foreground hover:underline"
          title={kpi.epicTitle}
        >
          {kpi.epicTitle}
        </Link>
      </Td>
      <Td>
        <span className="text-xs text-muted-foreground">{kpi.unit ?? "—"}</span>
      </Td>
      <Td align="right" className="tabular-nums">
        <ValuePerUnitInput
          kind="kpi"
          id={kpi.id}
          value={kpi.valuePerUnit}
          canEdit={canEdit}
          {...(kpi.unit ? { unitLabel: `€/${kpi.unit}` } : {})}
        />
      </Td>
      <Td colSpan={2} className="!p-0">
        <form action={submit} className="flex items-center gap-1.5 px-3 py-1">
          <select
            name="keyResultId"
            defaultValue={bound?.keyResultId ?? ""}
            disabled={!canEdit || pending}
            className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
            title="Ziel-Key-Result"
          >
            <option value="">— ungebunden —</option>
            {krByTheme.map(([themeTitle, krs]) => (
              <optgroup key={themeTitle} label={themeTitle}>
                {krs.map((kr) => (
                  <option key={kr.id} value={kr.id}>
                    {kr.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            name="weight"
            type="number"
            step="0.05"
            min={0}
            max={1}
            defaultValue={bound?.weight ?? 1}
            disabled={!canEdit || pending}
            className="h-7 w-16 rounded-md border bg-background px-2 text-right text-xs tabular-nums"
            title="Weight 0..1"
          />
          {canEdit && (
            <button
              type="submit"
              disabled={pending}
              className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              title="Bindung speichern"
            >
              Speichern
            </button>
          )}
        </form>
        {state?.error && <p className="px-3 pb-1 text-[10px] text-destructive">{state.error}</p>}
      </Td>
      <Td align="right" className="tabular-nums text-xs">
        {bound ? (
          <span title={`€${bound.contributionRealized.toLocaleString("de-DE")}`}>
            {fmtEur(bound.contributionRealized)}
          </span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </Td>
      <Td align="right">
        <StatusPill tier={!hasValue ? "setup_offen" : !bound ? "ungebunden" : "ok"} />
      </Td>
    </tr>
  );
}

function StatusPill({ tier }: { tier: "setup_offen" | "ungebunden" | "ok" }) {
  if (tier === "ok") return <span className="text-[11px] text-emerald-600">✓</span>;
  if (tier === "setup_offen") {
    return (
      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
        Setup offen
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
      Ungebunden
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "amber";
}) {
  const valueCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${valueCls}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
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
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "right" | "left";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 align-middle ${
        align === "right" ? "text-right" : "text-left"
      } ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

function fmtEur(n: number): string {
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}
