"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { FEATURE_STATUSES, type FeatureStatus, type WsjfTier } from "@/server/views/features-list";
import { formatWsjf } from "@/domain/schemas/initiative";
import type { FeatureOverviewRow, FeaturesOverviewModel } from "@/server/views/features-overview";
import { FEATURE_TYPES, FEATURE_TYPE_LABEL } from "@/modules/work/domain/portfolio-guardrails";

/**
 * Die geteilte Feature-Darstellung: Zähl-Chips, Filterleiste und Tabelle.
 *
 * Sie lag ursprünglich als Monolith in der Features-Übersicht (Drumbeat) und
 * wird jetzt auch vom Deliverables-Reiter eines Epics (Work) gebraucht. Weil
 * Importe nur abwärts zeigen dürfen (ADR-0013) und Work nicht auf Drumbeat
 * zugreifen darf, wohnt das Geteilte hier in **Work** — Drumbeat importiert es
 * abwärts.
 *
 * Zwei Dinge unterscheiden die Einsatzorte, beide über Props gelöst statt über
 * Verzweigungen im Inneren:
 *
 * 1. **Spalten.** Im Epic sind „Epic" und „Wertstrom" in jeder Zeile derselbe
 *    Wert — sie werden dort ausgeblendet. Die Leerzeilen-`colSpan` und das
 *    Raster der Filterleiste leiten sich daraus ab, statt hartkodiert zu sein;
 *    genau daran wäre der Umbau sonst zerbrochen.
 * 2. **Query-Parameter.** Auf der Epic-Detailseite sind `tab`, `breakdownView`
 *    und `featureId` bereits belegt. Deshalb `paramPrefix` — der Reiter schreibt
 *    `dl.q`, `dl.status` usw. und kollidiert mit nichts.
 *
 * Die Übersicht bleibt read-only; der Reiter reicht seine Bearbeiten-Funktionen
 * über die Slots `renderActions`, `renderExpanded` und `renderStatus` herein.
 */

// ---------------------------------------------------------------------------
// Vokabular (vorher modul-lokal in der Übersicht)
// ---------------------------------------------------------------------------

export const WSJF_TIERS: readonly WsjfTier[] = ["high", "medium", "low", "none"];

const TIER_LABEL: Record<WsjfTier, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  none: "Ungescored",
};

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  draft: "Entwurf",
  approved: "Freigegeben",
  in_progress: "In Umsetzung",
  completed: "Abgeschlossen",
};

/** Achtung: `approved` und `completed` sind beide grün, nur unterschiedlich gesättigt. */
export const FEATURE_STATUS_DOT: Record<FeatureStatus, string> = {
  draft: "bg-muted-foreground/40",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  completed: "bg-emerald-500",
};

/** Unbekannter Status ⇒ `null`; die Zelle zeigt dann den Rohwert. */
export function toFeatureStatus(raw: string): FeatureStatus | null {
  return (FEATURE_STATUSES as readonly string[]).includes(raw) ? (raw as FeatureStatus) : null;
}

type SortKey = "wsjf:desc" | "createdAt:desc" | "createdAt:asc";
const SORT_KEYS: SortKey[] = ["wsjf:desc", "createdAt:desc", "createdAt:asc"];

export type FeatureColumn = "valueStream" | "epic" | "pi" | "status" | "wsjf" | "ak";
const ALL_COLUMNS: readonly FeatureColumn[] = [
  "valueStream",
  "epic",
  "pi",
  "status",
  "wsjf",
  "ak",
];

// ---------------------------------------------------------------------------
// URL-State + Filterung
// ---------------------------------------------------------------------------

function parse<T extends string>(raw: string | null, allowed: readonly string[]): T | null {
  if (!raw) return null;
  return allowed.includes(raw) ? (raw as T) : null;
}

