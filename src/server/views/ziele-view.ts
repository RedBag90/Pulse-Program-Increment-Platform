import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import {
  horizonShare,
  keyResultTrio,
  sumTrios,
  type KpiInput,
  type KrContributionInput,
  type RollupTrio,
} from "@/domain/goals-rollup";

/**
 * Ziele-Modul-Loader (Konzept V2). Liefert die komplette Strategie-
 * Hierarchie fuer den Tenant inkl. €-Rollup-Trios pro Ebene. Die
 * Render-Komponenten konsumieren das fertige Tree-Modell ohne weitere
 * Domain-Arbeit.
 *
 * Periode-Filter: `period` (z. B. "2026-Q2") schraenkt die Objectives
 * auf das aktuelle Quartal ein, ohne Themes/Vision auszublenden.
 */

export type ZieleSubTab = "strategie" | "okrs" | "money" | "pflege";

export interface ZieleKrContribution {
  kpiId: string;
  kpiName: string;
  epicTitle: string;
  weight: number;
  valuePerUnitOverride: number | null;
  /** Achievement-Anteil 0..1 zum Anzeigen im Picker (current vs. target). */
  achievement: number | null;
  /** € Beitrag dieses KPI zum KR (Realized). */
  contributionRealized: number;
}

export interface ZieleTreeKeyResult {
  id: string;
  title: string;
  metricUnit: string | null;
  baseline: number | null;
  target: number | null;
  current: number | null;
  formula: string;
  ownerId: string | null;
  trio: RollupTrio;
  /** Wie viele KPIs an diesen KR gebunden sind. */
  kpiCount: number;
  /** Liste aller gebundenen KPIs inkl. Weight + €-Beitrag (KPI-Tab). */
  contributions: ZieleKrContribution[];
}

export interface ZieleKpiLibraryEntry {
  id: string;
  name: string;
  unit: string | null;
  valuePerUnit: number | null;
  epicId: string;
  epicTitle: string;
}

export interface ZieleEpicLink {
  epicId: string;
  epicTitle: string;
  epicStatus: string;
}

export interface ZieleEpicLibraryEntry {
  id: string;
  title: string;
  status: string;
}

export interface ZieleTreeObjective {
  id: string;
  title: string;
  narrative: string | null;
  period: string | null;
  confidence: number | null;
  status: string;
  ownerId: string | null;
  keyResults: ZieleTreeKeyResult[];
  trio: RollupTrio;
}

export interface ZieleTreeTheme {
  id: string;
  visionId: string | null;
  title: string;
  narrative: string | null;
  color: string;
  kind: "business" | "enabler";
  budgetPlanned: number | null;
  ownerId: string | null;
  sortOrder: number;
  status: string;
  objectives: ZieleTreeObjective[];
  trio: RollupTrio;
  /** Direkt am Theme verlinkte Epic-Anzahl (n:m via ThemeEpicLink). */
  directEpicCount: number;
  /** Verlinkte Epics (Theme-Epic-Tab im Slide-Over). */
  linkedEpics: ZieleEpicLink[];
}

export interface ZieleTreeVision {
  id: string;
  scope: "tenant" | "value_stream";
  valueStreamId: string | null;
  valueStreamName: string | null;
  title: string;
  narrative: string | null;
  horizonStart: Date;
  horizonEnd: Date;
  ownerId: string | null;
  status: string;
  trio: RollupTrio;
}

export interface ZielePermissions {
  /** Strategie + OKRs editieren (LPM-Surface). */
  canEditStrategy: boolean;
  /** Finance-Controller: KPI valuePerUnit + KR-KPI-Bindung pflegen. */
  canEditKpiValuation: boolean;
}

export interface ZieleModel {
  visions: ZieleTreeVision[];
  themes: ZieleTreeTheme[];
  /** Tenant-Gesamt-Rollup (Summe ueber alle Themes). */
  tenantTrio: RollupTrio;
  /** Aktiver Sub-Tab; per URL-Param `?tab=` ueberschreibbar. */
  tab: ZieleSubTab;
  /** Period-Filter (z. B. „2026-Q2") oder `null` fuer „Alle". */
  period: string | null;
  permissions: ZielePermissions;
  /** Alle Tenant-KPIs (fuer KPI-Picker im KR-Slide-Over). */
  kpiLibrary: ZieleKpiLibraryEntry[];
  /** Alle Tenant-Epics (fuer Theme-Epic-Picker). */
  epicLibrary: ZieleEpicLibraryEntry[];
}

