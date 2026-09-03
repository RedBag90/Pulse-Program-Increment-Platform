/* eslint-disable no-console */
/**
 * Gemeinsame Seed-Bausteine für das **Kachel-Budgeting-Modell** (Perioden,
 * Beteiligte→Gruppen, Selbst-Verteilung, Run-the-Business, Finalisierung).
 * Genutzt von `seed-demo.ts` (Pulse Demo Corp) und `seed-offsite.ts` (Test Demo).
 *
 * Alle IDs via `uid(key)` → idempotenter Reseed + querverweisbare Relationen.
 * Der Seed schreibt Rohzeilen direkt (nicht über die Services): bei `closed` sind
 * `finalAmount` + `reserveAmount` gesetzt; der VS-/ART-Tab liest
 * `BudgetCandidate.finalAmount`.
 */

import { prisma, uid } from "./seed-helpers.js";

export interface RtbItemSpec {
  name: string;
  plannedAmount: number;
  /** "monthly" | "half_yearly" | "yearly" — immer explizit, nie geraten. */
  interval: string;
  /** `null` = wertstrom-übergreifend (geteilte Plattform, Programm-Office). */
  solutionId?: string | null;
  /** Zurechnung zu einem ART. Pflicht für einen Veränderungsrahmen. */
  artId?: string | null;
  /** `"run"` (Default) = Betrieb, `"art_change"` = Veränderungsrahmen eines ARTs. */
  kind?: string;
}

export interface RtbSpec {
  valueStreamId: string;
  items: RtbItemSpec[];
}

export interface SeededRtbItem {
  id: string;
  valueStreamId: string;
  name: string;
  plannedAmount: number;
  interval: string;
  /** `null` = wertstrom-übergreifend. */
  artId: string | null;
  /** `"run"` = Betrieb, `"art_change"` = Veränderungsrahmen. */
  kind: string;
}

