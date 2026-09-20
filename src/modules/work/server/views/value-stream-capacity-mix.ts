/**
 * **Guardrail 2 je Wertstrom — das Anzeigemodell.**
 *
 * Bis September 2026 stand hier die Rechnung selbst: Σ **zugeteiltes** Budget
 * gelieferter **Epics** je Epic-Typ, kumulativ über alle Zeit. Sie ist ersetzt
 * worden, weil sie zwei Dinge mass, die niemand steuern kann: eine Schätzung
 * (der Business Case) und eine Vergangenheit (was schon geliefert ist).
 *
 * Die Guardrail misst jetzt **eingeplante Arbeit gegen verfügbare Kapazität**,
 * beides in Job-Size-Punkten, je Halbjahr. Die Kapazität entsteht aus dem
 * Veränderungsgeld eines ARTs, geteilt durch dessen empirischen €-Satz je
 * Punkt; die Ziele des Wertstroms teilen sie auf die drei Arbeitstypen auf.
 *
 * **Hier steht nur die Form, nicht die Rechnung.** Der €-Satz gehört Budgeting,
 * und `work` darf dorthin nicht importieren (ADR-0013). Gefüllt wird dieses
 * Modell deshalb von `budgeting/server/views/capacity-plan.ts` — Budgeting darf
 * `work` lesen. Die Fläche, die es rendert, liegt in `work` und kommt damit
 * ohne einen einzigen Budgeting-Import aus.
 *
 * Rein, kein I/O.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import { classifyEpic } from "@/modules/work/domain/pb-submission";
import type { CapacityBucket, GuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";

export type { CapacityBucket };

/** Σ Job Size und Anzahl der Features eines Arbeitstyps. */
export interface PlannedCell {
  count: number;
  jobSize: number;
}

export interface CapacityRowView {
  bucket: CapacityBucket;
  /** Ziel-Anteil als Bruch (0..1) — die Vorgabe, aus der `available` entsteht. */
  targetShare: number;
  /** Punkte, die dieser Arbeitstyp bekommt. `null`, wo kein €-Satz vorliegt. */
  available: number | null;
  planned: PlannedCell;
  /** `planned.jobSize − available`; positiv = überplant. `null` ohne Satz. */
  delta: number | null;
}

/** Ein ART, dessen €-Satz sich nicht ableiten lässt — samt Grund. */
export interface ArtWithoutRate {
  id: string;
  name: string;
  /** Seine eingeplanten Punkte. Sie stehen daneben, nicht in der Summe. */
  jobSize: number;
  /** Der erste Vorbehalt aus `deriveJobSizeRate` — warum es keinen Satz gibt. */
  reason: string;
}

export interface CapacityPlanByCycle {
  cycleKey: string;
  label: string;
  rows: { bucket: CapacityBucket; planned: number; available: number | null }[];
}

export interface ValueStreamCapacityPlan {
  cycleKey: string;
  cycleLabel: string;
  /** Veränderungsgeld der ARTs mit Satz — die Grundlage von `capacity`. */
  budget: number;
  /** Σ der ART-Kapazitäten in Punkten. `null`, wenn kein ART einen Satz hat. */
  capacity: number | null;
  rows: CapacityRowView[];
  targets: GuardrailTargets["capacity"];
  /** Features ohne Arbeitstyp — sie gehören in keinen Eimer und verschwinden trotzdem nicht. */
  unclassified: PlannedCell;
  /** Alle eingeplanten Features des Halbjahres, inklusive der unklassifizierten. */
  totalPlanned: PlannedCell;
  artCount: number;
  artsWithoutRate: ArtWithoutRate[];
  /** Die Historie — je Halbjahr dieselbe Rechnung. */
  byCycle: CapacityPlanByCycle[];
}

