"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FEATURE_STATUSES, type FeatureStatus } from "@/server/views/features-list";
import type { FeaturesOverviewModel, FeatureOverviewRow } from "@/server/views/features-overview";
import type { WsjfTier } from "@/server/views/features-list";

interface Props {
  model: FeaturesOverviewModel;
}

const WSJF_TIERS: readonly WsjfTier[] = ["high", "medium", "low", "none"];
const TIER_LABEL: Record<WsjfTier, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  none: "Ungescored",
};
const STATUS_LABEL: Record<FeatureStatus, string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  in_progress: "In Umsetzung",
  completed: "Abgeschlossen",
};
const STATUS_DOT: Record<FeatureStatus, string> = {
  draft: "bg-muted-foreground/40",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  completed: "bg-emerald-500",
};

type SortKey = "wsjf:desc" | "createdAt:desc" | "createdAt:asc";
const SORT_KEYS: SortKey[] = ["wsjf:desc", "createdAt:desc", "createdAt:asc"];

function parseStatus(raw: string | null): FeatureStatus | null {
  if (!raw) return null;
  return (FEATURE_STATUSES as readonly string[]).includes(raw) ? (raw as FeatureStatus) : null;
}
function parseTier(raw: string | null): WsjfTier | null {
  if (!raw) return null;
  return (WSJF_TIERS as readonly string[]).includes(raw) ? (raw as WsjfTier) : null;
}
function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return "wsjf:desc";
}

/**
 * Cross-VS/Cross-ART Features-Übersicht. Funnel-Header über die vier
 * Feature-Statuus + Filter-Bar (VS · ART · PI · Epic · WSJF-Tier ·
 * Suche) + sortierte Liste mit VS- und ART-Chip pro Zeile.
 *
 * Bewusst read-only in v1: keine Bulk-PI-Reassign, weil die per-Item
 * Auth-Resource pro ART unterschiedlich ist und das ein eigener PR
 * wert ist.
 */
