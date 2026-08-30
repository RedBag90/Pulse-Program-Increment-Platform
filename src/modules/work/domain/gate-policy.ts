import { type Quorum, isQuorum } from "@/modules/work/domain/approval-primitives";
import type { GateStep } from "@/modules/work/domain/stage-gate";

// ---------------------------------------------------------------------------
// Gate-Policy — WER nimmt welchen Reifegrad-Wechsel ab.
//
// Die Anforderung lautet: die Wechsel sind „durch spezifische Personen
// abzunehmen". Konfiguriert wird das je Value Stream und Gate; aufgelöst wird
// es zum Antragszeitpunkt zu konkreten `userId`s, die dann auf den
// Abnahme-Zeilen **eingefroren** werden. Eine spätere Konfig-Änderung deutet
// laufende Anträge damit nie um — dasselbe Snapshot-Muster, das
// `EpicApproval.approverUserId` schon benutzt.
//
// Präzedenz: Wertstrom-Zeile → Tenant-Zeile (valueStreamId = null) → Code-Default.
//
// Rein, kein I/O, keine Uhr.
// ---------------------------------------------------------------------------

/**
 * Rollen-Platzhalter in einer Regel. Sie werden erst beim Antrag zu Personen —
 * so bleibt „der Finance-Approver dieses Wertstroms" eine *Regel* statt einer
 * abgeschriebenen User-ID, die bei einem Personalwechsel still falsch wird.
 *
 * Ehrt die vorhandenen Governance-Spalten `ValueStream.financeApproverId` /
 * `vmoId` — dasselbe Prefill, das `buildApprovalView` für den Business Case macht.
 */
export const GATE_APPROVER_ROLES = [
  "value_stream.finance_approver",
  "value_stream.vmo",
  "epic.owner",
] as const;
export type GateApproverRole = (typeof GATE_APPROVER_ROLES)[number];

export function isGateApproverRole(value: string): value is GateApproverRole {
  return (GATE_APPROVER_ROLES as readonly string[]).includes(value);
}

/** Anzeige-Kurzform je Platzhalter — die UI beschriftet damit die Status-Pills. */
export const GATE_APPROVER_ROLE_LABELS: Record<GateApproverRole, string> = {
  "value_stream.finance_approver": "Finance",
  "value_stream.vmo": "VMO",
  "epic.owner": "Epic Owner",
};

/** Woher ein aufgelöster Abnehmer stammt — für Anzeige und Nachvollziehbarkeit. */
export type GateApproverSource = "value_stream" | "tenant" | "epic_owner" | "manual";

/** Ein aufgelöster, konkreter Abnehmer. */
export interface ResolvedApprover {
  userId: string;
  /** Der Platzhalter, aus dem er stammt — `null` bei direkt benannten Personen. */
  role: GateApproverRole | null;
  source: GateApproverSource;
}

/** Eine Regel-Zeile, so wie der Adapter sie aus der DB liest. */
export interface GateApproverRuleRow {
  valueStreamId: string | null;
  toGate: string;
  required: boolean;
  quorum: string;
  approverUserIds: string[];
  approverRoles: string[];
}

/** Die aufgelöste Policy für genau einen Ziel-Schritt. */
export interface GatePolicy {
  toGate: GateStep;
  /**
   * `false` ⇒ dieses Gate braucht keine Abnahme; der Antrag rückt sofort vor.
   * Weiterhin ein manueller, auditierter Akt — nur ohne Gegenzeichnung.
   */
  required: boolean;
  quorum: Quorum;
  approverUserIds: string[];
  approverRoles: GateApproverRole[];
  /** Welche Ebene gewonnen hat — die UI zeigt „geerbt vom Tenant" an. */
  source: "value_stream" | "tenant" | "code_default";
}

/**
 * Code-Defaults, wenn für ein Gate **keine** Regel-Zeile existiert. Bewusst so
 * gewählt, dass ein frisch aufgesetzter Tenant am Tag 1 arbeitsfähig ist, ohne
 * dass jemand erst Regeln pflegt — und trotzdem nie ohne Abnahme durchrutscht:
 * jedes Gate hat mindestens einen Platzhalter, der eine reale Person trifft.
 *
 * Bestätigter Rahmen: **alle** Vorwärts-Schritte brauchen eine Abnahme,
 * **einstimmig**.
 */
export const DEFAULT_GATE_POLICIES: Record<
  GateStep,
  Pick<GatePolicy, "required" | "quorum" | "approverUserIds" | "approverRoles">
