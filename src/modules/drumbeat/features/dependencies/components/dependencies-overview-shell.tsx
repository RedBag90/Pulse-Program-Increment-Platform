"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Link2, ShieldAlert, Split, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { unlinkDependencyBatchAction } from "@/modules/drumbeat/features/dependencies/actions/dependency";
import {
  DEPENDENCY_TYPES,
  type DependencyType,
  type DependenciesOverviewModel,
  type DependencyOverviewRow,
} from "@/server/views/dependencies-overview";
import { Page, PageHeader } from "@/components/layout";

interface Props {
  model: DependenciesOverviewModel;
  canBulk: boolean;
}

const TYPE_LABEL: Record<DependencyType, string> = {
  blocks: "Blockiert",
  depends_on: "Hängt ab",
  relates_to: "Bezieht sich",
};
const TYPE_DOT: Record<DependencyType, string> = {
  blocks: "bg-red-500",
  depends_on: "bg-amber-500",
  relates_to: "bg-muted-foreground/40",
};
type ScopeFilter = "all" | "crossArt" | "crossPi" | "inPi";
const SCOPE_LABEL: Record<ScopeFilter, string> = {
  all: "Alle",
  crossArt: "Cross-ART",
  crossPi: "Cross-PI",
  inPi: "Innerhalb eines PI",
};
const SCOPES: ScopeFilter[] = ["all", "crossArt", "crossPi", "inPi"];

function parseType(raw: string | null): DependencyType | null {
  if (!raw) return null;
  return (DEPENDENCY_TYPES as readonly string[]).includes(raw) ? (raw as DependencyType) : null;
}
function parseScope(raw: string | null): ScopeFilter {
  if (raw && SCOPES.includes(raw as ScopeFilter)) return raw as ScopeFilter;
  return "all";
}

/**
 * Cross-PI Dependencies-Overview. Type-Funnel (blocks / depends_on /
 * relates_to) + Filter (From-ART · To-ART · From-PI · To-PI · Scope ·
 * Suche). Bulk-Unlink ART-scoped — alle Auswahlen müssen denselben
 * From-ART teilen, sonst blockt die Bar mit einem Hinweis.
 */