export function FeaturesOverviewShell({ model }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = parseStatus(searchParams.get("status"));
  const valueStreamId = searchParams.get("vs");
  const artId = searchParams.get("art");
  const piId = searchParams.get("pi");
  const epicId = searchParams.get("epic");
  const tier = parseTier(searchParams.get("tier"));
  const query = searchParams.get("q") ?? "";
  const sort = parseSort(searchParams.get("sort"));

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

  // ART-Optionen werden vom Value-Stream-Filter automatisch verengt.
  const artsForVs = useMemo(() => {
    if (!valueStreamId) return model.artOptions;
    return model.artOptions.filter((a) => a.valueStreamId === valueStreamId);
  }, [model.artOptions, valueStreamId]);

  const filtered = useMemo<FeatureOverviewRow[]>(() => {
    const q = query.trim().toLowerCase();
    const arr = model.rows.filter((r) => {
      if (status != null && r.status !== status) return false;
      if (valueStreamId && r.valueStream?.id !== valueStreamId) return false;
      if (artId && r.art.id !== artId) return false;
      if (piId === "backlog" && r.pi != null) return false;
      if (piId && piId !== "backlog" && r.pi?.id !== piId) return false;
      if (epicId && r.epic?.id !== epicId) return false;
      if (tier && r.wsjfTier !== tier) return false;
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.epic?.title.toLowerCase().includes(q)) return true;
      if (r.art.name.toLowerCase().includes(q)) return true;
      if (r.valueStream?.name.toLowerCase().includes(q)) return true;
      return false;
    });
    const sorted = arr.slice();
    switch (sort) {
      case "createdAt:desc":
        sorted.sort((a, b) => b.createdAtMs - a.createdAtMs);
        break;
      case "createdAt:asc":
        sorted.sort((a, b) => a.createdAtMs - b.createdAtMs);
        break;
      case "wsjf:desc":
      default:
        sorted.sort((a, b) => (b.wsjfComputed ?? -1) - (a.wsjfComputed ?? -1));
        break;
    }
    return sorted;
  }, [model.rows, status, valueStreamId, artId, piId, epicId, tier, query, sort]);

  return (
    <main className="p-6 md:p-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Features-Übersicht</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Features im Zugriff — über Wertströme, ARTs und PIs hinweg.
        </p>
      </header>

      {/* Funnel-Header */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FEATURE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pushParam({ status: status === s ? null : s })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
              status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-muted"
            }`}
          >
            <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} />
            <span>{STATUS_LABEL[s]}</span>
            <span
              className={`tabular-nums ${status === s ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {model.funnelCounts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter-Bar */}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_repeat(5,auto)_auto]">
        <input
          type="search"
          value={query}
          onChange={(e) => pushParam({ q: e.target.value || null })}
          placeholder="Suche Titel · Epic · ART …"
          className="rounded-md border border-input bg-card px-3 py-1.5 text-sm"
        />
        <select
          value={valueStreamId ?? ""}
          onChange={(e) => pushParam({ vs: e.target.value || null, art: null /* invalidiert */ })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle Wertströme</option>
          {model.valueStreamOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={artId ?? ""}
          onChange={(e) => pushParam({ art: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle ARTs</option>
          {artsForVs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={piId ?? ""}
          onChange={(e) => pushParam({ pi: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle PIs</option>
          <option value="backlog">— Backlog</option>
          {model.piOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={epicId ?? ""}
          onChange={(e) => pushParam({ epic: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle Epics</option>
          {model.epicOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        {model.showWsjf && (
          <select
            value={tier ?? ""}
            onChange={(e) => pushParam({ tier: e.target.value || null })}
            className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Alle WSJF-Tiers</option>
            {WSJF_TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => pushParam({ sort: e.target.value })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="wsjf:desc">WSJF abwärts</option>
          <option value="createdAt:desc">Neueste zuerst</option>
          <option value="createdAt:asc">Älteste zuerst</option>
        </select>
      </div>

      {/* Tabelle */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-4 pr-2">Feature</th>
              <th className="py-2 pr-3">Wertstrom · ART</th>
              <th className="py-2 pr-3">Epic</th>
              <th className="py-2 pr-3">PI</th>
              <th className="py-2 pr-3">Status</th>
              {model.showWsjf && <th className="py-2 pr-4 text-right">WSJF</th>}
              <th className="py-2 pr-4 text-right">AK</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={model.showWsjf ? 7 : 6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Keine Features im aktuellen Filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => <FeatureRow key={r.id} row={r} showWsjf={model.showWsjf} />)
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {filtered.length} von {model.rows.length} Features im Zugriff.
      </p>
    </main>
  );
}

function FeatureRow({ row, showWsjf }: { row: FeatureOverviewRow; showWsjf: boolean }) {
  const statusKey = (FEATURE_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as FeatureStatus)
    : null;
  return (
    <tr className="border-b align-middle last:border-b-0 hover:bg-muted/30">
      <td className="py-2 pl-4 pr-2">
        <div className="flex items-center gap-2">
          {statusKey != null && (
            <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[statusKey]}`} aria-hidden />
          )}
          <Link
            href={`/umsetzung/feature/${row.id}`}
            className="block truncate font-medium text-primary hover:underline"
            title={row.title}
          >
            {row.title}
          </Link>
          {row.isBlocked && (
            <span
              className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700"
              title="Ziel einer Blocker-Abhängigkeit"
            >
              🛑
            </span>
          )}
        </div>
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">
        <span className="block max-w-[180px] truncate">
          {row.valueStream?.name ?? "—"} · {row.art.name}
        </span>
      </td>
      <td className="py-2 pr-3 text-xs">
        {row.epic ? (
          <Link
            href={`/portfolio/epics/${row.epic.id}`}
            className="block max-w-[160px] truncate text-primary hover:underline"
            title={row.epic.title}
          >
            {row.epic.title}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 pr-3 text-xs">
        {row.pi ? (
          <Link
            href={`/pi/${row.pi.id}`}
            className="text-primary hover:underline"
            title={row.pi.name}
          >
            {row.pi.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">Backlog</span>
        )}
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">
        {statusKey != null ? STATUS_LABEL[statusKey] : row.status}
      </td>
      {showWsjf && (
        <td className="py-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
          {row.wsjfComputed != null ? row.wsjfComputed.toFixed(1) : "—"}
        </td>
      )}
      <td className="py-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
        {row.acceptanceCriteriaCount}
      </td>
    </tr>
  );
}