> = {
  // Nach L0 führt kein Vorwärts-Antrag — nur ein Revert, der eigenen Regeln folgt.
  L0: { required: false, quorum: "all", approverUserIds: [], approverRoles: [] },
  // Selektion ins Detailing: der VMO entscheidet, was Aufwand bekommt.
  L1: { required: true, quorum: "all", approverUserIds: [], approverRoles: ["value_stream.vmo"] },
  // Eintritt in die Analyse.
  L2: { required: true, quorum: "all", approverUserIds: [], approverRoles: ["value_stream.vmo"] },
  // Die Investitionsentscheidung — Finance zeichnet mit.
  L3: {
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: ["value_stream.vmo", "value_stream.finance_approver"],
  },
  // Start der Umsetzung.
  L4: { required: true, quorum: "all", approverUserIds: [], approverRoles: ["value_stream.vmo"] },
  // „Umsetzung fertig": der Epic Owner meldet, der VMO bestätigt — bewusst
  // ohne Finance, denn hier geht es um die Lieferung, nicht um den Nutzen.
  "L4.2": {
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: ["value_stream.vmo"],
  },
  // Impact auf der Bilanz — die Controlling-Hand, früher der Impact-Dialog.
  L5: {
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: ["value_stream.finance_approver"],
  },
};

/**
 * Darf der Antragsteller die vorgeschlagenen Abnehmer je Epic überschreiben?
 *
 * Bestätigter Rahmen ist die Wertstrom-Konfiguration, nicht die Wahl pro Epic —
 * deshalb `false`. Der Override-Pfad ist trotzdem vollständig implementiert
 * (`expandApprovers(policy, ctx, override)`), damit ein Umschwenken eine
 * Konstante kostet und keinen Umbau. Bei Bedarf zum Practice-Flag hochziehen.
 */
export const ALLOW_AD_HOC_GATE_APPROVERS = false;

/**
 * Präzedenz-Auflösung: die Wertstrom-Zeile gewinnt, sonst die Tenant-Zeile
 * (`valueStreamId === null`), sonst der Code-Default. Ein unbekanntes Quorum in
 * der DB fällt auf `"all"` zurück — die Spalte ist ein String, also darf diese
 * Funktion sich nicht darauf verlassen, dass nur Gültiges drinsteht.
 */
export function resolveGatePolicy(
  toGate: GateStep,
  rows: readonly GateApproverRuleRow[],
  valueStreamId: string | null,
): GatePolicy {
  const forGate = rows.filter((r) => r.toGate === toGate);
  const row =
    (valueStreamId != null ? forGate.find((r) => r.valueStreamId === valueStreamId) : undefined) ??
    forGate.find((r) => r.valueStreamId === null);

  if (!row) {
    const fallback = DEFAULT_GATE_POLICIES[toGate];
    return { toGate, source: "code_default", ...fallback };
  }

  return {
    toGate,
    required: row.required,
    quorum: isQuorum(row.quorum) ? row.quorum : "all",
    approverUserIds: row.approverUserIds,
    approverRoles: row.approverRoles.filter(isGateApproverRole),
    source: row.valueStreamId === null ? "tenant" : "value_stream",
  };
}

/** Was zum Auflösen der Platzhalter gebraucht wird. */
export interface ApproverContext {
  valueStreamFinanceApproverId: string | null;
  valueStreamVmoId: string | null;
  epicOwnerId: string | null;
}

function resolveRole(role: GateApproverRole, ctx: ApproverContext): ResolvedApprover | null {
  switch (role) {
    case "value_stream.finance_approver":
      return ctx.valueStreamFinanceApproverId
        ? { userId: ctx.valueStreamFinanceApproverId, role, source: "value_stream" }
        : null;
    case "value_stream.vmo":
      return ctx.valueStreamVmoId
        ? { userId: ctx.valueStreamVmoId, role, source: "value_stream" }
        : null;
    case "epic.owner":
      return ctx.epicOwnerId ? { userId: ctx.epicOwnerId, role, source: "epic_owner" } : null;
  }
}

/**
 * Löst eine Policy zu konkreten Personen auf: erst die direkt benannten
 * `approverUserIds`, dann die Platzhalter. Dedupliziert nach `userId` — dieselbe
 * Person, die zweimal getroffen wird (etwa VMO *und* Finance-Approver), nimmt
 * einmal ab und blockiert nicht sich selbst.
 *
 * Ein Platzhalter, der ins Leere zeigt (kein VMO im Wertstrom hinterlegt), fällt
 * still weg. Der Aufrufer sieht das an der leeren Menge und behandelt es dort —
 * `planGateRequest` weigert sich, einen Antrag ohne Abnehmer anzulegen.
 *
 * `override` ersetzt die Policy-Auswahl vollständig (Herkunft `"manual"`) und
 * wird nur beachtet, wenn {@link ALLOW_AD_HOC_GATE_APPROVERS} an ist.
 */
export function expandApprovers(
  policy: GatePolicy,
  ctx: ApproverContext,
  override?: readonly string[] | undefined,
): ResolvedApprover[] {
  const raw: ResolvedApprover[] =
    ALLOW_AD_HOC_GATE_APPROVERS && override && override.length > 0
      ? override.map((userId) => ({ userId, role: null, source: "manual" as const }))
      : [
          ...policy.approverUserIds.map((userId) => ({
            userId,
            role: null,
            source: "manual" as const,
          })),
          ...policy.approverRoles
            .map((role) => resolveRole(role, ctx))
            .filter((a): a is ResolvedApprover => a !== null),
        ];

  const seen = new Set<string>();
  return raw.filter((a) => {
    if (seen.has(a.userId)) return false;
    seen.add(a.userId);
    return true;
  });
}