export interface LoadZieleInput {
  tab?: ZieleSubTab | undefined;
  period?: string | undefined;
}

export async function loadZieleModel(
  db: PrismaClient,
  principal: Principal,
  input: LoadZieleInput = {},
): Promise<ZieleModel> {
  const { tenantId } = principal;
  const tab: ZieleSubTab = input.tab ?? "strategie";
  const period = input.period ?? null;

  // 1) Visions (Tenant + VS) — fuer den Filter pro VS einen Namens-Hint
  const visionRows = await db.portfolioVision.findMany({
    where: { tenantId, status: { not: "archived" } },
    include: { valueStream: { select: { id: true, name: true } } },
    orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
  });

  // 2) Themes mit Objectives + KRs + KPI-Contributions
  const objectiveWhere = period ? { period } : {};
  const themeRows = await db.strategicTheme.findMany({
    where: { tenantId, status: { not: "archived" } },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      objectives: {
        where: objectiveWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          keyResults: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              kpiContributions: {
                include: {
                  kpi: {
                    select: {
                      id: true,
                      name: true,
                      baseline: true,
                      target: true,
                      measurements: true,
                      valuePerUnit: true,
                      initiative: { select: { id: true, title: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      _count: { select: { epicLinks: true } },
      epicLinks: {
        include: {
          epic: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });

  // 3) Horizont-Anker: aus Tenant.dashboardHorizonEnd, sonst 1 Jahr ab heute
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { dashboardHorizonEnd: true },
  });
  const now = new Date();
  const horizonStart = startOfYear(now);
  const horizonEnd = tenant?.dashboardHorizonEnd ?? addMonths(now, 12);
  const share = horizonShare(now, horizonStart, horizonEnd);

  // 4) Tree zusammenbauen + Trios berechnen
  const themes: ZieleTreeTheme[] = themeRows.map((t) => {
    const objectives: ZieleTreeObjective[] = t.objectives.map((o) => {
      const krs: ZieleTreeKeyResult[] = o.keyResults.map((k) => {
        const kpisById = new Map<string, KpiInput>();
        for (const c of k.kpiContributions) {
          kpisById.set(c.kpi.id, {
            id: c.kpi.id,
            baseline: toFloat(c.kpi.baseline),
            target: toFloat(c.kpi.target),
            current: latestMeasurement(c.kpi.measurements),
            valuePerUnit: toFloat(c.kpi.valuePerUnit),
          });
        }
        const contributions: KrContributionInput[] = k.kpiContributions.map((c) => ({
          kpiId: c.kpiId,
          weight: Number(c.weight),
          valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
        }));
        const trio =
          k.formula === "auto_from_kpi"
            ? keyResultTrio(contributions, kpisById, share)
            : manualKrTrio(k.baseline, k.target, k.current, share);

        const contributionDetails: ZieleKrContribution[] = k.kpiContributions.map((c) => {
          const kpi = kpisById.get(c.kpiId);
          const span = (kpi?.target ?? 0) - (kpi?.baseline ?? 0);
          const ach =
            kpi && kpi.current != null && span !== 0
              ? Math.max(0, Math.min(1, ((kpi.current ?? 0) - (kpi.baseline ?? 0)) / span))
              : null;
          const vpu = toFloat(c.valuePerUnitOverride) ?? kpi?.valuePerUnit ?? 0;
          const realized = ach != null && vpu ? ach * vpu * span * Number(c.weight) * share : 0;
          return {
            kpiId: c.kpiId,
            kpiName: c.kpi.name,
            epicTitle: c.kpi.initiative.title,
            weight: Number(c.weight),
            valuePerUnitOverride: toFloat(c.valuePerUnitOverride),
            achievement: ach,
            contributionRealized: realized,
          };
        });

        return {
          id: k.id,
          title: k.title,
          metricUnit: k.metricUnit,
          baseline: toFloat(k.baseline),
          target: toFloat(k.target),
          current: toFloat(k.current),
          formula: k.formula,
          ownerId: k.ownerId,
          trio,
          kpiCount: k.kpiContributions.length,
          contributions: contributionDetails,
        };
      });
      return {
        id: o.id,
        title: o.title,
        narrative: o.narrative,
        period: o.period,
        confidence: o.confidence,
        status: o.status,
        ownerId: o.ownerId,
        keyResults: krs,
        trio: sumTrios(krs.map((k) => k.trio)),
      };
    });
    return {
      id: t.id,
      visionId: t.visionId,
      title: t.title,
      narrative: t.narrative,
      color: t.color,
      kind: t.kind === "enabler" ? "enabler" : "business",
      budgetPlanned: toFloat(t.budgetPlanned),
      ownerId: t.ownerId,
      sortOrder: t.sortOrder,
      status: t.status,
      objectives,
      trio: sumTrios(objectives.map((o) => o.trio)),
      directEpicCount: t._count.epicLinks,
      linkedEpics: t.epicLinks.map((l) => ({
        epicId: l.epic.id,
        epicTitle: l.epic.title,
        epicStatus: l.epic.status,
      })),
    };
  });

  // 5) Vision-Trio = Summe ihrer Themes
  const themesByVision = new Map<string, ZieleTreeTheme[]>();
  const themesWithoutVision: ZieleTreeTheme[] = [];
  for (const t of themes) {
    if (t.visionId) {
      const arr = themesByVision.get(t.visionId) ?? [];
      arr.push(t);
      themesByVision.set(t.visionId, arr);
    } else {
      themesWithoutVision.push(t);
    }
  }
  const visions: ZieleTreeVision[] = visionRows.map((v) => ({
    id: v.id,
    scope: v.scope === "value_stream" ? "value_stream" : "tenant",
    valueStreamId: v.valueStreamId,
    valueStreamName: v.valueStream?.name ?? null,
    title: v.title,
    narrative: v.narrative,
    horizonStart: v.horizonStart,
    horizonEnd: v.horizonEnd,
    ownerId: v.ownerId,
    status: v.status,
    trio: sumTrios((themesByVision.get(v.id) ?? []).map((t) => t.trio)),
  }));

  // 6) Tenant-Trio = Summe aller Themes (egal welche Vision)
  const tenantTrio = sumTrios(themes.map((t) => t.trio));

  // 7) Permissions
  const resource = { tenantId };
  const canEditStrategy = hasCapability(principal, "target.manage", resource);
  // Finance-Controller-Rolle: Capability folgt; bis dahin auf target.manage
  // zurueckfallen (gleiche Audience: TENANT_ADMIN + LPM).
  const canEditKpiValuation = canEditStrategy;

  // 8) KPI-Bibliothek (Tenant-weit) fuer den Picker im KR-Slide-Over
  const kpiRows = await db.kpi.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      unit: true,
      valuePerUnit: true,
      initiative: { select: { id: true, title: true } },
    },
    orderBy: [{ name: "asc" }],
  });
  const kpiLibrary: ZieleKpiLibraryEntry[] = kpiRows.map((k) => ({
    id: k.id,
    name: k.name,
    unit: k.unit,
    valuePerUnit: toFloat(k.valuePerUnit),
    epicId: k.initiative.id,
    epicTitle: k.initiative.title,
  }));

  // 9) Epic-Bibliothek (Tenant-weit, level=0) fuer den Theme-Epic-Picker
  const epicRows = await db.initiative.findMany({
    where: { tenantId, level: 0 },
    select: { id: true, title: true, status: true },
    orderBy: [{ title: "asc" }],
  });
  const epicLibrary: ZieleEpicLibraryEntry[] = epicRows.map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
  }));

  return {
    visions,
    themes,
    tenantTrio,
    tab,
    period,
    permissions: { canEditStrategy, canEditKpiValuation },
    kpiLibrary,
    epicLibrary,
  };
}

// ── helpers ────────────────────────────────────────────────────────────

function toFloat(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  if (typeof d === "number") return d;
  // Prisma-Decimal — duck-type
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function latestMeasurement(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const pts = raw as Array<{ date?: string; value?: number }>;
  if (pts.length === 0) return null;
  const sorted = pts
    .filter((p) => typeof p.value === "number" && typeof p.date === "string")
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const last = sorted[sorted.length - 1];
  return last?.value ?? null;
}

function manualKrTrio(
  baseline: unknown,
  target: unknown,
  current: unknown,
  share: number,
): RollupTrio {
  // Manuelle KRs koennen keinen €-Rollup haben (kein valuePerUnit auf der
  // Brueckentabelle). Wir geben Nullen zurueck; UI zeigt „Manueller Modus".
  void baseline;
  void target;
  void current;
  void share;
  return { planned: 0, realized: 0, runRate: 0 };
}

function startOfYear(d: Date): Date {
  const y = d.getUTCFullYear();
  return new Date(Date.UTC(y, 0, 1));
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}
