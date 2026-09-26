import type { PrismaClient, Prisma } from "@/generated/prisma";

/**
 * **Alles, was an einem Mandanten haengt — in der Reihenfolge, in der es
 * geloescht werden darf.**
 *
 * Diese Liste gab es bisher **einmal**, in `prisma/seed-helpers.ts`, und nur
 * fuer den Reseed. Sie steht jetzt hier, weil zwei Wege sie brauchen: der Seed,
 * der die Fachdaten eines Mandanten ersetzt, und die Plattform-Verwaltung, die
 * einen Mandanten samt Inhalt loescht. Zwei Listen waeren die Doppelung, an der
 * dieses Repo schon mehrfach haengengeblieben ist — die zweite zieht nicht nach,
 * wenn jemand ein Modell ergaenzt.
 *
 * **Der Waechter ist ein Test, keine Sorgfalt.** `tenant-teardown.test.ts` zieht
 * aus Prismas DMMF jedes Modell mit einem `tenantId`-Feld und haelt es gegen
 * diese Liste. Ein neues Modell laesst den Test fallen, bis jemand entscheidet,
 * wohin es gehoert — statt still liegenzubleiben.
 *
 * **Sechs Tabellen fehlten** bis September 2026 und blieben beim Reseed als
 * Leichen zurueck: `ViewPreference`, `RoleOnboarding`, `JiraConfig`,
 * `AzureDevOpsConfig`, `OutboxEvent`, `IdempotencyKey`. Drei weitere
 * (`ArtOwnWorkAllocation`, `BudgetCandidate`, `BudgetParticipant`) ueberlebten
 * nur ueber eine Kaskade — sie stehen jetzt ausdruecklich da, weil eine
 * Reihenfolge, die sich auf Kaskaden verlaesst, eine Zufaelligkeit ist.
 *
 * **Was NICHT hier steht:** `Tenant` selbst (die Zeile loescht der Aufrufer nach
 * dem Raeumen) und `TenantProvisionRequest` — dessen `createdTenantId` ist ein
 * blosser Skalar ohne FK und dokumentiert, welcher Antrag zu welchem Mandanten
 * fuehrte. Er ueberlebt den Mandanten bewusst, wie der Audit-Eintrag.
 */

/** Ein Schritt: das Prisma-Delegate und optional ein engerer Filter. */
export interface TeardownStep {
  /** Delegate-Name am Client, z. B. `goalCheckin`. */
  model: string;
  /** Zusaetzlich zu `tenantId` — bisher nur fuer die zwei Initiative-Ebenen. */
  where?: Record<string, unknown>;
  /** Warum dieser Schritt hier steht und nicht anderswo. */
  why?: string;
}

export const TENANT_TEARDOWN_ORDER: readonly TeardownStep[] = [
  // ── Ziele + Kinder (die meisten kaskadieren vom Objective, explizit ist sicher)
  { model: "goalCheckin" },
  { model: "goalComment" },
  { model: "goalCustomFieldValue" },
  { model: "goalCustomFieldDef" },
  { model: "goalRelatedWork" },
  { model: "goalValueStreamLink" },
  { model: "goalArtLink" },
  { model: "goalEpicLink" },
  { model: "themeEpicLink" },
  { model: "objective" },
  { model: "strategicTheme" },

  // ── Transformation
  { model: "transformationAction" },
  { model: "targetOperatingModel" },

  // ── Budgeting
  { model: "artEpicAllocation", why: "wuerde ueber das Epic kaskadieren" },
  { model: "valueStreamGuardrailTargets", why: "wuerde ueber den Wertstrom kaskadieren" },
  { model: "budgetCandidate", why: "kaskadiert von budgetRound — trotzdem ausdruecklich" },
  { model: "budgetParticipant", why: "kaskadiert von budgetRound — trotzdem ausdruecklich" },
  { model: "budgetRound", why: "kaskadiert Gruppen, Mitglieder, Decisions, ReportOuts" },
  { model: "rtbItemAward", why: "haengt an der Betriebsposition" },
  { model: "runTheBusinessItem", why: "wertstrom-scoped → vor valueStream" },
  { model: "budgetPlanRevision" },
  { model: "budgetAllocation" },

  // ── Initiative-Nebentabellen (ADR-0018: Approval → Transition → Initiative)
  { model: "stageGateApproval" },
  { model: "stageGateTransition" },
  { model: "kpi" },
  { model: "dependency" },
  { model: "initiativeGraphPosition" },
  { model: "artGraphPosition" },

  // ── Initiativen blattweise: Feature vor Epic
  { model: "epicSolution" },
  { model: "initiative", where: { level: 1 }, why: "Features vor ihren Epics" },
  { model: "initiative", where: { level: 0 } },
  { model: "solution", why: "Solution.valueStreamId → vor valueStream" },

  // ── Issues (selbstverschachtelt, faellt zusammen)
  { model: "issueMitigation" },
  { model: "issueAssessment" },
  { model: "issue" },
  { model: "issueSettings" },

  // ── PI-scoped
  { model: "systemDemoItem" },
  { model: "systemDemo" },
  { model: "artPiCapacity", why: "kaskadiert von PI und ART — trotzdem ausdruecklich" },
  { model: "programIncrement" },

  // ── Org-Struktur
  { model: "artOwnWorkAllocation", why: "kaskadiert vom ART — trotzdem ausdruecklich" },
  { model: "art" },
  { model: "timeline" },
  { model: "stageGateApproverRule", why: "referenziert den Wertstrom → vor ihm" },
  { model: "valueStream" },

  // ── Alleinstehend (tenantId als Skalar, keine Reihenfolge-Bedingung)
  { model: "piStandard" },
  { model: "setupProgress" },
  { model: "roleCapability" },
  { model: "roleOnboarding" },
  { model: "viewPreference" },
  { model: "jiraConfig" },
  { model: "azureDevOpsConfig" },
  { model: "outboxEvent" },
  { model: "idempotencyKey" },
  { model: "auditEvent" },
  { model: "tenantInvite" },
  { model: "tenantJoinRequest" },
  { model: "savedFilter" },
];

