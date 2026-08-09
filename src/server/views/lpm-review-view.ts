/**
 * LPM-Portfolio-Review Loader (Adapter). Lädt die Prisma-Rows, normalisiert
 * Decimals/JSON/Datumswerte auf die reinen Eingaben von {@link computeLpmReview}
 * und reicht das Ergebnis + Seiten-Meta (Stichtag, PI-Achse, Quartals-Label)
 * an die Page. Die Kennzahl-Logik lebt in `@/domain/lpm-review` — hier nur I/O.
 *
 * Der Value-Stream-Filter der Seite wirkt **client-seitig** (Drilldown auf
 * Abschnitt 3); der Loader liefert stets das volle Portfolio. Nur der
 * Stichtag/PI ist ein Server-Input (er verschiebt alle Berechnungen).
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import { parseMeasurements } from "@/modules/core/kpi/domain/kpi-measurement";
import {
  computeLpmReview,
  type LpmEpicInput,
  type LpmPi,
  type LpmReviewModel,
} from "@/domain/lpm-review";

const num = (d: unknown): number | null => (d != null ? Number(d) : null);

export interface LpmPiOption {
  id: string;
  label: string;
  endMs: number;
}

export interface LpmReviewPageData {
  model: LpmReviewModel;
  /** Stichtag (Epoch ms + ISO-Tag) für Anzeige + Berechnung. */
  asOfMs: number;
  asOfIso: string;
  /** Quartals-/Jahres-Label für die Kopfzeile, z. B. „Q3 / 2026". */
  periodLabel: string;
  /** PI-Achse für den Stichtag-Picker (chronologisch). */
  pis: LpmPiOption[];
  /** Aktiver Stichtag-PI (falls per `piId` gewählt), sonst null. */
  activePiId: string | null;
}

/** Quartals-Label aus einem Datum: „Q3 / 2026". */
function quarterLabel(d: Date): string {
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} / ${d.getUTCFullYear()}`;
}

export async function loadLpmReview(
  db: PrismaClient,
  tenantId: TenantId,
  input: { piId?: string | undefined; asOf?: Date | undefined } = {},
): Promise<LpmReviewPageData> {
  const [epicRows, piRows] = await Promise.all([
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      select: {
        id: true,
        title: true,
        plannedEndAt: true,
        valueStream: { select: { id: true, name: true } },
        kpis: {
          select: {
            baseline: true,
            target: true,
            valuePerUnit: true,
            benefitKind: true,
            recurringInterval: true,
            measurements: true,
          },
        },
        children: {
          where: { level: InitiativeLevel.FEATURE, deletedAt: null },
          select: {
            status: true,
            completedAt: true,
            pi: { select: { endDate: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.programIncrement.findMany({
      where: { tenantId },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
  ]);

  // Kanonische PI-Achse: identische Fenster (start+end) über mehrere Timelines
  // zu einem Bucket zusammenfassen; erstes Vorkommen liefert id + Label.
  const pisByWindow = new Map<string, LpmPi>();
  for (const p of piRows) {
    const startMs = p.startDate.getTime();
    const endMs = p.endDate.getTime();
    const key = `${startMs}-${endMs}`;
    if (!pisByWindow.has(key)) {
      pisByWindow.set(key, { id: p.id, label: p.name, startMs, endMs });
    }
  }
  const pis = [...pisByWindow.values()].sort((a, b) => a.startMs - b.startMs);

  // Stichtag: gewählter PI (dessen Ende) oder explizites asOf oder „jetzt".
  const activePi = input.piId ? pis.find((p) => p.id === input.piId) : undefined;
  const asOf = activePi ? new Date(activePi.endMs) : (input.asOf ?? new Date());
  const asOfMs = asOf.getTime();

  const epics: LpmEpicInput[] = epicRows.map((e) => ({
    id: e.id,
    title: e.title,
    valueStreamId: e.valueStream?.id ?? null,
    valueStreamName: e.valueStream?.name ?? null,
    kpis: e.kpis.map((k) => ({
      baseline: num(k.baseline),
      target: num(k.target),
      valuePerUnit: num(k.valuePerUnit),
      benefitKind: k.benefitKind,
      recurringInterval: k.recurringInterval,
      measurements: parseMeasurements(k.measurements).map((m) => ({
        atMs: Date.parse(m.at),
        value: m.value,
      })),
    })),
    features: e.children.map((f) => ({
      status: f.status,
      piEndMs: f.pi ? f.pi.endDate.getTime() : null,
      completedAtMs: f.completedAt ? f.completedAt.getTime() : null,
    })),
    plannedEndMs: e.plannedEndAt ? e.plannedEndAt.getTime() : null,
  }));

  const model = computeLpmReview({ epics, pis, config: { asOfMs } });

  return {
    model,
    asOfMs,
    asOfIso: asOf.toISOString().slice(0, 10),
    periodLabel: quarterLabel(asOf),
    pis: pis.map((p) => ({ id: p.id, label: p.label, endMs: p.endMs })),
    activePiId: activePi?.id ?? null,
  };
}
