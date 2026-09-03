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
  // Die fünf Business-Case-Parteien. Sie hatten eine eigene Freigabe-Achse
  // (`EpicApproval`); seit die Abnahme des Schritts L2 → L3.1 *die*
  // Business-Case-Freigabe ist, sind sie dessen Abnehmer. Die Rolle wandert auf
  // die Abnahme-Zeile mit — sonst wüsste hinterher niemand mehr, wer für
  // Finance und wer für den Business Owner unterschrieben hat (Guardrail 4).
  "epic.party.mgmt",
  "epic.party.business_owner",
  "epic.party.finance",
  "epic.party.irt_owner",
  "epic.party.lace_vmo",
  "solution.product_manager",
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
  "epic.party.mgmt": "MGMT",
  "epic.party.business_owner": "Business Owner",
  "epic.party.finance": "Finance",
  "epic.party.irt_owner": "IRT-Owner",
  "epic.party.lace_vmo": "LACE/VMO",
  "solution.product_manager": "Produkt-Manager",
};

/**
 * Die fünf Parteien der Business-Case-Freigabe, in Anzeigereihenfolge. Der
 * Abnehmer-Picker am L3.1-Antrag geht diese Liste durch.
 */
export const BUSINESS_CASE_PARTY_ROLES = [
  "epic.party.mgmt",
  "epic.party.business_owner",
  "epic.party.finance",
  "epic.party.irt_owner",
  "epic.party.lace_vmo",
] as const satisfies readonly GateApproverRole[];

/** Woher ein aufgelöster Abnehmer stammt — für Anzeige und Nachvollziehbarkeit. */
export type GateApproverSource = "value_stream" | "tenant" | "epic_owner" | "solution" | "manual";

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
  // Eintritt in die Investitionsphase. Dieser Schritt *ist* die
  // Business-Case-Freigabe, deshalb zeichnen hier die fünf Parteien — nicht der
  // VMO allein. Er steckt als LACE/VMO in der Liste.
  // Der Produkt-Manager der Primär-Solution zeichnet mit: das Vorhaben
  // verändert sein Produkt. Hier bei **allen** Epics seiner Solution — eine
  // Einschränkung auf ART-Epics wäre nicht entscheidbar, weil die Klasse erst
  // aus dieser Freigabe entsteht.
  "L3.1": {
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: [...BUSINESS_CASE_PARTY_ROLES, "solution.product_manager"],
  },
  // Die Investitionsentscheidung selbst — Finance zeichnet mit.
  "L3.2": {
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: ["value_stream.vmo", "value_stream.finance_approver"],
  },
  // Start der Umsetzung. Der Produkt-Manager zeichnet hier nur bei **ART-Epics**
  // mit — dort ist die Klasse bekannt, und dort wird sein Produkt aus dem
  // Rahmen seines ARTs verändert. Die Einschränkung sitzt in `expandApprovers`,
  // weil erst dort das Gate bekannt ist (siehe dort).
  L4: {
    required: true,
    quorum: "all",
    approverUserIds: [],
    approverRoles: ["value_stream.vmo", "solution.product_manager"],
  },
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
 * Darf der Antragsteller die vorgeschlagenen Abnehmer für **diesen** Schritt je
 * Epic überschreiben?
 *
 * Für die meisten Schritte ist der bestätigte Rahmen die
 * Wertstrom-Konfiguration, nicht die Wahl pro Epic: „der VMO dieses Wertstroms"
 * ist eine Regel und keine Entscheidung des Antragstellers.
 *
 * **L3.1 ist die Ausnahme.** Wer für MGMT, den Business Owner oder den
 * IRT-Owner *dieses* Epics zeichnet, ist eine Eigenschaft des Epics und nicht
 * des Wertstroms — genau das hat vorher der Approver-Dialog des Business Case
 * erfasst. Er lebt jetzt am Antrag weiter.
 */