/**
 * Die Mitgliedschaften. **Eigener Schritt, nicht Teil der Liste**, weil die
 * beiden Aufrufer sich hier unterscheiden: ein Reseed ersetzt die Fachdaten und
 * laesst die Leute stehen, ein Mandanten-Loeschen nimmt sie mit.
 */
export const TEARDOWN_MEMBERSHIP_STEP: TeardownStep = { model: "userRoleAssignment" };

interface DeleteManyDelegate {
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
}

function delegateOf(db: TeardownClient, model: string): DeleteManyDelegate {
  const delegate = (db as unknown as Record<string, DeleteManyDelegate | undefined>)[model];
  if (!delegate?.deleteMany) {
    throw new Error(`Kein Prisma-Delegate „${model}" — Raeum-Liste und Schema laufen auseinander.`);
  }
  return delegate;
}

export type TeardownClient = PrismaClient | Prisma.TransactionClient;

/**
 * **Zeitrahmen für eine Räum-Transaktion.**
 *
 * Prismas Voreinstellung für eine interaktive Transaktion ist **5 Sekunden**,
 * und die reichen nicht: die Liste macht rund sechzig Rundläufe, und schon ein
 * **leerer** Mandant lag mit 5.041 ms knapp darüber (gemessen beim ersten Lauf
 * des Aufräum-Skripts, das prompt mit P2028 abbrach). Ein Mandant mit 768
 * Vorhaben braucht ein Vielfaches.
 *
 * Zwei Minuten sind grosszügig, und das ist Absicht: die Sperren liegen auf den
 * Zeilen **dieses** Mandanten, andere arbeiten weiter. Ein halb geräumter
 * Mandant wäre dagegen nicht mehr zu löschen — die Atomarität ist hier mehr wert
 * als die kurze Sperre.
 */
export const TEARDOWN_TX_OPTIONS = { timeout: 120_000, maxWait: 15_000 } as const;

export interface TeardownResult {
  /** Je Modell die Zahl geloeschter Zeilen — 0 bleibt drin, das ist eine Aussage. */
  deleted: Record<string, number>;
  total: number;
}

/**
 * Raeumt alles, was an `tenantId` haengt — **nicht** die Mandantenzeile selbst.
 *
 * `includeMembers` entscheidet ueber die Rollenzuweisungen: beim Reseed bleiben
 * sie (sonst verloere jeder seinen Zugang zu einem Mandanten, der gleich wieder
 * gefuellt wird), beim Loeschen gehen sie mit.
 */
export async function wipeTenantData(
  db: TeardownClient,
  tenantId: string,
  opts: { includeMembers?: boolean } = {},
): Promise<TeardownResult> {
  const steps = opts.includeMembers
    ? [...TENANT_TEARDOWN_ORDER, TEARDOWN_MEMBERSHIP_STEP]
    : TENANT_TEARDOWN_ORDER;

  const deleted: Record<string, number> = {};
  let total = 0;
  for (const step of steps) {
    const res = await delegateOf(db, step.model).deleteMany({
      where: { tenantId, ...(step.where ?? {}) },
    });
    deleted[step.model] = (deleted[step.model] ?? 0) + res.count;
    total += res.count;
  }
  return { deleted, total };
}