export function DependenciesOverviewShell({ model, canBulk }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = parseType(searchParams.get("type"));
  const fromArt = searchParams.get("fromArt");
  const toArt = searchParams.get("toArt");
  const fromPi = searchParams.get("fromPi");
  const toPi = searchParams.get("toPi");
  const scope = parseScope(searchParams.get("scope"));
  const query = searchParams.get("q") ?? "";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const pushParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filtered = useMemo<DependencyOverviewRow[]>(() => {
    const q = query.trim().toLowerCase();
    return model.rows.filter((r) => {
      if (type != null && r.type !== type) return false;
      if (fromArt && r.from.art?.id !== fromArt) return false;
      if (toArt && r.to.art?.id !== toArt) return false;
      if (fromPi && r.from.pi?.id !== fromPi) return false;
      if (toPi && r.to.pi?.id !== toPi) return false;
      if (scope === "crossArt" && !r.isCrossArt) return false;
      if (scope === "crossPi" && !r.isCrossPi) return false;
      if (scope === "inPi" && (r.isCrossArt || r.isCrossPi)) return false;
      if (q === "") return true;
      if (r.from.title.toLowerCase().includes(q)) return true;
      if (r.to.title.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [model.rows, type, fromArt, toArt, fromPi, toPi, scope, query]);

  const selectedRows = useMemo(
    () => model.rows.filter((r) => selected.has(r.id)),
    [model.rows, selected],
  );
  const selectedFromArtIds = new Set(selectedRows.map((r) => r.from.art?.id).filter(Boolean));
  const bulkArtId = selectedFromArtIds.size === 1 ? [...selectedFromArtIds][0]! : null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const ids = filtered.map((r) => r.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  }
  function runBulk() {
    if (!bulkArtId) return;
    if (!window.confirm(`${selected.size} Abhängigkeit(en) entfernen?`)) return;
    const fd = new FormData();
    for (const r of selectedRows) fd.append("dependencyIds", r.id);
    fd.set("artId", bulkArtId);
    startTransition(async () => {
      setBulkError(null);
      const res = await unlinkDependencyBatchAction({}, fd);
      if (res.error) setBulkError(res.error);
      else setSelected(new Set());
    });
  }

  return (
    <Page>
      <PageHeader
        title="Abhängigkeiten"
        subtitle="Alle Abhängigkeiten im Zugriff über PIs hinweg — Cross-ART und Critical-Path sind direkt sichtbar."
      />

      {/* Type-Funnel */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {DEPENDENCY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pushParam({ type: type === t ? null : t })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
              type === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-muted"
            }`}
          >
            <span className={`size-2 rounded-full ${TYPE_DOT[t]}`} />
            <span>{TYPE_LABEL[t]}</span>
            <span
              className={`tabular-nums ${type === t ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {model.funnelCounts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter-Bar */}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_repeat(5,auto)]">
        <input
          type="search"
          value={query}
          onChange={(e) => pushParam({ q: e.target.value || null })}
          placeholder="Suche Feature …"
          className="rounded-md border border-input bg-card px-3 py-1.5 text-sm"
        />
        <select
          value={scope}
          onChange={(e) => pushParam({ scope: e.target.value === "all" ? null : e.target.value })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={fromArt ?? ""}
          onChange={(e) => pushParam({ fromArt: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle From-ARTs</option>
          {model.artOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={toArt ?? ""}
          onChange={(e) => pushParam({ toArt: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle To-ARTs</option>
          {model.artOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={fromPi ?? ""}
          onChange={(e) => pushParam({ fromPi: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle From-PIs</option>
          {model.piOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={toPi ?? ""}
          onChange={(e) => pushParam({ toPi: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle To-PIs</option>
          {model.piOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabelle */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {canBulk && (
                <th className="py-2 pl-4 pr-2">
                  <input
                    type="checkbox"
                    aria-label="Alle auswählen"
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                    className="size-4 rounded border-border"
                  />
                </th>
              )}
              <th className="py-2 pr-3">Typ</th>
              <th className="py-2 pr-3">From</th>
              <th className="py-2 pr-3">To</th>
              <th className="py-2 pr-3">Scope</th>
              <th className="py-2 pr-4 text-right">Tage offen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canBulk ? 6 : 5}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Keine Abhängigkeiten im aktuellen Filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <DependencyRow
                  key={r.id}
                  row={r}
                  selected={selected.has(r.id)}
                  onToggle={() => toggleSelect(r.id)}
                  canBulk={canBulk}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {filtered.length} von {model.rows.length} Abhängigkeiten im Zugriff.
      </p>

      {canBulk && selected.size > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-2 shadow-lg">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
              {selected.size} ausgewählt
            </span>
            {bulkArtId == null ? (
              <p className="text-xs text-amber-700">
                Bulk-Unlink nur innerhalb eines From-ARTs möglich.
              </p>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={runBulk}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {pending ? "…" : "Lösen"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Auswahl aufheben"
              className="ml-auto rounded border border-input p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
            {bulkError && (
              <p role="alert" className="w-full text-xs text-destructive">
                {bulkError}
              </p>
            )}
          </div>
        </div>
      )}
    </Page>
  );
}

function DependencyRow({
  row,
  selected,
  onToggle,
  canBulk,
}: {
  row: DependencyOverviewRow;
  selected: boolean;
  onToggle: () => void;
  canBulk: boolean;
}) {
  return (
    <tr className="border-b align-middle last:border-b-0 hover:bg-muted/30">
      {canBulk && (
        <td className="py-2 pl-4 pr-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`${row.from.title} → ${row.to.title} auswählen`}
            className="size-4 rounded border-border"
          />
        </td>
      )}
      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`size-2 rounded-full ${TYPE_DOT[row.type]}`} />
          <span className="text-muted-foreground">{TYPE_LABEL[row.type]}</span>
          {row.isCriticalPath && (
            <span
              title="Kritischer Pfad — Blocker mit Ziel in aktiver PI"
              className="inline-flex size-5 items-center justify-center rounded bg-red-100 text-red-700"
            >
              <ShieldAlert className="size-3" />
            </span>
          )}
        </span>
      </td>
      <td className="py-2 pr-3">
        <EndpointCell endpoint={row.from} />
      </td>
      <td className="py-2 pr-3">
        <EndpointCell endpoint={row.to} />
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1">
          {row.isCrossArt && (
            <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">
              <Split className="size-3" /> Cross-ART
            </span>
          )}
          {row.isCrossPi && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
              <Link2 className="size-3" /> Cross-PI
            </span>
          )}
          {!row.isCrossArt && !row.isCrossPi && <span>—</span>}
        </div>
      </td>
      <td className="py-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
        {row.daysOpen}d
      </td>
    </tr>
  );
}

function EndpointCell({ endpoint }: { endpoint: DependencyOverviewRow["from"] }) {
  return (
    <div className="min-w-0">
      {endpoint.id ? (
        <Link
          href={`/feature/${endpoint.id}`}
          className="block max-w-[220px] truncate text-sm font-medium text-primary hover:underline"
          title={endpoint.title}
        >
          {endpoint.title}
        </Link>
      ) : (
        <span className="text-sm font-medium">{endpoint.title}</span>
      )}
      <p className="text-[11px] text-muted-foreground">
        {endpoint.art?.name ?? "—"} · {endpoint.pi?.name ?? "Backlog"}
      </p>
    </div>
  );
}