interface ListState {
  status: FeatureStatus | null;
  valueStreamId: string | null;
  artId: string | null;
  piId: string | null;
  epicId: string | null;
  tier: WsjfTier | null;
  featureType: string | null;
  query: string;
  sort: SortKey;
}

/**
 * Liest den Filterzustand aus der URL und schreibt ihn zurück. Bewusst dieselbe
 * hand-gerollte Mechanik wie vorher (`router.replace`, `scroll: false`) — nur um
 * `paramPrefix` erweitert, damit zwei Listen auf einer Seite koexistieren können.
 */
function useListState(paramPrefix: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = useCallback((k: string) => `${paramPrefix}${k}`, [paramPrefix]);

  const state: ListState = {
    status: parse<FeatureStatus>(searchParams.get(key("status")), FEATURE_STATUSES),
    valueStreamId: searchParams.get(key("vs")),
    artId: searchParams.get(key("art")),
    piId: searchParams.get(key("pi")),
    epicId: searchParams.get(key("epic")),
    tier: parse<WsjfTier>(searchParams.get(key("tier")), WSJF_TIERS),
    featureType: parse<string>(searchParams.get(key("type")), FEATURE_TYPES),
    query: searchParams.get(key("q")) ?? "",
    sort: parse<SortKey>(searchParams.get(key("sort")), SORT_KEYS) ?? "wsjf:desc",
  };

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        const full = key(k);
        if (v === null || v === "") params.delete(full);
        else params.set(full, v);
      }
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  return { state, push };
}