export function allowsAdHocApprovers(toGate: GateStep): boolean {
  return toGate === "L3.1";
}

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
  opts?: { multiPartyApproval?: boolean },
): GatePolicy {
  const forGate = rows.filter((r) => r.toGate === toGate);
  const row =
    (valueStreamId != null ? forGate.find((r) => r.valueStreamId === valueStreamId) : undefined) ??
    forGate.find((r) => r.valueStreamId === null);

  if (!row) {
    const fallback = DEFAULT_GATE_POLICIES[toGate];
    // Die fünf Parteien an L3.1 sind der Ausdruck der Practice
    // `multiPartyApproval`. Ist sie aus, zeichnet der VMO allein — ein schlanker
    // Tenant soll für den Business Case nicht plötzlich fünf Unterschriften
    // brauchen, nur weil die Freigabe auf die Reifegrad-Achse gewandert ist.
    // Eine gepflegte Regel-Zeile (unten) sticht das ohnehin.
    if (toGate === "L3.1" && opts?.multiPartyApproval === false) {
      return {
        toGate,
        source: "code_default",
        ...fallback,
        approverRoles: ["value_stream.vmo"],
      };
    }
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
  /** Produkt-Manager der Primär-Solution des Epics; `null`, wenn keiner benannt. */
  solutionProductManagerId?: string | null;
  /**
   * Die abgeleitete Klasse des Epics — nur an `L4` relevant, wo der
   * Produkt-Manager ausschließlich bei ART-Epics mitzeichnet. An `L3.1` gibt es
   * sie noch gar nicht, dort zeichnet er bei allen Epics seiner Solution.
   */
  epicClass?: "portfolio" | "art" | null;
}

function resolveRole(role: GateApproverRole, ctx: ApproverContext): ResolvedApprover | null {
  switch (role) {
    case "value_stream.finance_approver":
    case "epic.party.finance":
      return ctx.valueStreamFinanceApproverId
        ? { userId: ctx.valueStreamFinanceApproverId, role, source: "value_stream" }
        : null;
    case "value_stream.vmo":
    case "epic.party.lace_vmo":
      return ctx.valueStreamVmoId
        ? { userId: ctx.valueStreamVmoId, role, source: "value_stream" }
        : null;
    case "epic.owner":
      return ctx.epicOwnerId ? { userId: ctx.epicOwnerId, role, source: "epic_owner" } : null;
    case "solution.product_manager":
      return ctx.solutionProductManagerId
        ? { userId: ctx.solutionProductManagerId, role, source: "solution" }
        : null;
    // MGMT, Business Owner und IRT-Owner haben keine Governance-Spalte am
    // Wertstrom — für sie gibt es keinen Code-Default. Sie kommen aus der
    // Wertstrom-Regel (`approverUserIds`) oder werden am Antrag benannt. Ein
    // Platzhalter ins Leere fällt still weg; `planGateRequest` fängt den Fall,
    // dass am Ende niemand übrig bleibt.
    case "epic.party.mgmt":
    case "epic.party.business_owner":
    case "epic.party.irt_owner":
      return null;
  }
}

/**
 * Eine am Antrag benannte Person. Die Rolle ist optional und wird — anders als
 * beim früheren reinen `userId[]`-Override — **mitgeführt**: sonst stünde auf
 * der Abnahme-Zeile zwar eine Person, aber nicht mehr, für welche Partei sie
 * zeichnet, und Guardrail 4 verlöre seine Datenbasis.
 */
export interface ApproverOverride {
  userId: string;
  role?: GateApproverRole | null;
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
 * wird nur beachtet, wenn {@link allowsAdHocApprovers} den Schritt dafür
 * freigibt.
 */
/**
 * Der eine gate-abhängige Sonderfall: der **Produkt-Manager** zeichnet an `L4`
 * nur bei ART-Epics mit.
 *
 * Er steht hier und nicht in `resolveRole`, weil dort das Gate nicht bekannt
 * ist — und nicht im Aufrufer, weil die Regel sonst unsichtbar in einem Lader
 * verschwände. Alle anderen Platzhalter gelten an jedem Schritt, an dem sie in
 * der Regel stehen.
 */
function appliesAtGate(role: GateApproverRole, toGate: GateStep, ctx: ApproverContext): boolean {
  if (role !== "solution.product_manager") return true;
  if (toGate !== "L4") return true;
  return ctx.epicClass === "art";
}

export function expandApprovers(
  policy: GatePolicy,
  ctx: ApproverContext,
  override?: readonly ApproverOverride[] | undefined,
): ResolvedApprover[] {
  const raw: ResolvedApprover[] =
    allowsAdHocApprovers(policy.toGate) && override && override.length > 0
      ? override.map((o) => ({ userId: o.userId, role: o.role ?? null, source: "manual" as const }))
      : [
          ...policy.approverUserIds.map((userId) => ({
            userId,
            role: null,
            source: "manual" as const,
          })),
          ...policy.approverRoles
            .filter((role) => appliesAtGate(role, policy.toGate, ctx))
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
