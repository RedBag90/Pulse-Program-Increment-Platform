/**
 * Guardrail 2 **je Wertstrom**, gemessen am **abgeschlossenen Budget**.
 *
 * Die bestehende, tenant-weite Achse misst Σ `implementationCost` aus dem
 * Business Case **aller** Epics — eine Schätzung über alles, was existiert. Sie
 * beantwortet „wohin wollen wir investieren".
 *
 * Diese Achse beantwortet „wohin ist das Geld tatsächlich geflossen": Σ
 * **zugeteiltes** Budget der Epics, deren Umsetzung abgeschlossen ist, je
 * Arbeitstyp. Zwei Zahlen, die auseinanderlaufen dürfen, weil sie zwei Fragen
 * beantworten — beide tragen deshalb ihre Messgrundlage im Titel.
 *
 * Dieselbe Engine: `computeMixAxis` wird nur anders parametrisiert.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { computeMixAxis, type MixAxisResult } from "@/modules/work/domain/guardrail-rules";
import { classifyEpic } from "@/modules/work/domain/pb-submission";
import {
  epicCapacityBucket,
  isEpicType,
  type GuardrailTargets,
} from "@/modules/work/domain/portfolio-guardrails";

export type CapacityBucket = "business" | "enabler";

export interface DeliveredEpic {
  id: string;
  title: string;
  epicType: string | null;
  /** Zugeteiltes Budget dieses Epics — die Messgröße dieser Achse. */
  amount: number;
  /** Halbjahr der Zuteilung, für die Entwicklung. */
  cycleKey: string;
}

export interface CapacityMixByCycle {
  cycleKey: string;
  label: string;
  business: number;
  enabler: number;
  businessShare: number;
  enablerShare: number;
}

export interface ValueStreamCapacityMix {
  mix: MixAxisResult<CapacityBucket>;
  targets: GuardrailTargets["capacity"];
  /** Entwicklung je Halbjahr — ein einzelner Prozentwert verdeckt den Trend. */
  byCycle: CapacityMixByCycle[];
  /** Epics ohne Typ: sie gehen nicht in die Anteile ein, verschwinden aber nicht. */
  unclassified: { count: number; amount: number };
  totalEpics: number;
}

const share = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

/** Reine Faltung — der Server reicht herein, was er geladen hat. */
export function buildValueStreamCapacityMix(
  epics: readonly DeliveredEpic[],
  targets: GuardrailTargets["capacity"],
): ValueStreamCapacityMix {
  const mix = computeMixAxis<DeliveredEpic, CapacityBucket>({
    items: epics,
    buckets: ["business", "enabler"] as const,
    classify: (e) => epicCapacityBucket(isEpicType(e.epicType) ? e.epicType : null),
    amountOf: (e) => e.amount,
    targets,
  });

  const byCycleMap = new Map<string, { business: number; enabler: number }>();
  let unclassifiedAmount = 0;
  let unclassifiedCount = 0;

  for (const e of epics) {
    const bucket = epicCapacityBucket(isEpicType(e.epicType) ? e.epicType : null);
    if (bucket == null) {
      unclassifiedAmount += e.amount;
      unclassifiedCount += 1;
      continue;
    }
    const cur = byCycleMap.get(e.cycleKey) ?? { business: 0, enabler: 0 };
    cur[bucket] += e.amount;
    byCycleMap.set(e.cycleKey, cur);
  }

  const byCycle = [...byCycleMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cycleKey, v]) => {
      const total = v.business + v.enabler;
      return {
        cycleKey,
        label: halfYearLabel(cycleKey),
        business: v.business,
        enabler: v.enabler,
        businessShare: share(v.business, total),
        enablerShare: share(v.enabler, total),
      };
    });

  return {
    mix,
    targets,
    byCycle,
    unclassified: { count: unclassifiedCount, amount: unclassifiedAmount },
    totalEpics: epics.length,
  };
}

/**
 * Lädt die gelieferten Epics eines Wertstroms mit ihrer Zuteilung.
 *
 * „Geliefert" ist derselbe Begriff wie in der Zustandsstaffel: der
 * L4.2-Stempel, ersatzweise Reifegrad L5. Wer nur auf `stageGate` schaut, zählt
 * gelieferte Arbeit als laufend.
 */
export async function loadValueStreamCapacityMix(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  targets: GuardrailTargets["capacity"],
): Promise<ValueStreamCapacityMix> {
  const finals = await db.budgetCandidate.findMany({
    where: { tenantId, kind: "epic", valueStreamId, finalAmount: { not: null } },
    select: { epicId: true, finalAmount: true, round: { select: { cycleKey: true } } },
  });

  const epicIds = [
    ...new Set(finals.map((f) => f.epicId).filter((id): id is string => id != null)),
  ];
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      id: { in: epicIds },
      OR: [{ implementationCompletedAt: { not: null } }, { stageGate: "L5" }],
    },
    select: { id: true, title: true, epicType: true },
  });
  const delivered = new Map(rows.map((r) => [r.id, r]));

  const epics: DeliveredEpic[] = finals.flatMap((f) => {
    if (f.epicId == null) return [];
    const e = delivered.get(f.epicId);
    if (!e) return [];
    return [
      {
        id: e.id,
        title: e.title,
        epicType: e.epicType,
        amount: Number(f.finalAmount),
        cycleKey: f.round.cycleKey,
      },
    ];
  });

  return buildValueStreamCapacityMix(epics, targets);
}

// ---------------------------------------------------------------------------
// Guardrail 3 — Vorschau der Aufteilung
// ---------------------------------------------------------------------------

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