function applyFilters(rows: readonly FeatureOverviewRow[], s: ListState): FeatureOverviewRow[] {
  const q = s.query.trim().toLowerCase();
  const arr = rows.filter((r) => {
    if (s.status != null && r.status !== s.status) return false;
    if (s.valueStreamId && r.valueStream?.id !== s.valueStreamId) return false;
    if (s.artId && r.art.id !== s.artId) return false;
    if (s.piId === "backlog" && r.pi != null) return false;
    if (s.piId && s.piId !== "backlog" && r.pi?.id !== s.piId) return false;
    if (s.epicId && r.epic?.id !== s.epicId) return false;
    if (s.tier && r.wsjfTier !== s.tier) return false;
    if (s.featureType != null && r.featureType !== s.featureType) return false;
    if (q === "") return true;
    if (r.title.toLowerCase().includes(q)) return true;
    if (r.epic?.title.toLowerCase().includes(q)) return true;
    if (r.art.name.toLowerCase().includes(q)) return true;
    if (r.valueStream?.name.toLowerCase().includes(q)) return true;
    return false;
  });

  const sorted = arr.slice();
  switch (s.sort) {
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
}

// ---------------------------------------------------------------------------
// Ansicht
// ---------------------------------------------------------------------------

const SELECT_CLASS = "rounded-md border border-input bg-card px-2 py-1.5 text-sm";

export interface FeaturesListViewProps {
  model: FeaturesOverviewModel;
  /** Standard: alle. Im Epic entfallen `epic` und `valueStream`. */
  columns?: readonly FeatureColumn[];
  /** Präfix aller Query-Parameter, z. B. `"dl."` im Deliverables-Reiter. */
  paramPrefix?: string;
  /** Titel-Klick: ohne Handler führt der Titel als Link auf die Feature-Vollroute. */
  onOpen?: (row: FeatureOverviewRow) => void;
  /** Ersetzt die Status-Zelle — z. B. durch ein Dropdown, wenn der Nutzer darf. */
  renderStatus?: (row: FeatureOverviewRow) => ReactNode;
  /** Zusätzliche Spalte ganz rechts. */
  renderActions?: (row: FeatureOverviewRow) => ReactNode;
  /** Zeile über die volle Breite unterhalb der Zeile — das Inline-Formular. */
  renderExpanded?: (row: FeatureOverviewRow) => ReactNode;
  emptyLabel?: string;
  /** Zählzeile unter der Tabelle („X von Y Features im Zugriff."). */
  showTotals?: boolean;
}

export function FeaturesListView({
  model,
  columns = ALL_COLUMNS,
  paramPrefix = "",
  onOpen,
  renderStatus,
  renderActions,
  renderExpanded,
  emptyLabel = "Keine Features im aktuellen Filter.",
  showTotals = true,
}: FeaturesListViewProps) {
  const { state, push } = useListState(paramPrefix);

  const show = useMemo(() => new Set(columns), [columns]);
  // Die WSJF-Spalte hängt zusätzlich an der Practice — wie bisher.
  const showWsjf = show.has("wsjf") && model.showWsjf;

  // ART-Optionen werden vom Wertstrom-Filter verengt.
  const artsForVs = useMemo(() => {
    if (!state.valueStreamId) return model.artOptions;
    return model.artOptions.filter((a) => a.valueStreamId === state.valueStreamId);
  }, [model.artOptions, state.valueStreamId]);

  const filtered = useMemo(() => applyFilters(model.rows, state), [model.rows, state]);

  // Spaltenzahl für die Leerzeile: Titel + sichtbare Spalten + optionale Aktionen.
  const colCount =
    1 +
    (show.has("valueStream") ? 1 : 0) +
    (show.has("epic") ? 1 : 0) +
    (show.has("pi") ? 1 : 0) +
    (show.has("status") ? 1 : 0) +
    (showWsjf ? 1 : 0) +
    (show.has("ak") ? 1 : 0) +
    (renderActions ? 1 : 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FEATURE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => push({ status: state.status === s ? null : s })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
              state.status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-muted"
            }`}
          >
            <span className={`size-2 rounded-full ${FEATURE_STATUS_DOT[s]}`} />
            <span>{FEATURE_STATUS_LABEL[s]}</span>
            <span
              className={`tabular-nums ${state.status === s ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {model.funnelCounts[s]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={state.query}
          onChange={(e) => push({ q: e.target.value || null })}
          placeholder="Suche Titel · Epic · ART …"
          className="min-w-[12rem] flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
        />
        {show.has("valueStream") && (
          <select
            value={state.valueStreamId ?? ""}
            onChange={(e) => push({ vs: e.target.value || null, art: null /* invalidiert */ })}
            aria-label="Wertstrom"
            className={SELECT_CLASS}
          >
            <option value="">Alle Wertströme</option>
            {model.valueStreamOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={state.artId ?? ""}
          onChange={(e) => push({ art: e.target.value || null })}
          aria-label="ART"
          className={SELECT_CLASS}
        >
          <option value="">Alle ARTs</option>
          {artsForVs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {show.has("pi") && (
          <select
            value={state.piId ?? ""}
            onChange={(e) => push({ pi: e.target.value || null })}
            aria-label="PI"
            className={SELECT_CLASS}
          >
            <option value="">Alle PIs</option>
            <option value="backlog">— Backlog</option>
            {model.piOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {show.has("epic") && (
          <select
            value={state.epicId ?? ""}
            onChange={(e) => push({ epic: e.target.value || null })}
            aria-label="Epic"
            className={SELECT_CLASS}
          >
            <option value="">Alle Epics</option>
            {model.epicOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        )}
        {showWsjf && (
          <select
            value={state.tier ?? ""}
            onChange={(e) => push({ tier: e.target.value || null })}
            aria-label="WSJF-Tier"
            className={SELECT_CLASS}
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
          value={state.featureType ?? ""}
          onChange={(e) => push({ type: e.target.value || null })}
          aria-label="Feature-Typ"
          className={SELECT_CLASS}
        >
          <option value="">Alle Typen</option>
          {FEATURE_TYPES.map((t) => (
            <option key={t} value={t}>
              {FEATURE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          value={state.sort}
          onChange={(e) => push({ sort: e.target.value })}
          aria-label="Sortierung"
          className={SELECT_CLASS}
        >
          <option value="wsjf:desc">WSJF abwärts</option>
          <option value="createdAt:desc">Neueste zuerst</option>
          <option value="createdAt:asc">Älteste zuerst</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-4 pr-2">Feature</th>
              {show.has("valueStream") && <th className="py-2 pr-3">Wertstrom · ART</th>}
              {!show.has("valueStream") && <th className="py-2 pr-3">ART</th>}
              {show.has("epic") && <th className="py-2 pr-3">Epic</th>}
              {show.has("pi") && <th className="py-2 pr-3">PI</th>}
              {show.has("status") && <th className="py-2 pr-3">Status</th>}
              {showWsjf && <th className="py-2 pr-4 text-right">WSJF</th>}
              {show.has("ak") && <th className="py-2 pr-4 text-right">AK</th>}
              {renderActions && <th className="py-2 pr-4" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <FeatureTableRow
                  key={r.id}
                  row={r}
                  show={show}
                  showWsjf={showWsjf}
                  colCount={colCount}
                  {...(onOpen ? { onOpen } : {})}
                  {...(renderStatus ? { renderStatus } : {})}
                  {...(renderActions ? { renderActions } : {})}
                  {...(renderExpanded ? { renderExpanded } : {})}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showTotals && (
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length} von {model.rows.length} Features im Zugriff.
        </p>
      )}
    </>
  );
}

interface RowProps {
  row: FeatureOverviewRow;
  show: ReadonlySet<FeatureColumn>;
  showWsjf: boolean;
  colCount: number;
  onOpen?: (row: FeatureOverviewRow) => void;
  renderStatus?: (row: FeatureOverviewRow) => ReactNode;
  renderActions?: (row: FeatureOverviewRow) => ReactNode;
  renderExpanded?: (row: FeatureOverviewRow) => ReactNode;
}

function FeatureTableRow({
  row,
  show,
  showWsjf,
  colCount,
  onOpen,
  renderStatus,
  renderActions,
  renderExpanded,
}: RowProps) {
  const statusKey = toFeatureStatus(row.status);
  const expanded = renderExpanded?.(row);

  return (
    <>
      <tr className="border-b align-middle last:border-b-0 hover:bg-muted/30">
        <td className="py-2 pl-4 pr-2">
          <div className="flex items-center gap-2">
            {statusKey != null && (
              <span
                className={`size-2 shrink-0 rounded-full ${FEATURE_STATUS_DOT[statusKey]}`}
                aria-hidden
              />
            )}
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="block truncate text-left font-medium text-primary hover:underline"
                title={row.title}
              >
                {row.title}
              </button>
            ) : (
              <Link
                href={`/umsetzung/feature/${row.id}`}
                className="block truncate font-medium text-primary hover:underline"
                title={row.title}
              >
                {row.title}
              </Link>
            )}
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
            {show.has("valueStream")
              ? `${row.valueStream?.name ?? "—"} · ${row.art.name}`
              : row.art.name}
          </span>
        </td>

        {show.has("epic") && (
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
        )}

        {show.has("pi") && (
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
        )}

        {show.has("status") && (
          <td className="py-2 pr-3 text-xs text-muted-foreground">
            {renderStatus
              ? renderStatus(row)
              : statusKey != null
                ? FEATURE_STATUS_LABEL[statusKey]
                : row.status}
          </td>
        )}

        {showWsjf && (
          <td className="py-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
            {formatWsjf(row.wsjfComputed)}
          </td>
        )}

        {show.has("ak") && (
          <td className="py-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
            {row.acceptanceCriteriaCount}
          </td>
        )}

        {renderActions && <td className="py-2 pr-4 text-right">{renderActions(row)}</td>}
      </tr>

      {expanded && (
        <tr className="border-b bg-muted/20 last:border-b-0">
          <td colSpan={colCount} className="px-4 py-3">
            {expanded}
          </td>
        </tr>
      )}
    </>
  );
}