/**
 * **Warum es keine Kapazität gibt** — die beiden Fälle sind nicht dasselbe.
 *
 * `no_rate`: die ARTs haben zu wenig Historie, um einen €-Satz abzuleiten. Das
 * ist eine Aussage über die **Messbarkeit**.
 * `no_budget`: es gibt einen Satz, aber für dieses Halbjahr ist noch kein
 * Veränderungsgeld zugeteilt. Das ist eine Aussage über den **Stand der
 * Planung** — und in der Regel schlicht „die Runde läuft noch".
 *
 * Beides als „keine Daten" zu zeigen, wie es der erste Entwurf tat, verwechselt
 * „wir können nicht rechnen" mit „es ist noch nichts verteilt".
 */
export type NoCapacityReason = "no_rate" | "no_budget" | null;

export function noCapacityReason(plan: ValueStreamCapacityPlan): NoCapacityReason {
  if (plan.capacity == null) return "no_rate";
  if (plan.capacity <= 0) return "no_budget";
  return null;
}

/**
 * Die grösste Abweichung über alle Arbeitstypen, als Anteil der Kapazität.
 *
 * `statusFor` erwartet eine **Drift als Bruch** (0.05 = 5 pp) — dieselbe
 * Skala, die die Horizont-Achse liefert. Damit gilt für alle Guardrails
 * dieselbe Ampel, statt dass jede Fläche ihre Schwellen nachbaut.
 *
 * `null` heisst „nicht bewertbar": ohne Kapazität gibt es keine Abweichung,
 * und eine Ampel über nichts ist eine Entwarnung über nichts.
 */
export function maxCapacityDrift(plan: ValueStreamCapacityPlan): number | null {
  if (plan.capacity == null || plan.capacity <= 0) return null;
  const drifts = plan.rows
    .map((r) => r.delta)
    .filter((d): d is number => d != null)
    .map((d) => Math.abs(d) / plan.capacity!);
  return drifts.length === 0 ? null : Math.max(...drifts);
}

// ---------------------------------------------------------------------------
// Guardrail 3 — die Vorschau auf das Portfolio-Limit
// ---------------------------------------------------------------------------
//
// Sie steht hier, weil sie derselbe Reiter zeigt, und sie ist vom Umbau der
// Capacity-Achse **nicht** berührt: das Limit trennt Portfolio-Epics von
// ART-Epics und hat mit Job Size nichts zu tun. Anders als die Achse darüber
// rechnet sie deshalb weiterhin über Epics — und das ist richtig so.

export interface ClassificationPreview {
  threshold: number;
  portfolio: { count: number; amount: number };
  art: { count: number; amount: number };
  /** Ohne freigegebenen Business Case — noch nicht einzuordnen. */
  unclassified: number;
  /** Davon: ART-Epics ohne ART-Zuordnung. Sie hätten keinen Finanzierungsweg. */
  artWithoutArt: number;
}

/**
 * Wie sich die Epics eines Wertstroms bei einem gegebenen Limit aufteilen.
 *
 * Ohne diese Vorschau stellt niemand ein Portfolio-Limit seriös ein: die Zahl
 * entscheidet, ob die Trennung eine Randerscheinung ist oder den Hauptteil des
 * Portfolios umleitet. Sie ist zugleich der Prüfpunkt vor dem Scharfschalten.
 */
export async function loadClassificationPreview(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  threshold: number,
): Promise<ClassificationPreview> {
  const epics = await db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, valueStreamId },
    select: {
      artId: true,
      businessCase: true,
      businessCaseApprovedAt: true,
      hypothesisApprovedAt: true,
      portfolioOverrideAt: true,
    },
  });

  const out: ClassificationPreview = {
    threshold,
    portfolio: { count: 0, amount: 0 },
    art: { count: 0, amount: 0 },
    unclassified: 0,
    artWithoutArt: 0,
  };

  for (const e of epics) {
    const c = classifyEpic(e, threshold);
    if (c.epicClass == null) {
      out.unclassified += 1;
    } else if (c.epicClass === "portfolio") {
      out.portfolio.count += 1;
      out.portfolio.amount += c.cost ?? 0;
    } else {
      out.art.count += 1;
      out.art.amount += c.cost ?? 0;
      if (e.artId == null) out.artWithoutArt += 1;
    }
  }
  return out;
}
