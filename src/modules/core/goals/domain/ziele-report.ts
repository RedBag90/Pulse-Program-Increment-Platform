import { formatCompactEUR } from "@/lib/formatting";
import {
  GOAL_STATUS_LABELS,
  goalStatusLabel,
  goalStatusTier,
  isGoalStatus,
  type GoalStatusTier,
} from "@/modules/core/goals/domain/goal-status";
import { goalPeriodLabel, isGoalPeriodKey } from "@/modules/core/goals/domain/goal-period";
import { flattenGoalTree } from "@/modules/core/goals/domain/goal-tree-filter";

/**
 * **Der Ziele-Bericht als Daten** — alles fertig beschriftet, nichts mehr zu
 * rechnen.
 *
 * Bewusst getrennt vom Dokument (`server/report/ziele-report-document.tsx`):
 * dort steht nur noch, wie es auf dem Papier liegt. Was drinsteht, entscheidet
 * sich hier — rein, ohne React, ohne I/O, und damit prüfbar, ohne ein PDF zu
 * erzeugen.
 *
 * **Der Bericht spiegelt die Seite.** Dieselben Spalten wie die
 * Strategie-Tabelle, dieselben Kopfzahlen wie der Health-Strip, derselbe
 * gefilterte Ausschnitt. Ein Bericht, der mehr zeigte als der Bildschirm, wäre
 * ein Leck; einer, der weniger zeigt, wäre eine zweite Wahrheit.
 */

/** Eine Zeile des Ziel-Baums, flach und fertig beschriftet. */
export interface ZieleReportRow {
  id: string;
  /** Tiefe im Baum (0 = Top-Ziel) — die Einrückung auf dem Papier. */
  depth: number;
  title: string;
  /** Anzeigename oder „—". */
  owner: string;
  status: string;
  statusTier: GoalStatusTier;
  /** „72 %" oder „—", wenn der Knoten nicht messbar ist. */
  progress: string;
  /** „€8,1K / €12,3K" (Ist / Soll) oder „—", wenn beides 0 ist. */
  value: string;
  /** „2026-Q3", ein Datumsbereich, oder „—". */
  timeframe: string;
}

/** Was gerade gefiltert war — in Worten, nicht in Ids. */
export interface ZieleReportFilters {
  periods: string;
  valueStreams: string;
  arts: string;
  statuses: string;
}

export interface ZieleReportSummary {
  /** Ziele im Ausschnitt — **alle** Ebenen, nicht nur die Top-Ziele. */
  goalCount: number;
  /** Ø Fortschritt der Top-Ziele, wie im Health-Strip. „—" ohne messbare. */
  averageProgress: string;
  /** Verteilung der **Top-Ziele** auf die vier Stufen, in Anzeigereihenfolge. */
  tiers: { tier: GoalStatusTier; label: string; count: number }[];
}

export interface ZieleReport {
  tenantName: string;
  /** Erzeugungsdatum, de-DE. */
  generatedAt: string;
  filters: ZieleReportFilters;
  summary: ZieleReportSummary;
  rows: ZieleReportRow[];
}

/**
 * Was der Bericht zeigt, wo nichts dasteht.
 *
 * Ein Bericht ist Papier: dort kann man nicht nachschlagen, ob die Zelle leer
 * ist, weil nichts gepflegt wurde oder weil die Anzeige versagt hat. Ein
 * sichtbarer Strich sagt „hier steht nichts" und meint es.
 */
const LEER = "—";

/**
 * Die Stufen-Beschriftung des Health-Strips.
 *
 * Abgeschrieben und nicht importiert, weil sie dort in einer
 * Client-Komponente steht (`features/components/goal-health-strip.tsx`) — die
 * Domäne zieht keine Abhängigkeit in Richtung `features`. Der Text ist
 * derselbe; weicht er je ab, fällt es im Bericht neben dem Bildschirm auf.
 */
const TIER_LABEL: Record<GoalStatusTier, string> = {
  green: "On track",
  amber: "At risk",
  rose: "Off track",
  neutral: "Ohne Status",
};

/** Reihenfolge wie im Strip: on-track → at-risk → off-track → ohne. */
const TIER_ORDER: readonly GoalStatusTier[] = ["green", "amber", "rose", "neutral"];

/** Der Sentinel des Status-Filters: „ohne Status" ist eine Auswahl, kein Fehlen. */
const STATUS_NONE = "none";

const DATUM = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Der Knoten, so weit der Bericht ihn kennen muss — ein Ausschnitt aus `GoalNode`. */
export interface ZieleReportNode {
  id: string;
  title: string;
  ownerId: string | null;
  status: string | null;
  progress: number | null;
  period: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  trio: { planned: number; realized: number };
  children: ZieleReportNode[];
}