/** Legt je Value Stream die Run-the-Business-Positionen an. Gibt sie zurück. */
export async function seedRunTheBusiness(
  tenantId: string,
  actorId: string,
  specs: RtbSpec[],
): Promise<SeededRtbItem[]> {
  const rows = specs.flatMap((s) =>
    s.items.map((it, n) => ({
      id: uid(`rtb:${s.valueStreamId}:${n}`),
      tenantId,
      valueStreamId: s.valueStreamId,
      name: it.name,
      plannedAmount: it.plannedAmount,
      interval: it.interval,
      solutionId: it.solutionId ?? null,
      artId: it.artId ?? null,
      kind: it.kind ?? "run",
      active: true,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  );
  await prisma.runTheBusinessItem.createMany({ data: rows, skipDuplicates: true });
  return rows.map((r) => ({
    id: r.id,
    valueStreamId: r.valueStreamId,
    name: r.name,
    plannedAmount: r.plannedAmount,
    interval: r.interval,
    artId: r.artId,
    kind: r.kind,
  }));
}

export interface EpicCandidateSpec {
  epicId: string;
  title: string;
  ask: number;
  valueStreamId: string | null;
  artId: string | null;
  finalAmount?: number | null;
}

export interface RtbCandidateSpec {
  rtbItemId: string;
  title: string;
  ask: number;
  valueStreamId: string | null;
  finalAmount?: number | null;
}

export interface GroupSpec {
  name: string;
  spokespersonUserId: string;
  submitted: boolean;
  memberUserIds: string[];
  /** candidate-ref (epicId ODER rtbItemId) → €-Betrag der Gruppe. */
  amounts: Record<string, number>;
}

export interface PeriodSpec {
  /** Stabiler Schlüssel für die uid-Ableitung (eindeutig je Tenant). */
  key: string;
  cycleKey: string;
  status: "draft" | "running" | "decided" | "closed";
  poolTotal: number;
  startDate: Date;
  endDate: Date;
  submissionDeadline: Date | null;
  reserveAmount?: number | null;
  participantUserIds: string[];
  epicCandidates: EpicCandidateSpec[];
  rtbCandidates: RtbCandidateSpec[];
  groups: GroupSpec[];
}

/** Erzeugt eine vollständige Kachel (Runde + Beteiligte + Kandidaten + Gruppen + Verteilung). */
export async function seedBudgetPeriod(
  tenantId: string,
  actorId: string,
  cfg: PeriodSpec,
): Promise<string> {
  const roundId = uid(`round:${cfg.key}`);
  const draft = cfg.status === "draft";

  await prisma.budgetRound.create({
    data: {
      id: roundId,
      tenantId,
      cycleKey: cfg.cycleKey,
      poolTotal: cfg.poolTotal,
      status: cfg.status,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      submissionDeadline: cfg.submissionDeadline,
      reserveAmount: cfg.reserveAmount ?? null,
      decisionAuthorityIds: [],
      createdBy: actorId,
      updatedBy: actorId,
    },
  });

  // Beteiligte
  await prisma.budgetParticipant.createMany({
    data: cfg.participantUserIds.map((userId) => ({
      id: uid(`part:${cfg.key}:${userId}`),
      tenantId,
      roundId,
      userId,
      createdBy: actorId,
    })),
    skipDuplicates: true,
  });

  // Kandidaten (rtb erst ab running — im Entwurf noch nicht materialisiert).
  // candidate-ref (epicId | rtbItemId) → candidateId, für die Allocations.
  const candidateIdByRef = new Map<string, string>();
  const epicRows = cfg.epicCandidates.map((c) => {
    const id = uid(`cand:${cfg.key}:epic:${c.epicId}`);
    candidateIdByRef.set(c.epicId, id);
    return {
      id,
      tenantId,
      roundId,
      kind: "epic",
      epicId: c.epicId,
      title: c.title,
      ask: c.ask,
      valueStreamId: c.valueStreamId,
      artId: c.artId,
      finalAmount: c.finalAmount ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    };
  });
  const rtbRows = draft
    ? []
    : cfg.rtbCandidates.map((c) => {
        const id = uid(`cand:${cfg.key}:rtb:${c.rtbItemId}`);
        candidateIdByRef.set(c.rtbItemId, id);
        return {
          id,
          tenantId,
          roundId,
          kind: "rtb",
          rtbItemId: c.rtbItemId,
          title: c.title,
          ask: c.ask,
          valueStreamId: c.valueStreamId,
          artId: null,
          finalAmount: c.finalAmount ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        };
      });
  await prisma.budgetCandidate.createMany({
    data: [...epicRows, ...rtbRows],
    skipDuplicates: true,
  });

  // Gruppen + Mitglieder + Verteilung
  for (let i = 0; i < cfg.groups.length; i++) {
    const g = cfg.groups[i]!;
    const groupId = uid(`bgroup:${cfg.key}:${i}`);
    await prisma.budgetGroup.create({
      data: {
        id: groupId,
        roundId,
        name: g.name,
        spokespersonId: g.spokespersonUserId,
        submittedAt: g.submitted ? (cfg.submissionDeadline ?? cfg.endDate) : null,
        submittedBy: g.submitted ? g.spokespersonUserId : null,
      },
    });
    await prisma.budgetGroupMember.createMany({
      data: g.memberUserIds.map((userId) => ({
        id: uid(`bgm:${cfg.key}:${i}:${userId}`),
        groupId,
        userId,
        isSubmitter: userId === g.spokespersonUserId,
      })),
      skipDuplicates: true,
    });
    const allocRows = Object.entries(g.amounts)
      .map(([ref, amount]) => {
        const candidateId = candidateIdByRef.get(ref);
        if (!candidateId) return null;
        return {
          id: uid(`alloc:${cfg.key}:${i}:${ref}`),
          roundId,
          groupId,
          candidateId,
          amount,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (allocRows.length > 0) {
      await prisma.groupAllocation.createMany({ data: allocRows, skipDuplicates: true });
    }
  }

  console.log(`  ✓ Kachel „${cfg.cycleKey}" (${cfg.status}) — ${cfg.groups.length} Gruppen`);
  return roundId;
}

// ---------------------------------------------------------------------------
// ART-Rahmen: Zuteilungen und Guardrail-Ziele
// ---------------------------------------------------------------------------

export interface ArtAllocationSpec {
  artId: string;
  epicId: string;
  cycleKey: string;
  amount: number;
  /** Richtwert, wie er beim Zuteilen eingefroren wurde. */
  ask: number;
}

/**
 * Legt die Verteilung eines ART-Rahmens auf seine ART-Epics an.
 *
 * Bewusst **ohne** Vollständigkeitsanspruch: nicht jedes ART-Epic bekommt eine
 * Zeile. Genau das erzeugt die Zustände, an denen die Fläche erklärbar wird —
 * ein Rahmen mit ungenutztem Rest, ein Epic ohne Deckung.
 */
export async function seedArtEpicAllocations(
  tenantId: string,
  actorId: string,
  specs: readonly ArtAllocationSpec[],
): Promise<void> {
  if (specs.length === 0) return;
  await prisma.artEpicAllocation.createMany({
    data: specs.map((s) => ({
      id: uid(`artalloc:${s.artId}:${s.epicId}:${s.cycleKey}`),
      tenantId,
      artId: s.artId,
      epicId: s.epicId,
      cycleKey: s.cycleKey,
      amount: s.amount,
      ask: s.ask,
      createdBy: actorId,
      updatedBy: actorId,
    })),
    skipDuplicates: true,
  });
}

export interface GuardrailTargetsSpec {
  valueStreamId: string;
  /** Nur die Achsen, die dieser Wertstrom selbst setzt — der Rest bleibt geerbt. */
  targets: Record<string, unknown>;
}

/**
 * Setzt Guardrail-Ziele für einzelne Wertströme.
 *
 * Absichtlich nicht für alle: erst der Unterschied zwischen gesetzter Zeile und
 * geerbtem Tenant-Default macht die Herkunftsanzeige („Wertstrom-Regel" gegen
 * „Tenant-Default") in der Fläche sichtbar.
 */
export async function seedValueStreamGuardrails(
  tenantId: string,
  actorId: string,
  specs: readonly GuardrailTargetsSpec[],
): Promise<void> {
  if (specs.length === 0) return;
  await prisma.valueStreamGuardrailTargets.createMany({
    data: specs.map((s) => ({
      id: uid(`vsguard:${s.valueStreamId}`),
      tenantId,
      valueStreamId: s.valueStreamId,
      targets: s.targets as never,
      updatedBy: actorId,
    })),
    skipDuplicates: true,
  });
}