/** Der Baum, so weit der Bericht ihn kennen muss — ein Ausschnitt aus `StrategyTree`. */
export interface ZieleReportTree {
  themes: ZieleReportNode[];
  periods: string[];
  valueStreamIds: string[];
  artIds: string[];
  statuses: string[];
}

export interface ZieleReportContext {
  tenantName: string;
  /** userId → Anzeigename, wie die Seite ihn hat (`listTenantUserLabels`). */
  userLabels: Record<string, string>;
  /** id → Name, nur für das Filter-Echo im Kopf. */
  valueStreamNames: Record<string, string>;
  artNames: Record<string, string>;
  now: Date;
}

/** „alle", wenn nichts gewählt ist — sonst die Namen, Komma-getrennt. */
function echo(ids: readonly string[], names: Record<string, string>, alle: string): string {
  if (ids.length === 0) return alle;
  // Eine Id, zu der es keinen Namen gibt, bleibt als Id stehen: lieber ein
  // unschöner Schlüssel als ein verschwiegener Filter.
  return ids.map((id) => names[id] ?? id).join(", ");
}

/** Der Zeitraum eines Knotens als Text — eigener Bereich schlägt den Bucket. */
function timeframeLabel(node: ZieleReportNode): string {
  if (node.periodStart && node.periodEnd) {
    return `${node.periodStart} – ${node.periodEnd}`;
  }
  if (node.period) {
    return isGoalPeriodKey(node.period) ? goalPeriodLabel(node.period) : node.period;
  }
  return LEER;
}

/** Ist/Soll wie die Spalte „Wert" am Bildschirm; „—", wo es nichts zu zeigen gibt. */
function valueLabel(trio: { planned: number; realized: number }): string {
  if (trio.planned === 0 && trio.realized === 0) return LEER;
  return `${formatCompactEUR(trio.realized)} / ${formatCompactEUR(trio.planned)}`;
}

export function buildZieleReport(tree: ZieleReportTree, ctx: ZieleReportContext): ZieleReport {
  const alle = flattenGoalTree(tree.themes);

  // `flattenGoalTree` legt vorbestellt flach und liefert die Tiefe dazu — der
  // Knoten trägt sie zwar auch, aber der Walker ist die Quelle, an der sich
  // Einrückung und Reihenfolge gemeinsam ablesen lassen.
  const rows: ZieleReportRow[] = alle.map(({ node, depth }) => ({
    id: node.id,
    depth,
    title: node.title,
    owner: (node.ownerId ? ctx.userLabels[node.ownerId] : null) ?? LEER,
    status: node.status ? goalStatusLabel(node.status) : TIER_LABEL.neutral,
    statusTier: goalStatusTier(node.status),
    progress: node.progress != null ? `${Math.round(node.progress * 100)} %` : LEER,
    value: valueLabel(node.trio),
    timeframe: timeframeLabel(node),
  }));

  // Ø Fortschritt und Verteilung rechnen über die **Top-Ziele**, nicht über den
  // ganzen Baum — genau wie der Health-Strip. Über alle Ebenen gemittelt zöge
  // ein Ziel mit vielen Unterzielen den Schnitt zu sich, und dieselbe Zahl
  // stünde auf Papier und Bildschirm verschieden da.
  const messbar = tree.themes.filter((t) => t.progress != null);
  const averageProgress =
    messbar.length > 0
      ? `${Math.round(
          (messbar.reduce((s, t) => s + (t.progress ?? 0), 0) / messbar.length) * 100,
        )} %`
      : LEER;

  const counts: Record<GoalStatusTier, number> = { green: 0, amber: 0, rose: 0, neutral: 0 };
  for (const t of tree.themes) counts[goalStatusTier(t.status)] += 1;

  return {
    tenantName: ctx.tenantName,
    generatedAt: DATUM.format(ctx.now),
    filters: {
      // Zeiträume tragen ihre eigene Beschriftung („2026-Q3" → „Q3 2026").
      periods:
        tree.periods.length === 0
          ? "alle"
          : tree.periods.map((p) => (isGoalPeriodKey(p) ? goalPeriodLabel(p) : p)).join(", "),
      valueStreams: echo(tree.valueStreamIds, ctx.valueStreamNames, "alle"),
      arts: echo(tree.artIds, ctx.artNames, "alle"),
      statuses:
        tree.statuses.length === 0
          ? "alle"
          : tree.statuses
              .map((s) =>
                s === STATUS_NONE
                  ? TIER_LABEL.neutral
                  : isGoalStatus(s)
                    ? GOAL_STATUS_LABELS[s]
                    : s,
              )
              .join(", "),
    },
    summary: {
      goalCount: alle.length,
      averageProgress,
      tiers: TIER_ORDER.map((tier) => ({ tier, label: TIER_LABEL[tier], count: counts[tier] })),
    },
    rows,
  };
}
