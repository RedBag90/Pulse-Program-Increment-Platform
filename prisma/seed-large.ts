/* eslint-disable no-console */
/**
 * „Large Test Corp" — eine Firma in der Restrukturierung mit
 * Cost-Optimization-Fokus über drei Workstreams (Verwaltung & Overhead ·
 * Logistik · Produktion), **Halbjahr für Halbjahr durchgespielt**.
 *
 * Der Seed rechnet die Vergangenheit nicht mehr rückwärts aus einem gewürfelten
 * Reifegrad. Er **spielt sie**: `seed-large-rounds.ts` läuft sechs Runden durch —
 * Ideen sammeln, sichten, reifen, budgetieren, umsetzen, wirken lassen — und
 * liefert je Epic seinen Weg und je Runde ihre Entscheidungen. Alles hier hängt
 * sich daran.
 *
 * Engpass ist das **Budget: €2 Mio. je Halbjahres-Zyklus**. Davon gehen Betrieb
 * und die sechs ART-Epic-Rahmen ab — beide wachsen mit dem Programm —, der Rest
 * steht der Kandidatenliste zur Verfügung. Daraus folgt, was den Mandanten
 * ausmacht: **die Summe der Anfragen liegt weit über dem Topf, und wer nicht
 * finanziert wird, wartet eine Runde.**
 *
 * Der Reifegrad ist damit **Ergebnis, nicht Vorgabe**: er sagt, wie viele Runden
 * ein Epic durchlaufen hat und ob es Geld bekam. Ebenso die Zahl der Epics — sie
 * folgt aus Zulauf mal Runden.
 *
 * **Zwei Wege zum Geld, wie im Ablauf beschrieben:** Portfolio-Epics (Kosten
 * über dem Limit ihres Wertstroms) stehen auf der Kandidatenliste ihrer
 * Halbjahres-Kachel; ART-Epics stehen dort **nicht**, sondern werden aus dem
 * ART-Epic-Budget ihres ARTs bedient. Je Halbjahr existiert genau **eine**
 * Kachel — zwei würden einander still überschreiben.
 *
 * Zusätzlich: Issues je Epic, Features im Umsetzungsmodul, Ziele = Top-Ziel +
 * je Wertstrom aufgebrochen, Solutions je Wertstrom mit zugeordneten Epics.
 *
 * Eigener Tenant, uid-Namespace `uid("large:…")`, nur Demo-Logins (@pulse.dev,
 * `Test1234!`), Reset-then-insert (`wipeDomainData`).
 *
 * Run: `pnpm db:seed:large`  (lädt `.env.local` selbst; braucht DIRECT_URL + Supabase Service-Role)
 *
 * Trockenläufe ohne Schreibzugriff:
 *   `npx tsx prisma/scripts/dry-rounds.ts`        — die Zahlen je Runde
 *   `npx tsx prisma/scripts/dry-gate-history.ts`  — die Tor-Historien, geprüft
 */

import type { Prisma } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import {
  buildBudgetPlanSnapshot,
  type ArtSnapshotInput,
  type BudgetPlanSnapshot,
  type FeatureSnapshotInput,
} from "@/modules/budgeting/domain/budget-plan-snapshot";
import { compareCycles } from "@/modules/budgeting/domain/cycle";
import {
  snapshotFeatures,
  snapshotArtRows,
  assertSnapshotLoad,
  type SeedArtFinal,
  type SeedPiMeta,
} from "./seed-snapshot.js";
import { prisma, upsertAuthUser, assignRole, wipeDomainData, uid } from "./seed-helpers.js";
import {
  seedArtEpicAllocations,
  seedBudgetPeriod,
  seedRunTheBusiness,
  seedValueStreamGuardrails,
  type ArtAllocationSpec,
  type GroupSpec,
} from "./seed-budgeting.js";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import {
  allocationRuleViolations,
  formatAllocationViolations,
  type AllocationFacts,
} from "@/modules/budgeting/domain/allocation-eligibility";
import {
  assertGateHistory,
  buildGateHistory,
  gateRuleRows,
  type GateApprovalRow,
  type GateMove,
  type GateTransitionRow,
} from "./seed-gate-history.js";
import { contentForGate, assertGateContent } from "./seed-gate-content.js";
import { currentGateStep } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { gateOfStep } from "@/modules/work/domain/stage-gate";
import type { Horizon } from "@/modules/work/domain/portfolio-guardrails";
import {
  nextGate as nextGateStep,
  previousGate as previousGateStep,
} from "@/modules/work/domain/gate-readiness";
import { buildRoundPlan, moveAt, PHASE } from "./seed-large-rounds.js";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";

// ── Zeit-Anker (Szenario steht in Jahr 5 des Programms) ──────────────────────
const DAY = 86_400_000;
/**
 * Die echte Uhr. Sie bestimmt, **welches Halbjahr das laufende ist** — früher
 * stand hier fest `H1`, und von Juli bis Dezember zeigte der Mandant deshalb
 * eine „laufende" Kachel, die für die App längst vergangen war: das
 * Verteilfenster der ART-Rahmen (`potWindowClosedReason`) war zu, obwohl der
 * Datensatz behauptete, gerade werde verteilt.
 */
const realNow = new Date();
const YEAR = realNow.getFullYear();
/**
 * „Jetzt" im Szenario: gut zwei Monate in das laufende Halbjahr hinein, aber
 * nie hinter der echten Uhr. `now` ist die *simulierte* Gegenwart, gegen die
 * die Historie gerechnet wird; alles, was „gerade offen" aussehen soll, hängt
 * an `realNow` — die App misst Wartezeiten und Überfälligkeit gegen die echte
 * Zeit.
 */
const now = new Date(
  Math.min(
    realNow.getTime(),
    new Date(YEAR, realNow.getMonth() < 6 ? 0 : 6, 6).getTime() + 55 * DAY,
  ),
);
const addDays = (base: Date, d: number): Date => new Date(base.getTime() + d * DAY);
const beforeNow = (d: Date, margin = 3): Date =>
  new Date(Math.min(d.getTime(), now.getTime() - margin * DAY));

function cycleStart(key: string): Date {
  const [ys, hs] = key.split("-");
  return new Date(Number(ys), hs === "H1" ? 0 : 6, 6);
}
const cycleEnd = (key: string): Date => addDays(cycleStart(key), 178);

/**
 * **Das Fenster: fünf gespielte Halbjahre, das laufende, und eines voraus.**
 *
 * Es hängt an der echten Uhr statt an eingetragenen Jahreszahlen — ein festes
 * `2024-H1` wäre in einem Jahr falsch, und dieser Seed hatte die Falle schon
 * einmal (siehe `realNow` oben). Gerechnet wird über den Halbjahres-Index, damit
 * der Jahreswechsel nicht in die Quere kommt.
 */
const HALF_IDX = realNow.getFullYear() * 2 + (realNow.getMonth() < 6 ? 0 : 1);
const keyOfHalf = (h: number): string => `${Math.floor(h / 2)}-H${(h % 2) + 1}`;
const WINDOW_BACK = 5;
/**
 * Zwei Halbjahre voraus, nicht eines: die **laufende** Runde bereitet das
 * nächste Halbjahr vor, die **Entwurfs**-Runde das übernächste. Mit nur einem
 * Vorlauf klemmten beide auf denselben Zyklus-Schlüssel — und zwei Kacheln im
 * selben Halbjahr überschreiben einander still, weil Zuteilungen, ART-Rahmen
 * und RtB-Awards alle am Schlüssel hängen.
 */
const ALL_CYCLES = Array.from({ length: WINDOW_BACK + 3 }, (_, k) =>
  keyOfHalf(HALF_IDX - WINDOW_BACK + k),
);
const CURRENT_CYCLE = halfYearKey(realNow);
const CURRENT_IDX = ALL_CYCLES.indexOf(CURRENT_CYCLE);
const MAX_IDX = ALL_CYCLES.length - 1;
const PROGRAM_TARGET_YEAR = `${YEAR + 2}`;

// €2 Mio. je Halbjahres-Zyklus (= €4 Mio./Kalenderjahr). Der Topf muss Betrieb,
// ART-Epic-Budget **und** die Portfolio-Vorhaben tragen — vorher forderten
// die drei zusammen 272 % des Topfes, und die Kachel-Logik wich dem mit einer
// zweiten Runde im selben Halbjahr aus.
const CYCLE_POOL = 2_000_000;

/**
 * **Betrieb und Rahmen — eine Quelle für den Motor und für die Kachel.**
 *
 * Der Motor rechnet damit, wie viel vom Topf überhaupt für Vorhaben übrig
 * bleibt; die Kachel schreibt daraus die Endbeträge der
 * Run-the-Business-Positionen. Liefen die beiden auseinander, stünde in der
 * Datenbank ein ART-Rahmen, gegen den der Motor nie entschieden hat — und
 * Zuteilungen, die die Anwendung zur Laufzeit ablehnen würde.
 *
 * Beide wachsen mit dem Programm. Genau das macht den Engpass sichtbar: der
 * Topf bleibt, der Betrieb steigt, für Neues bleibt Halbjahr um Halbjahr
 * weniger.
 */
const ART_FRAME = (c: number): number => 110_000 + c * 5_000;
const RUN_COST = (c: number): number => 300_000 + c * 12_000;

const TENANT_NAME = "Large Test Corp";

/**
 * Wie viele Ideen je Halbjahr hereinkommen. Aus ihnen und der Zahl der Runden
 * folgt der Umfang des Mandanten — es gibt kein `EPIC_COUNT` mehr, weil die
 * Menge das **Ergebnis** des Durchlaufs ist und nicht seine Vorgabe.
 */
const INTAKE_PER_CYCLE = 22;

async function ensureLargeTenant(): Promise<string> {
  const existing = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (existing) {
    console.log(`  ↳ ${TENANT_NAME} existiert`);
    return existing.id;
  }
  const t = await prisma.tenant.create({
    data: { id: uid("large:tenant"), name: TENANT_NAME, region: "eu", kind: "organization" },
  });
  console.log(`  ✓ ${TENANT_NAME} angelegt`);
  return t.id;
}

async function main() {
  console.log(
    `\n🌱  LARGE-Seed startet (sechs gespielte Runden, laufendes Halbjahr ${CURRENT_CYCLE})\n`,
  );

  // ── Phase 1: Auth-User ─────────────────────────────────────────────────────
  console.log("── Auth-User");
  const U = {
    admin: await upsertAuthUser("admin@pulse.dev", "Admin1234!"),
    portfolio: await upsertAuthUser("portfolio@pulse.dev", "Test1234!"),
    vmo: await upsertAuthUser("vmo@pulse.dev", "Test1234!"),
    rte: await upsertAuthUser("rte@pulse.dev", "Test1234!"),
    owner: await upsertAuthUser("owner@pulse.dev", "Test1234!"),
    viewer: await upsertAuthUser("viewer@pulse.dev", "Test1234!"),
    vso: await upsertAuthUser("vso@pulse.dev", "Test1234!"),
    fo: await upsertAuthUser("fo@pulse.dev", "Test1234!"),
  };
  const ADMIN = U.admin;

  // ── Phase 1: Tenant + Ökonomie ────────────────────────────────────────────
  console.log("\n── Tenant");
  const tenantId = await ensureLargeTenant();
  await wipeDomainData(tenantId);

  // 10-Jahres-Budget-Entwurf: ~€1 Mio. je Zyklus über alle 20 Zyklen (Controller,
  // Jahr 1). Nur noch eine lokale Vorgabe für die Kachel-Töpfe unten — einen
  // Tenant-weiten Topf gibt es nicht mehr.
  const budgetPoolByPeriod: Record<string, number> = {};
  ALL_CYCLES.forEach((c) => {
    budgetPoolByPeriod[c] = CYCLE_POOL;
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      enabledModules: [],
      costNeutralTarget: 500_000,
      dashboardHorizonEnd: cycleEnd(ALL_CYCLES[MAX_IDX]!),
      budgetWindowSize: 4,
      costPerJobSizePoint: 1_500,
      guardrailTargets: {
        horizon: { h3: 10, h2: 25, h1: 55, h0: 10 },
        capacity: { business: 65, enabler: 35 },
      },
    },
  });

  // ── Phase 2: RBAC ─────────────────────────────────────────────────────────
  console.log("\n── Rollen + Capabilities");
  const vsIds = [uid("large:vs:0"), uid("large:vs:1"), uid("large:vs:2")];
  const artIds = Array.from({ length: 6 }, (_, i) => uid(`large:art:${i}`));

  await assignRole(U.admin, tenantId, "platform_admin");
  await assignRole(U.admin, tenantId, "tenant_admin");
  await assignRole(U.portfolio, tenantId, "portfolio_manager");
  await assignRole(U.vmo, tenantId, "portfolio_manager");
  await assignRole(U.rte, tenantId, "rte");
  await assignRole(U.owner, tenantId, "epic_owner");
  await assignRole(U.owner, tenantId, "feature_owner");
  await assignRole(U.viewer, tenantId, "viewer");
  await assignRole(U.vso, tenantId, "value_stream_owner", { valueStreamIds: [vsIds[0]!] });
  await assignRole(U.fo, tenantId, "feature_owner");

  const capsList = enumerateDefaultCapabilities();
  await prisma.roleCapability.createMany({
    data: capsList.map((c) => ({
      tenantId,
      role: c.role,
      action: c.action,
      scope: c.scope,
      createdBy: ADMIN,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ ${capsList.length} Default-Capabilities gespiegelt`);

  // ── Phase 3: Struktur (3 Workstreams) ─────────────────────────────────────
  console.log("\n── Struktur (3 Workstreams, 6 ARTs, Timeline, PIs)");
  const timelineId = uid("large:timeline");
  /**
   * **Zwei Kadenzen.** Der Programm-Takt läuft an der Restrukturierungs-
   * Kadenz; der werksnahe Train „Materials & Energy" hat einen eigenen, weil
   * er an Anlagenstillständen hängt und nicht am Programm-Kalender.
   *
   * Das ist zugleich der einzige Weg, das **Abschluss-Tor** vorzuführen:
   * `countOpenRoamIssues` zählt offene Issues über **alle ARTs einer
   * Timeline**, nicht über ein PI. Bei einer Timeline wäre „keine offenen
   * Issues" eine mandantenweite Eigenschaft — und die soll dieser Datensatz
   * gerade nicht haben.
   */
  const timelineBId = uid("large:timeline:werk");
  /** Die ARTs an der zweiten Timeline (Index in `artIds`). */
  const TIMELINE_B_ARTS = new Set([5]);
  await prisma.timeline.createMany({
    data: [
      { id: timelineId, tenantId, name: "Restrukturierungs-Kadenz" },
      { id: timelineBId, tenantId, name: "Werks-Kadenz" },
    ],
  });
  await prisma.piStandard.create({
    data: {
      id: uid("large:pistd"),
      tenantId,
      name: "Standard 10-Wochen",
      anchorMonth: 1,
      anchorDay: 6,
      cadenceWeeks: 10,
      piCount: 8,
      createdBy: ADMIN,
    },
  });

  const vsNames = ["Verwaltung & Overhead", "Logistik", "Produktion"];
  const vsDesc = [
    "SG&A/Overhead senken: Prozessautomatisierung, Shared Services, IT-/Einkaufs-Konsolidierung.",
    "Logistikkosten senken: Fracht, Netzwerk, Bestände, Verpackung und Retouren.",
    "Herstellkosten senken: OEE, Ausschuss, Energie, Rüstzeiten und Materialkosten.",
  ];
  await prisma.valueStream.createMany({
    data: vsNames.map((name, i) => ({
      id: vsIds[i]!,
      tenantId,
      name,
      description: vsDesc[i]!,
      budgetAmount: [500_000, 800_000, 1_200_000][i]!,
      budgetCurrency: "EUR",
      financeApproverId: U.fo,
      vmoId: U.vmo,
      // Die beiden jüngeren Benennungen: der Business Owner belegt die
      // Business-Case-Partei vor, der Architect Lead ist nur benannt. Ohne sie
      // stünde im Verzeichnis („Wen frage ich wofür") überall „Nicht benannt".
      businessOwnerId: U.vso,
      architectLeadId: U.portfolio,
    })),
  });

  const artNames = [
    "Shared Services & Automation",
    "Procurement & IT",
    "Transport & Network",
    "Warehouse & Inventory",
    "Plant Efficiency (OEE)",
    "Materials & Energy",
  ];
  await prisma.art.createMany({
    data: artNames.map((name, i) => ({
      id: artIds[i]!,
      tenantId,
      valueStreamId: vsIds[Math.floor(i / 2)]!,
      name,
      description: `${name} — Agile Release Train`,
      rteId: U.rte,
      technicalLeadId: U.owner,
      timelineId: TIMELINE_B_ARTS.has(i) ? timelineBId : timelineId,
    })),
  });

  // 12 PIs im aktiven Umsetzungsfenster (um „jetzt" = das laufende Halbjahr).
  const piBase = addDays(now, -21);
  const piIds: Record<string, string> = {};
  const piSpecs = Array.from({ length: 12 }, (_, k) => {
    const key = `pi${k + 1}`;
    piIds[key] = uid(`large:pi:${key}`);
    const start = addDays(piBase, (k - 8) * 70);
    const status = k < 8 ? "completed" : k === 8 ? "active" : "planned";
    return { key, name: `PI ${k + 1}`, start, status };
  });
  await prisma.programIncrement.createMany({
    data: piSpecs.map((p, i) => ({
      id: piIds[p.key]!,
      tenantId,
      timelineId,
      name: p.name,
      startDate: p.start,
      endDate: addDays(p.start, 69),
      status: p.status,
      capacityJobSize: 120 + i * 4,
      capacityAmount: 220_000 + i * 8_000,
      // Die drei Zeremonie-Fakten des Abschluss-Tors, nur an abgeschlossenen
      // PIs. Eine Fläche, sie zu setzen, gibt es im Produkt nicht — siehe
      // `docs/concepts/pi-walkthrough.md`.
      ...(p.status === "completed"
        ? {
            systemDemoAt: addDays(p.start, 68),
            inspectAdaptAt: addDays(p.start, 69),
            retrospectiveAt: addDays(p.start, 69),
            retrospectiveNotes:
              "Gut: die Einsparungen aus dem Rollout wurden zum ersten Mal " +
              "direkt aus dem Controlling gegengelesen. Schlecht: zwei " +
              "Features lagen bis Woche 6 blockiert, weil die " +
              "Freigabe aus dem Einkauf fehlte. Maßnahme: Einkauf sitzt ab " +
              "dem nächsten PI im Planning mit am Tisch.",
          }
        : {}),
    })),
  });

  /**
   * Die Werks-Kadenz: kürzer, versetzt — und **sauber**. Über ihrem ART liegt
   * kein offenes, nicht eingeordnetes Issue, deshalb erfüllt ihr letztes
   * abgeschlossenes PI alle vier Bedingungen des Abschluss-Tors. Die große
   * Kadenz verfehlt es absichtlich.
   */
  const piBSpecs = Array.from({ length: 4 }, (_, k) => {
    const key = `pib${k + 1}`;
    piIds[key] = uid(`large:pi:${key}`);
    const start = addDays(piBase, (k - 2) * 70 + 14);
    const status = k < 2 ? "completed" : k === 2 ? "active" : "planned";
    return { key, name: `Werk-PI ${k + 1}`, start, status };
  });
  await prisma.programIncrement.createMany({
    data: piBSpecs.map((p, i) => ({
      id: piIds[p.key]!,
      tenantId,
      timelineId: timelineBId,
      name: p.name,
      startDate: p.start,
      endDate: addDays(p.start, 69),
      status: p.status,
      capacityJobSize: 70 + i * 3,
      capacityAmount: 110_000 + i * 6_000,
      ...(p.status === "completed"
        ? {
            systemDemoAt: addDays(p.start, 68),
            inspectAdaptAt: addDays(p.start, 69),
            retrospectiveAt: addDays(p.start, 69),
            retrospectiveNotes:
              "Der Takt am Werk passt jetzt zu den Stillstandsfenstern. " +
              "Offen: die Energiedaten kommen weiter mit einem Tag Verzug.",
          }
        : {}),
    })),
  });
  /**
   * Was eine Budget-Revision von einem PI wissen muss. Das Halbjahr einer
   * Feature-Last kommt allein aus `PI.startDate` — ohne diese Tabelle koennte
   * der Snapshot die Features nicht einordnen, die er einfriert.
   */
  const piById = new Map<string, SeedPiMeta>(
    [...piSpecs, ...piBSpecs].map((p) => [
      piIds[p.key]!,
      { name: p.name, startDate: p.start, endDate: addDays(p.start, 69) },
    ]),
  );
  const artNameById = new Map<string, string>(artIds.map((id, i) => [id, artNames[i]!]));

  const activePi = piIds["pi9"]!;
  const prevPi = piIds["pi8"]!;
  const planPi = piIds["pi10"]!;
  const oldPi = piIds["pi2"]!;
  /** Dieselben vier Rollen auf der Werks-Kadenz. */
  const activePiB = piIds["pib3"]!;
  const prevPiB = piIds["pib2"]!;
  const planPiB = piIds["pib4"]!;
  const oldPiB = piIds["pib1"]!;

  // ── Phase 4: Solutions (je Wertstrom, mit Horizont) + Gate-Regeln ─────────
  //
  // **Zwei Horizonte, nicht drei.** In H3 gibt es keine Solution: dort wird
  // geforscht, und ob daraus je ein Produkt wird, ist offen (ADR-0020). Die
  // R&D-Vorhaben dieses Mandanten tragen ihren Horizont deshalb selbst.
  const SOLUTION_HORIZONS = ["h1", "h2"] as const;
  const solId = (vs: number, h: string) => uid(`large:sol:${vs}:${h}`);
  const solNameSuffix: Record<string, string> = { h1: "Betrieb", h2: "Programm" };
  /**
   * Der **Produkt-Manager** je Solution (siehe
   * `docs/concepts/structure-walkthrough.md`): freies Personenfeld, mit
   * Bearbeitungsrecht und einem Sitz in den Reifegrad-Freigaben.
   *
   * **Ein Wertstrom lässt seine Programm-Solution unbesetzt** — der Fall, an
   * dem sich zeigt, dass ein nicht benannter Platzhalter still wegfällt. Bis
   * ADR-0020 trugen diesen Beleg die drei H3-Piloten; die gibt es nicht mehr.
   */
  const solutionPm: Record<string, string | null> = {
    "0:h1": U.fo,
    "0:h2": U.owner,
    "1:h1": U.vso,
    "1:h2": null,
    "2:h1": U.owner,
    "2:h2": U.fo,
  };
  const solutionRows: Prisma.SolutionCreateManyInput[] = [];
  for (let vs = 0; vs < vsIds.length; vs++) {
    for (const h of SOLUTION_HORIZONS) {
      solutionRows.push({
        id: solId(vs, h),
        tenantId,
        valueStreamId: vsIds[vs]!,
        // **Jede Solution trägt ein ART** (Pflichtspalte seit 2026-09-19). Hier
        // stand `h === "h1" ? … : null`, weil ADR-0020 den Lebenszyklus in H2
        // beginnen lässt und ein ART dort noch unsicher ist. Das bleibt wahr —
        // die Angabe ist in H2 eine **Absicht**, keine Zusage. Der erste ART des
        // Stroms ist die naheliegende: er trägt auch dessen H1-Solution.
        artId: artIds[vs * 2]!,
        name: `${vsNames[vs]} ${solNameSuffix[h]}`,
        horizon: h,
        productManagerId: solutionPm[`${vs}:${h}`] ?? null,
        investmentMode: h === "h1" ? "extracting" : null,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    }
  }
  await prisma.solution.createMany({ data: solutionRows });

  // Abnehmer je Reifegrad-Wechsel. Die `toGate`-Werte sind **GateSteps**, keine
  // Haupt-Gates: der Lookup vergleicht gegen `L3.1`/`L3.2`/`L4.2`, eine Zeile
  // `"L3"` traefe nie und fiele still auf den Code-Default zurueck.
  await prisma.stageGateApproverRule.createMany({
    data: gateRuleRows(null).map((r) => ({
      tenantId,
      valueStreamId: null,
      toGate: r.toGate,
      required: r.required,
      quorum: r.quorum,
      approverUserIds: r.approverUserIds,
      approverRoles: r.approverRoles,
      updatedBy: ADMIN,
    })),
  });

  // ── Phase 5: 200 Epics — Reifegrad + Zeit + Budget aus der Verfügbarkeit ──
  console.log("\n── Delivery (Epics + KPIs + Features aus dem Durchlauf)");

  // Der Reifegrad ist in diesem Mandanten **Ergebnis**, nicht Vorgabe: er
  // entsteht daraus, wie viele Runden ein Epic durchlaufen hat und ob es
  // finanziert wurde. Der frühere `gateFunnel` — eine feste Verteilung, aus der
  // rückwärts Zyklus und Datum folgten — ist damit entfallen.

  const gateStatus: Record<string, string> = {
    L0: "draft",
    L1: "draft",
    L2: "approved",
    L3: "approved",
    L4: "in_progress",
    L5: "completed",
  };
  const savingsFraction: Record<string, number> = {
    L5: 0.95,
    L4: 0.6,
    L3: 0.35,
    L2: 0.1,
    L1: 0.04,
    L0: 0.02,
  };

  const LEVERS: string[][] = [
    [
      "Prozessautomatisierung (RPA)",
      "Shared Service Center",
      "Lizenz- & IT-Konsolidierung",
      "Indirekten Einkauf bündeln",
      "Flächen- & Standort-Reduktion",
      "Reise- & Spesen-Governance",
      "Rechnungsworkflow digitalisieren",
      "Reporting-Automatisierung",
      "Vertragsmanagement zentralisieren",
      "Cloud-Kosten-Optimierung (FinOps)",
      "Org-Straffung Verwaltung",
      "Dokumenten-/Archiv-Digitalisierung",
    ],
    [
      "Frachtkosten-Ausschreibung",
      "Transportnetz-Optimierung",
      "Lager-Konsolidierung",
      "Bestandsreduktion (Sicherheitsbestände)",
      "Verpackungsoptimierung",
      "Retouren- & Schwund-Reduktion",
      "Ladungsträger-Pooling",
      "Transport-Management-System (TMS)",
      "Routenoptimierung",
      "Cross-Docking",
      "Anlieferkonzepte (JIT/JIS)",
      "Zoll- & Trade-Kosten senken",
    ],
    [
      "OEE-Steigerung",
      "Ausschuss-/Scrap-Reduktion",
      "Energiekosten-Senkung",
      "Rüstzeit-Reduktion (SMED)",
      "Predictive Maintenance",
      "Materialkosten-Verhandlung",
      "Layout-/Linien-Optimierung",
      "Yield-Verbesserung",
      "Instandhaltungskosten senken",
      "Automatisierung / Cobots",
      "Werksverbund-Konsolidierung",
      "Lean-/Kaizen-Programm",
    ],
  ];
  const EPIC_TYPES = ["epic", "epic", "enabler", "epic", "enabler", "epic", "epic", "enabler"];
  /**
   * Der Horizont eines **Epics** — vier Werte, H3 eingeschlossen. Nur jedes
   * dritte Vorhaben ist Discovery, und genau diese haben **keine Solution**:
   * ihr Horizont steht am Epic selbst, wie es `epic-horizon.ts` vorsieht
   * („explizit schlägt abgeleitet").
   */
  const HORIZONS = ["h2", "h1", "h3"];
  const isResearch = (h: string): boolean => h === "h3";
  /**
   * Das Portfolio-Limit je Wertstrom. **Eine** Quelle: `seedValueStreamGuardrails`
   * am Ende schreibt genau diese Werte, und die Einordnung hier rechnet gegen
   * sie. Liefen die beiden auseinander, zeigte der Mandant Klassen, die die App
   * nie berechnen würde.
   */
  const PORTFOLIO_THRESHOLD = [0, 1, 2].map((k) => 60_000 + k * 10_000);
  const VS_WEIGHTS = [2, 2, 2, 1, 1, 0]; // Produktion (2) größter Block, dann Logistik (1), Verwaltung (0)
  const SAVINGS_BASE = [100_000, 180_000, 300_000];
  const owners = [U.owner, U.portfolio, U.vso, U.vmo, U.rte, U.fo];

  // ── Der Weg jedes Epics ───────────────────────────────────────────────
  //
  // Der Reifegrad entsteht aus Anträgen und Abnahmen, nicht aus gesetzten
  // Spalten (docs/concepts/epic-lifecycle-walkthrough.md). `buildGateHistory`
  // leitet Spalten, Anträge und Abnahmen aus dem beschriebenen Weg ab — mit
  // derselben Domänenlogik, die die App benutzt.

  const gateRules = gateRuleRows(null);
  const gateTransitionRows: GateTransitionRow[] = [];
  const gateApprovalRows: GateApprovalRow[] = [];

  // ── Der Durchlauf ────────────────────────────────────────────────────────
  //
  // Hier kippt die Richtung. Der Motor spielt Halbjahr für Halbjahr durch, was
  // die Anleitungen beschreiben, und liefert je Epic seinen Weg und je Runde
  // ihre Entscheidungen. Alles Weitere — Titel, Solutions, KPIs, Features —
  // hängt sich daran, statt es zu bestimmen.
  const roundPlan = buildRoundPlan({
    cycles: ALL_CYCLES,
    currentIdx: CURRENT_IDX,
    now,
    cycleStart,
    thresholds: PORTFOLIO_THRESHOLD,
    artsPerVs: 2,
    cyclePool: CYCLE_POOL,
    // Betrieb und ART-Rahmen wachsen mit dem Programm — sie zehren Halbjahr um
    // Halbjahr mehr vom Topf, und genau das macht den Engpass sichtbar.
    rtbCycleCost: (c) => RUN_COST(c) + artIds.length * ART_FRAME(c),
    artFrame: (_art, c) => ART_FRAME(c),
    intakePerCycle: INTAKE_PER_CYCLE,
    valueStreamOf: (i) => VS_WEIGHTS[i % VS_WEIGHTS.length]!,
  });
  const EPIC_COUNT = roundPlan.epics.length;
  console.log(`  ↳ ${EPIC_COUNT} Epics aus ${roundPlan.rounds.length} gespielten Runden`);

  const epicIds = Array.from({ length: EPIC_COUNT }, (_, i) => uid(`large:epic:${i}`));
  const epicVs = roundPlan.epics.map((e) => e.vs);
  /**
   * **Der ART eines Epics — eine Regel, eine Schreibweise.**
   *
   * Sie stand fuenfmal in dieser Datei, in zwei Fassungen: `i % 2` an Epic,
   * Feature und Issue, `artInVs % 2` an Kandidat und ART-Zuteilung. Beide
   * ergaben dasselbe, solange ein Wertstrom genau zwei Trains hat — aber die
   * eine entschied, wo das **Budget** landet, und die andere, wo der
   * **Bedarf** landet. Genau diese beiden Zeilen stellt die Budget-Revision
   * untereinander; sie duerfen nicht aus zwei Regeln stammen.
   *
   * Massgeblich ist `artInVs`: damit rechnet der Durchlauf die ART-Rahmen
   * (`frameKey(e.vs, e.artInVs)` in `seed-large-rounds.ts`).
   */
  const artIdxOfEpic = (i: number): number => epicVs[i]! * 2 + (roundPlan.epics[i]!.artInVs % 2);
  const artOfEpic = (i: number): string => artIds[artIdxOfEpic(i)]!;

  /**
   * **Die gewaehrten Raten eines Epics je Halbjahr.**
   *
   * `BudgetAllocation.allocations` ist genau diese Karte — ein Epic in Umsetzung
   * bekommt in jeder Runde seine naechste Rate, und sie laufen auf. Der
   * eingefrorene Beleg schrieb hier bis zuletzt **einen einzigen** Schluessel,
   * den des erfassten Zyklus; in der Revisionssicht stand deshalb in jeder
   * Spalte davor 0 €, obwohl in der Tabelle daneben echtes Geld lag.
   *
   * `upToCycle` schneidet auf den Erfassungszeitpunkt: die Raten spaeterer
   * Runden waren damals noch nicht entschieden.
   */
  const allocationsOfEpic = (i: number, upToCycle?: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const t of roundPlan.epics[i]!.tranches) {
      if (upToCycle !== undefined && compareCycles(t.cycleKey, upToCycle) > 0) continue;
      out[t.cycleKey] = (out[t.cycleKey] ?? 0) + t.amount;
    }
    return out;
  };
  /** Das Haupt-Gate je Epic — abgeleitet aus dem Schritt, auf dem es steht. */
  const gates = roundPlan.epics.map((e) => gateOfStep(e.finalStep));

  // ── Rollout-Bögen ────────────────────────────────────────────────────────
  /**
   * Ein Kostenhebel wird nicht einmal gezogen, sondern **ausgerollt**: erst ein
   * Pilot, dann der Rollout am nächsten Standort, dann die Konzern-Skalierung,
   * zuletzt die Verstetigung. Jede Stufe setzt die vorige voraus.
   *
   * Vorher wurden die Bögen aus den Reifegrad-Bändern gezogen — die Kette lief
   * von reif nach unreif, weil das Band am Reifegrad hing. Jetzt läuft sie in
   * der **Zeit**: die nächste Stufe ist ein Epic, das später geboren wurde.
   * Damit stimmt die Abhängigkeit auch dann, wenn eine Stufe in ihrer Runde kein
   * Geld bekommen hat und zurückgefallen ist.
   */
  const STAGES = ["Pilot", "Rollout", "Skalierung", "Verstetigung"] as const;
  const SITES = ["Werk Nord", "Werk Süd", "Region West", "Region Ost", "Standort A", "Zentrale"];
  const epicTitles: string[] = [];
  /** Der Vorgänger je Epic (Index) — daraus entstehen die Abhängigkeiten. */
  const epicPredecessor: (number | null)[] = new Array(EPIC_COUNT).fill(null);
  {
    for (let vs = 0; vs < vsIds.length; vs++) {
      const levers = LEVERS[vs]!;
      // Nach Geburtsjahrgang: der Pilot zuerst, die Skalierung Runden später.
      const mine = roundPlan.epics
        .filter((e) => e.vs === vs)
        .sort((a, b) => a.bornCycle - b.bornCycle || a.idx - b.idx)
        .map((e) => e.idx);
      let arcNo = 0;
      for (let k = 0; k < mine.length; ) {
        const len = Math.min(2 + (arcNo % 3), mine.length - k);
        const chain = mine.slice(k, k + len);
        const lever = levers[arcNo % levers.length]!;
        const siteA = SITES[arcNo % SITES.length]!;
        const siteB = SITES[(arcNo + 1) % SITES.length]!;
        const stageLabel = [
          `${STAGES[0]} ${siteA}`,
          `${STAGES[1]} ${siteB}`,
          `${STAGES[2]} Konzern`,
          `${STAGES[3]} & Controlling`,
        ];
        chain.forEach((idx, n) => {
          epicTitles[idx] = `${lever} — ${stageLabel[Math.min(n, 3)]!}`;
          if (n > 0) epicPredecessor[idx] = chain[n - 1]!;
        });
        k += len;
        arcNo++;
      }
    }
  }

  const epicOwner: (string | null)[] = [];
  const epicCycleIdx: number[] = [];
  /** L4.1-Datum je Epic — Anker der KPI-Erfassung. */
  const epicImplStart: (Date | null)[] = [];
  /** L4.2-Datum je Epic — dort friert die Menge, dort endet die Messreihe. */
  const epicImplDone: (Date | null)[] = [];
  const epicRows: Prisma.InitiativeCreateManyInput[] = [];
  /** Die Primär-Solution je Epic — `null` bei R&D. Eine Quelle für Zeile und Join. */
  const epicSolutionOf: (string | null)[] = new Array(EPIC_COUNT).fill(null);

  for (let i = 0; i < EPIC_COUNT; i++) {
    const pe = roundPlan.epics[i]!;
    const gate = gates[i]!;
    const vs = pe.vs;
    const title = epicTitles[i]!;
    const epicType = EPIC_TYPES[i % EPIC_TYPES.length]!;
    const horizon = HORIZONS[i % HORIZONS.length]!;
    // **Die eine Quelle.** Vorher rechneten die Epic-Zeile und der Join-Satz
    // dasselbe Modulo getrennt nach — zwei Quellen einer Wahrheit.
    const solutionOfEpic = isResearch(horizon) ? null : solId(vs, horizon);
    epicSolutionOf[i] = solutionOfEpic;
    const status = gateStatus[gate]!;
    const target = pe.finalStep;
    const overridden = pe.overridden && pe.epicClass === "portfolio";
    const intendedClass = pe.intendedClass;
    const epicClass = pe.epicClass;

    // Der Zyklus, in dem das Geld zuerst floss — für Snapshots und Reports.
    const firstTranche = pe.tranches[0];
    const idx = firstTranche ? firstTranche.cycleIdx : Math.min(pe.bornCycle, MAX_IDX);
    epicCycleIdx[i] = idx;

    const owned = pe.ownerSlot != null;
    const ownerId = owned ? owners[pe.ownerSlot! % owners.length]! : null;
    epicOwner[i] = ownerId;
    // Was dieses Epic auf seinem Schritt tragen darf — eine Quelle statt der
    // frueheren Ad-hoc-Schwelle `["L2","L3","L4","L5"].includes(gate)`.
    const allow = contentForGate(target);
    // Das Umsetzungsfenster: geplant aus den Kostenscheiben, tatsächlich aus
    // den Stempeln, die die Faltung setzt.
    const plannedStart = pe.implStart ?? addDays(cycleStart(ALL_CYCLES[idx]!), 20);
    const plannedEnd = pe.implDone ?? addDays(plannedStart, 150 + (i % 4) * 40);

    const benefitHypothesis = allow.benefitHypothesis
      ? {
          measuresHypothesis: `„${title}" senkt die Kosten in ${vsNames[vs]} nachhaltig.`,
          changeFromBaseline: "Dauerhaft geringere Kosten gegenüber dem heutigen Kostenniveau.",
          businessOutcomes: ["Geringere Kosten", "Höhere Effizienz", "Schlankere Prozesse"],
          leadingIndicators: ["Kosten je Einheit", "Prozesskosten", "Durchlaufzeit"],
          risks: ["Umsetzungsaufwand", "Change-/Mitbestimmungsthemen"],
        }
      : null;
    /**
     * **Der Business Case kommt aus dem Durchlauf**, nicht aus einer Formel.
     * Seine Kostenscheiben sind der Finanzierungsplan: eine je Halbjahr, und die
     * Summe ist derselbe Richtwert, gegen den `classifyEpic` die Klasse
     * entschieden und die Kachel den Endbetrag gesetzt hat.
     */
    const businessCase =
      pe.costSlices.length > 0
        ? {
            costSlices: pe.costSlices,
            assumptions:
              "Investition zur Realisierung nachhaltiger Einsparungen (Amortisation < 2 Jahre).",
          }
        : null;

    // Die unbequemen Zustände über den Mandanten streuen — sonst zeigt der
    // Mandant ausschließlich glatte Pfade. Sie hängen sich **hinter** den
    // gespielten Weg in die letzten Wochen.
    const extras: GateMove[] = [];
    const lastMove = pe.moves[pe.moves.length - 1];
    const after = (d: number): Date =>
      new Date(
        Math.max(
          addDays(realNow, d).getTime(),
          lastMove ? moveAt(lastMove).getTime() + 2 * DAY : 0,
        ),
      );
    const nextStep = nextGateStep(target);
    if (nextStep && owned) {
      if (i % 6 === 0) {
        // Offener Antrag. Jeder dritte liegt lange genug, um in Guardrail 4 als
        // überfällig zu zählen.
        const overdue = i % 18 === 0;
        extras.push({
          kind: "open",
          to: nextStep,
          requestedAt: after(overdue ? -30 - (i % 7) : -6 - (i % 4)),
          decidedRoles: ["epic.party.mgmt", "epic.party.finance"],
          decidedAt: after(overdue ? -24 : -3),
        });
      } else if (i % 7 === 3) {
        extras.push({
          kind: "rejected",
          to: nextStep,
          requestedAt: after(-38),
          decidedAt: after(-34),
          reason: "Die Einsparung ist nicht belegt — bitte mit Ist-Zahlen erneut vorlegen.",
        });
      } else if (i % 11 === 5) {
        extras.push({
          kind: "withdrawn",
          to: nextStep,
          requestedAt: after(-42),
          decidedAt: after(-40),
        });
      }
    } else if (owned && target !== "L0" && i % 13 === 4) {
      // Einmal zurückgestuft und erneut abgenommen — das Epic zeigt den Diff.
      const back = previousGateStep(target);
      if (back) {
        extras.push(
          {
            kind: "revert",
            to: back,
            at: after(-40),
            reason: "Nutzenrechnung hält der Prüfung nicht stand.",
          },
          {
            kind: "advance",
            to: target,
            requestedAt: after(-30),
            decidedAt: after(-24),
          },
        );
      }
    }

    const history = buildGateHistory({
      tenantId,
      epicId: epicIds[i]!,
      makeId: (sfx) => uid(`large:gate:${i}:${sfx}`),
      requestedBy: ownerId ?? U.owner,
      createdBy: ADMIN,
      ownerId,
      valueStreamId: vsIds[vs]!,
      valueStreamVmoId: U.vmo,
      valueStreamFinanceApproverId: U.fo,
      rules: gateRules,
      // MGMT und IRT-Owner haben keine Wertstrom-Spalte; jeder dritte Antrag
      // geht ohne Business Owner raus, damit Guardrail 4 keine triviale
      // 100-%-Abdeckung zeigt.
      parties: {
        mgmt: U.portfolio,
        businessOwner: i % 3 === 2 ? null : U.vso,
        irtOwner: U.rte,
      },
      // Der sechste Sitz an L3.1 und der zweite an L4 — nur auflösbar, wenn es
      // eine Primär-Solution gibt **und** sie einen Produkt-Manager trägt, an L4
      // nur bei ART-Epics. Ein R&D-Vorhaben hat keine: der Sitz fällt weg.
      solutionProductManagerId: solutionOfEpic ? (solutionPm[`${vs}:${horizon}`] ?? null) : null,
      epicClass,
      // Woher der Horizont kommt: aus der Solution — oder, wenn es keine gibt,
      // vom Epic selbst. L3.1 friert den auflösten Wert ein.
      solutionHorizon: solutionOfEpic ? (horizon as Horizon) : null,
      investmentHorizon: solutionOfEpic ? null : (horizon as Horizon),
      benefitHypothesis,
      businessCase,
      timeline: {
        estimates: {
          implementation_started: plannedStart.toISOString().slice(0, 10),
          implementation: plannedEnd.toISOString().slice(0, 10),
        },
        actuals: {},
      },
      childFeatureStats: { total: 2, started: 2, completed: 2 },
      budgetAllocationSum: ["L3", "L4", "L5"].includes(gate) ? 120_000 : 0,
      // **Der gespielte Weg.** Jeder `advance` trägt das Datum der Runde, in der
      // er beschlossen wurde — nicht einen Anker, der rückwärts aus dem
      // Reifegrad gerechnet wurde.
      moves: [...pe.moves, ...extras],
    });
    assertGateHistory(history, `#${i} ${title}`);
    gateTransitionRows.push(...history.transitions);
    gateApprovalRows.push(...history.approvals);

    // Umsetzungsstart (L4.1): derselbe Wert für Spalte und KPI-Messbeginn.
    const implStartedAt = history.stamps.implementationStartedAt ?? null;
    epicImplStart[i] = implStartedAt;
    epicImplDone[i] = history.stamps.implementationCompletedAt ?? null;

    epicRows.push({
      id: epicIds[i]!,
      tenantId,
      level: 0,
      path: epicIds[i]!,
      title,
      description:
        epicPredecessor[i] != null
          ? `Baut auf „${epicTitles[epicPredecessor[i]!]!}" auf. Restrukturierungs-Initiative zur Kostensenkung im Workstream ${vsNames[vs]}.`
          : `Restrukturierungs-Initiative zur Kostensenkung im Workstream ${vsNames[vs]}.`,
      ownerId,
      assigneeIds: i % 2 === 0 && owned ? [U.owner] : [],
      valueStreamId: vsIds[vs]!,
      artId: artOfEpic(i),
      // Alle Reifegrad-Spalten stammen aus der Faltung — `stageGate`, die
      // Freigabe-Stempel, die Baselines und das Timeline-Ist-Datum.
      ...history.stamps,
      status,
      // Epic oder Enabler ist eine Einordnung, die das Anlege-Formular nicht
      // kennt — sie entsteht beim Ausarbeiten des Business Case.
      ...(allow.epicType ? { epicType } : {}),
      primarySolutionId: solutionOfEpic,
      /**
       * **Der Horizont steht am Epic, wenn keine Solution ihn tragen kann.**
       * In H3 gibt es keine Solution (ADR-0020) — das Vorhaben trägt seinen
       * Horizont selbst, und `stampsForAdvance` friert genau diesen Wert bei
       * L3.1 ein, statt ihn zu überschreiben.
       */
      ...(solutionOfEpic ? {} : { investmentHorizon: horizon }),
      // Wie im Demo-Mandanten: der Merker aus der Faltung wird ueberschrieben,
      // weil das Steering ihn im Betrieb abhakt. Uebrig bleiben die offenen.
      // Nur fuer Epics, die ueberhaupt einen Zug hinter sich haben: den Merker
      // setzt `stampsForAdvance` bei →L1 und →L3.1, im Funnel gibt es ihn nicht.
      needsSteeringAttention: target !== "L0" && i % 13 === 0,
      // Womit beim Anlegen gerechnet wurde. Weicht die abgeleitete Klasse ab,
      // meldet Pulse das vor dem L3.1-Antrag.
      intendedClass,
      ...(overridden
        ? {
            portfolioOverrideAt: beforeNow(addDays(plannedStart, 30), 20),
            portfolioOverrideBy: U.portfolio,
            portfolioOverrideReason:
              "Greift über mehrere ARTs und die Konzern-Berichtslinie — trotz kleiner Kosten eine Portfolio-Entscheidung.",
          }
        : {}),
      /**
       * **Der Merker ist die Anmeldung, nicht die Aufnahme.** Vorgemerkt ist,
       * wer einen freigegebenen Business Case hat und noch auf Geld wartet —
       * genau die Menge, die die Kandidatenliste der nächsten Runde anbietet.
       * Wer schon finanziert ist, hat den Haken nicht mehr nötig.
       */
      stagedForBudgeting: target === "L3.1" && pe.tranches.length === 0,
      // „I need help" nur dort, wo es weh tut: definiert, aber noch nicht in
      // der Umsetzung.
      ...(owned && allow.helpRequested && !["L4", "L5"].includes(gate) && i % 15 === 0
        ? { helpRequestedAt: addDays(now, -3 - (i % 5)), helpRequestedBy: ownerId ?? U.owner }
        : {}),
      costToMvp: allow.costToMvp ? 40_000 + (i % 30) * 2_000 : null,
      // Das Fenster leitet sich aus den Timeline-Schaetzungen ab — es kann
      // deshalb nicht frueher dastehen als die Timeline selbst.
      ...(allow.timeline ? { plannedStartAt: plannedStart, plannedEndAt: plannedEnd } : {}),
      // L0 = Funnel-Eintritt. Das Datum kommt aus der Runde, in der die Idee
      // eingereicht wurde, und liegt damit von selbst vor dem ersten Antrag.
      createdAt: pe.createdAt,
      ...(gate === "L5" ? { completedAt: history.stamps.impactRecognizedAt ?? plannedEnd } : {}),
      ...(benefitHypothesis ? { benefitHypothesis } : {}),
      ...(businessCase ? { businessCase } : {}),
      createdBy: ADMIN,
      updatedBy: ADMIN,
    });
  }
  await createManyChunked(epicRows, (data) => prisma.initiative.createMany({ data }));

  /**
   * Die Kanten der Rollout-Bögen. Eine Stufe **hängt** an ihrer Vorgängerin:
   * ohne den Piloten kein Rollout, ohne den Rollout keine Skalierung. Damit ist
   * im Produkt sichtbar, was die Titel nur behaupten.
   */
  const arcDepRows: Prisma.DependencyCreateManyInput[] = [];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const pred = epicPredecessor[i];
    if (pred == null) continue;
    // Eine Kante braucht zwei Endpunkte, die es fachlich schon gibt. Vorher
    // hingen auch Funnel-Ideen im Rollout-Bogen — eine Abhaengigkeit zwischen
    // zwei Vermutungen.
    if (!contentForGate(roundPlan.epics[i]!.finalStep).epicDependency) continue;
    if (!contentForGate(roundPlan.epics[pred]!.finalStep).epicDependency) continue;
    arcDepRows.push({
      id: uid(`large:dep:${i}`),
      tenantId,
      fromId: epicIds[i]!,
      toId: epicIds[pred]!,
      type: "depends_on",
      createdBy: ADMIN,
    });
  }
  await createManyChunked(arcDepRows, (data) =>
    prisma.dependency.createMany({ data, skipDuplicates: true }),
  );

  // Der Join-Satz — nur für Epics, die überhaupt eine Solution haben.
  const linkedEpics = epicIds
    .map((epicId, i) => ({ epicId, solutionId: epicSolutionOf[i] }))
    .filter((r): r is { epicId: string; solutionId: string } => r.solutionId != null);
  await prisma.epicSolution.createMany({
    data: linkedEpics.map((r) => ({
      tenantId,
      epicId: r.epicId,
      solutionId: r.solutionId,
      createdBy: ADMIN,
    })),
  });

  /**
   * **Szenario-Invariante, in beide Richtungen.**
   *
   * Bis ADR-0020 hiess sie „JEDES Epic hängt an einer Solution". Das ist nicht
   * mehr wahr und soll es nicht sein: ein R&D-Vorhaben hat keine, weil es in H3
   * keine gibt. Die Zusicherung prüft deshalb jetzt beides — wer eine haben
   * muss, hat sie; wer keine haben darf, trägt stattdessen seinen eigenen
   * Horizont.
   */
  const researchCount = roundPlan.epics.filter((_, i) => epicSolutionOf[i] == null).length;
  const withoutSolution = await prisma.initiative.count({
    where: { tenantId, level: 0, primarySolutionId: null },
  });
  const researchWithoutHorizon = await prisma.initiative.count({
    where: { tenantId, level: 0, primarySolutionId: null, investmentHorizon: null },
  });
  const solutionLinks = await prisma.epicSolution.count({ where: { tenantId } });
  if (
    withoutSolution !== researchCount ||
    researchWithoutHorizon > 0 ||
    solutionLinks !== EPIC_COUNT - researchCount
  ) {
    throw new Error(
      `Seed-Invariante verletzt: ${withoutSolution} Epics ohne Primär-Solution ` +
        `(erwartet ${researchCount}), davon ${researchWithoutHorizon} auch ohne eigenen Horizont; ` +
        `${solutionLinks}/${EPIC_COUNT - researchCount} EpicSolution-Verknüpfungen.`,
    );
  }
  console.log(`  ✓ ${researchCount} R&D-Epics ohne Solution, Horizont am Epic`);

  // KPIs: Primär = Kosteneinsparung (€/Jahr, nach Reifegrad realisiert); Sekundär = operativ.
  const OPS = [
    { name: "SG&A-Quote", unit: "%", base: 14, tgt: 9 },
    { name: "Frachtkosten je Sendung", unit: "€", base: 42, tgt: 30 },
    { name: "Ausschussquote", unit: "%", base: 6, tgt: 2 },
  ];
  const epicSavingsKpi: { id: string; target: number }[] = [];
  const kpiRows: Prisma.KpiCreateManyInput[] = [];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    // KPIs tragen den Nutzen des Business Case — vor L2 gibt es nichts zu
    // bewerten. Vorher bekamen 28 von 30 Funnel-Ideen eine KPI-Zeile.
    if (!contentForGate(roundPlan.epics[i]!.finalStep).kpis) continue;
    const vs = epicVs[i]!;
    const savingsTarget = SAVINGS_BASE[vs]! + (i % 40) * 12_000;
    const savId = uid(`large:kpi:${i}:save`);
    // Erfassung beginnt erst mit der Umsetzung (L4.1): die Baseline wird am
    // Umsetzungsstart gemessen (erster Punkt = baseline @ L4.1-Datum). Epics
    // vor L4 tragen noch KEINE Messwerte — baseline/target bleiben Planannahme.
    const implStart = epicImplStart[i] ?? null;
    kpiRows.push({
      id: savId,
      tenantId,
      initiativeId: epicIds[i]!,
      name: "Kosteneinsparung",
      unit: "€",
      baseline: 0,
      target: savingsTarget,
      measurements: implStart
        ? simulateSeries(0, savingsTarget, {
            from: implStart,
            fraction: savingsFraction[gate]!,
            seed: i * 5,
            ...(epicImplDone[i] ? { until: epicImplDone[i]! } : {}),
          })
        : [],
      valuePerUnit: 1,
      benefitKind: "recurring",
      recurringInterval: "yearly",
      calculationNote: "Nachhaltige jährliche Kosteneinsparung aus dieser Initiative.",
      createdBy: ADMIN,
      updatedBy: ADMIN,
    });
    epicSavingsKpi[i] = { id: savId, target: savingsTarget };

    if (i % 2 === 0) {
      const ops = OPS[vs]!;
      kpiRows.push({
        id: uid(`large:kpi:${i}:ops`),
        tenantId,
        initiativeId: epicIds[i]!,
        name: ops.name,
        unit: ops.unit,
        baseline: ops.base,
        target: ops.tgt,
        measurements: implStart
          ? simulateSeries(ops.base, ops.tgt, {
              from: implStart,
              fraction: 0.55,
              seed: i * 9 + 1,
              ...(epicImplDone[i] ? { until: epicImplDone[i]! } : {}),
            })
          : [],
        valuePerUnit: 1_000,
        benefitKind: "one_time",
        recurringInterval: "monthly",
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    }
  }
  await createManyChunked(kpiRows, (data) => prisma.kpi.createMany({ data }));

  /**
   * Features — die **Deliverables** eines Epics.
   *
   * Geschnitten werden sie auf **L2**, nicht erst in der Umsetzung: „Im Reiter
   * _Deliverables_ schneide ich die Endprodukte als Features"
   * (`docs/concepts/epic-lifecycle-walkthrough.md`). Deshalb tragen auch die
   * wartenden und die gerade finanzierten Epics welche — sie stehen auf
   * `approved`: geplant, aber noch nicht angefangen.
   *
   * Der Unterschied zwischen den beiden ist die PI-Zuordnung: was auf L2
   * wartet, hat noch kein PI (das entscheidet die PI-Planung), was auf L3
   * finanziert ist, steht im nächsten.
   */
  const FEATURE_PARTS = [
    "Analyse & Baseline",
    "Prozessdesign",
    "System-/Tool-Anbindung",
    "Pilot",
    "Rollout",
    "Nachhaltigkeit & Controlling",
  ];
  const featureRows: Prisma.InitiativeCreateManyInput[] = [];
  let gf = 0;
  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    if (!contentForGate(roundPlan.epics[i]!.finalStep).features) continue;
    const done = gate === "L5";
    const running = gate === "L4" || gate === "L5";
    // Der ART des Epics — nicht ein rotierender: ein Feature liefert im selben
    // Train wie sein Epic. Daraus folgt auch, an welcher Timeline es hängt.
    const epicArtIdx = artIdxOfEpic(i);
    const onTimelineB = TIMELINE_B_ARTS.has(epicArtIdx);
    const count = 2 + (i % 3);
    const pe = roundPlan.epics[i]!;
    /**
     * **Geschnitten wird im Business Case, nicht am Anlagetag des Mandanten.**
     * Vorher trugen alle Features denselben `createdAt` — den Zeitpunkt des
     * Seed-Laufs —, und damit hatte der grösste Bestand des Datensatzes keine
     * Geschichte. Der Reiter _Deliverables_ füllt sich, während der Business
     * Case entsteht; das ist der Zug nach L2.
     */
    const cutMove = pe.moves.find((m) => m.to === "L2") ?? pe.moves[0];
    const cutAt = cutMove ? moveAt(cutMove) : pe.createdAt;
    // Das Umsetzungsfenster: der L4.1-Stempel, solange es einen gibt.
    const eStart = pe.implStart ?? cycleStart(ALL_CYCLES[epicCycleIdx[i]!]!);
    for (let f = 0; f < count; f++) {
      const fid = uid(`large:feat:${i}:${f}`);
      const bv = 3 + ((i + f) % 8);
      const tc = 2 + ((i * 2 + f) % 7);
      const rr = 1 + ((i + f * 2) % 6);
      const js = 2 + ((i + f) % 9);
      const wsjf = Number((((bv + tc + rr) / js) as number).toFixed(2));
      const status = !running
        ? "approved"
        : done
          ? "completed"
          : (["in_progress", "blocked", "in_progress", "completed"] as const)[gf % 4]!;
      const artId = artIds[epicArtIdx]!;
      // Jede Zuordnung bleibt auf der Timeline ihres ARTs — ein Feature in
      // einem PI der fremden Kadenz wäre ein Termin im falschen Kalender.
      const [tOld, tPrev, tActive, tPlan] = onTimelineB
        ? ([oldPiB, prevPiB, activePiB, planPiB] as const)
        : ([oldPi, prevPi, activePi, planPi] as const);
      const piId = !running
        ? // Auf L2 geschnitten, aber noch nicht eingeplant: genau der Vorrat,
          // über den die PI-Planung entscheidet. Auf L3 ist das Geld da, das
          // nächste PI ist gesetzt.
          gate === "L2"
          ? null
          : tPlan
        : done
          ? gf % 2 === 0
            ? tOld
            : tPrev
          : status === "completed"
            ? tPrev
            : gf % 5 === 0
              ? tPlan
              : tActive;
      const fStart = addDays(eStart, 20 + f * 20);
      featureRows.push({
        id: fid,
        tenantId,
        level: 1,
        parentId: epicIds[i]!,
        path: `${epicIds[i]!}/${fid}`,
        title: `${epicTitles[i]!} — ${FEATURE_PARTS[f % FEATURE_PARTS.length]}`,
        description: `Baustein „${FEATURE_PARTS[f % FEATURE_PARTS.length]}".`,
        ownerId: gf % 2 === 0 ? U.owner : U.fo,
        assigneeIds: [U.owner],
        artId,
        ...(piId ? { piId } : {}),
        wsjfBusinessValue: bv,
        wsjfTimeCriticality: tc,
        wsjfRiskReduction: rr,
        wsjfJobSize: js,
        wsjfComputed: wsjf,
        featureType: EPIC_TYPES[i % EPIC_TYPES.length] === "enabler" ? "enabler" : "feature",
        stageGate: "L3",
        status,
        completedAt: status === "completed" ? beforeNow(addDays(fStart, 60), 2) : null,
        createdAt: beforeNow(addDays(cutAt, 4 + f * 6), 1),
        plannedStartAt: fStart,
        plannedEndAt: addDays(fStart, 60),
        acceptanceCriteria: [
          "Einsparung nachgewiesen und im Controlling verankert",
          "Prozess dokumentiert und übergeben",
        ],
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
      gf++;
    }
  }
  /**
   * **Eigenständige Features** — ART-eigene Arbeit unter keinem
   * Portfolio-Vorhaben (ADR-0023). Drei je ART: laufend mit eigener Solution,
   * geplant ohne, und abgeschlossen.
   *
   * **Die Kadenz ist hier der Fallstrick.** `TIMELINE_B_ARTS` enthält Index 5
   * — „Materials & Energy" —, nicht Index 2 wie im Demo-Seed. Wer die Zeile von
   * dort abschreibt, legt ausgerechnet in diesem ART jedes Beispiel in ein PI
   * der fremden Kadenz.
   *
   * Das Abschlussdatum kommt aus dem **PI**, nicht aus einem Abstand zu
   * `now`: ein erster Versuch mit `now - 430` landete zwölf Tage **nach** dem
   * Ende von PI 2 — ein Feature, das abgeschlossen wurde, nachdem sein PI
   * vorbei war. Beide alten PIs (PI 2 und Werk-PI 1) enden in einem
   * abgeschlossenen Halbjahr; die Beispiele zählen damit in beiden Kadenzen
   * zum €-Satz je Job-Size-Punkt.
   */
  const STANDALONE_SPECS = [
    {
      title: "Rüstzeiten der Nachtschicht halbieren",
      status: "in_progress",
      jobSize: 5,
      withSolution: true,
      done: false,
    },
    {
      title: "Stillstandsgründe einheitlich erfassen",
      status: "approved",
      jobSize: 8,
      withSolution: false,
      done: false,
    },
    {
      title: "Ersatzteil-Mindestbestände automatisch melden",
      status: "completed",
      jobSize: 13,
      withSolution: true,
      done: true,
    },
  ] as const;

  const standaloneRows: Prisma.InitiativeCreateManyInput[] = [];
  artIds.forEach((artId, ai) => {
    const onTimelineB = TIMELINE_B_ARTS.has(ai);
    const laufendesPi = onTimelineB ? activePiB : activePi;
    const altesPi = onTimelineB ? oldPiB : oldPi;
    // Der Abschluss liegt **im Fenster** seines PI — abgeleitet aus dessen
    // Start, nicht aus einem geratenen Abstand zu heute.
    const altesPiStart = (onTimelineB ? piBSpecs[0]! : piSpecs[1]!).start;

    STANDALONE_SPECS.forEach((spec, ti) => {
      const fid = uid(`large:feat:standalone:${ai}:${ti}`);
      standaloneRows.push({
        id: fid,
        tenantId,
        level: 1,
        parentId: null,
        path: fid,
        title: spec.title,
        description:
          "Eigenständiges Feature: vom ART selbst geplant, ohne Portfolio-Vorhaben darüber.",
        ownerId: ti % 2 === 0 ? U.rte : U.fo,
        assigneeIds: [],
        artId,
        piId: spec.done ? altesPi : laufendesPi,
        primarySolutionId: spec.withSolution ? solId(Math.floor(ai / 2), "h1") : null,
        wsjfBusinessValue: 5,
        wsjfTimeCriticality: 3,
        wsjfRiskReduction: 8,
        // Gestreut: die 3 ist der Schnellanlage-Platzhalter und geht als
        // Vorbehalt in den €-Satz ein (`placeholderJobSize`).
        wsjfJobSize: spec.jobSize,
        wsjfComputed: Number((((5 + 3 + 8) / spec.jobSize) as number).toFixed(2)),
        featureType: "enabler",
        stageGate: "L3",
        status: spec.status,
        completedAt: spec.done ? beforeNow(addDays(altesPiStart, 55), 2) : null,
        acceptanceCriteria: ["Messbar besser als vorher", "Vom Team abgenommen"],
        createdBy: ADMIN,
        updatedBy: ADMIN,
      });
    });
  });
  featureRows.push(...standaloneRows);

  await createManyChunked(featureRows, (data) => prisma.initiative.createMany({ data }));
  console.log(
    `  ✓ ${epicIds.length} Epics + ${featureRows.length} Features ` +
      `(davon ${standaloneRows.length} eigenständig) + ${kpiRows.length} KPIs`,
  );

  // ── Phase 6: Issues (vom Epic-Owner beim LBC aufgenommen; Epics L2–L5) ─────
  console.log("\n── Issues");
  const LEVELS = ["very_low", "low", "medium", "high", "very_high"];
  const CAT = ["technical", "business", "schedule", "external"];
  const ROAM = ["open", "owned", "mitigated", "accepted", "resolved"];
  const ISSUE_TOPICS = [
    "Umsetzungsaufwand höher als geschätzt",
    "Abhängigkeit von Altsystem",
    "Change-/Mitbestimmung offen",
    "Datenqualität unklar",
    "Lieferanten-/Vertragsrisiko",
    "Ressourcen-Engpass im Team",
    "Regulatorische Freigabe ausstehend",
    "Einsparung schwer nachweisbar",
  ];
  const issueRows: Prisma.IssueCreateManyInput[] = [];
  const mitigationRows: Prisma.IssueMitigationCreateManyInput[] = [];
  const assessmentRows: Prisma.IssueAssessmentCreateManyInput[] = [];

  /** Das erste Feature je Epic — Aufhänger für die Issues, die am Bauteil hängen. */
  const firstFeatureByEpic = new Map<string, string>();
  for (const f of featureRows) {
    // Eigenständige Features haben kein Epic — ohne diesen Riegel entstünde ein
    // Eintrag unter dem Schlüssel `null`.
    if (f.parentId == null) continue;
    const parent = f.parentId as string;
    if (!firstFeatureByEpic.has(parent)) firstFeatureByEpic.set(parent, f.id as string);
  }

  /**
   * **Drei Kopf-Issues**, eines je Workstream. Sie bündeln, was im Register
   * sonst nebeneinanderläge: „Datenqualität" ist in der Logistik nicht dasselbe
   * Thema wie in der Produktion, aber innerhalb eines Workstreams schon.
   */
  const headIssueIds = vsIds.map((_, k) => uid(`large:issue:head:${k}`));
  const HEAD_TITLES = [
    "Verwaltung: Abhängigkeiten zu Altsystemen",
    "Logistik: Lieferanten- und Vertragslage",
    "Produktion: Anlagenverfügbarkeit und Datenqualität",
  ];
  let issueNo = 0;
  for (let k = 0; k < headIssueIds.length; k++) {
    issueNo += 1;
    issueRows.push({
      id: headIssueIds[k]!,
      tenantId,
      issueNumber: issueNo,
      title: HEAD_TITLES[k]!,
      description: `Sammelthema über die Vorhaben des Workstreams ${vsNames[k]}.`,
      probability: LEVELS[3]!,
      impact: LEVELS[3]!,
      category: "technical",
      reviewStatus: "documented",
      reviewedBy: U.portfolio,
      reviewedAt: addDays(realNow, -120 - k * 10),
      roamStatus: "owned",
      roamRationale: "Der Workstream-Lead führt das Thema; Einzelpunkte hängen darunter.",
      roamedAt: addDays(realNow, -90 - k * 8),
      roamedBy: U.vmo,
      ownerId: U.vso,
      raisedBy: U.rte,
    });
  }

  for (let i = 0; i < EPIC_COUNT; i++) {
    const gate = gates[i]!;
    if (!["L2", "L3", "L4", "L5"].includes(gate)) continue;
    const nIssues = 1 + (i % 3 === 0 ? 1 : 0); // 1–2 Issues je definiertem Epic
    const raisedBy = epicOwner[i] ?? U.rte;
    const artIdx = artIdxOfEpic(i);
    for (let n = 0; n < nIssues; n++) {
      issueNo += 1;
      const issueId = uid(`large:issue:${i}:${n}`);
      const roam = ROAM[(i + n) % ROAM.length]!;
      /**
       * Achse 1 — kommt der Eintrag ins Register? Ein Siebtel wartet noch auf
       * die Prüfung, gut jedes dreizehnte wurde geprüft und abgelehnt. Der Rest
       * ist aufgenommen; das ist auch der Standard beim direkten Anlegen.
       */
      const review =
        i % 7 === 3 && n === 0 ? "suggested" : i % 13 === 5 && n === 0 ? "rejected" : "documented";
      if (review !== "documented") {
        // Kein Vorschlag trägt Exposure, Kategorie oder ART: er ist im System,
        // aber nicht im Register — und blockiert deshalb auch keinen Takt.
        issueRows.push({
          id: issueId,
          tenantId,
          issueNumber: issueNo,
          title: `${ISSUE_TOPICS[(i + n) % ISSUE_TOPICS.length]!} — ${epicTitles[i]!}`,
          description: `Beobachtung aus dem Team zu „${epicTitles[i]!}".`,
          reviewStatus: review,
          roamStatus: "open",
          // Melden darf jede Rolle bis zum Viewer hinunter.
          raisedBy: i % 3 === 0 ? U.viewer : U.fo,
          ...(review === "rejected"
            ? { reviewedBy: U.portfolio, reviewedAt: addDays(realNow, -6 - (i % 9)) }
            : {}),
          initiativeId: epicIds[i]!,
        });
        continue;
      }
      // Ein Issue hängt entweder am Epic oder am konkreten Bauteil.
      const featureId = firstFeatureByEpic.get(epicIds[i]!);
      const linkToFeature = i % 4 === 1 && featureId != null;
      issueRows.push({
        id: issueId,
        tenantId,
        issueNumber: issueNo,
        title: `${ISSUE_TOPICS[(i + n) % ISSUE_TOPICS.length]!} — ${epicTitles[i]!}`,
        description: `Im LBC-Workshop aufgenommenes Issue zu „${epicTitles[i]!}".`,
        probability: LEVELS[(i + n) % LEVELS.length]!,
        impact: LEVELS[(i * 2 + n) % LEVELS.length]!,
        category: CAT[(i + n) % CAT.length]!,
        reviewStatus: "documented",
        reviewedBy: U.portfolio,
        reviewedAt: addDays(realNow, -40 - (i % 20)),
        roamStatus: roam,
        ...(roam !== "open"
          ? {
              roamRationale: "ROAM-Entscheidung im Risk-Review festgehalten.",
              roamedAt: addDays(realNow, -15 - (i % 12)),
              roamedBy: U.vmo,
            }
          : {}),
        ownerId: epicOwner[i] ?? U.rte,
        raisedBy,
        targetResolutionDate: addDays(now, 30 + (i % 6) * 15),
        initiativeId: linkToFeature ? featureId! : epicIds[i]!,
        // Jedes dritte Issue hängt unter dem Kopf seines Workstreams.
        ...(i % 3 === 0 ? { parentId: headIssueIds[epicVs[i]!]! } : {}),
        // Der ART-Bezug bleibt der großen Kadenz vorbehalten: über den ARTs der
        // Werks-Kadenz soll kein offenes Issue liegen, sonst verfehlt auch ihr
        // PI das Abschluss-Tor.
        ...(i % 5 === 0 && !TIMELINE_B_ARTS.has(artIdx) ? { artId: artIds[artIdx]! } : {}),
        // Ein Teil trägt den PI-Kontext, in dem er aufgekommen ist.
        ...(i % 9 === 0 && !TIMELINE_B_ARTS.has(artIdx) ? { piId: activePi } : {}),
      });
      if (i % 4 === 0) {
        mitigationRows.push({
          id: uid(`large:imit:${i}:${n}`),
          tenantId,
          issueId,
          description: "Gegenmaßnahme definiert und dem Owner zugewiesen.",
          createdBy: raisedBy,
        });
      }
      if (i % 6 === 0) {
        assessmentRows.push({
          id: uid(`large:iass:${i}:${n}`),
          tenantId,
          issueId,
          probability: LEVELS[(i + n + 1) % LEVELS.length]!,
          impact: LEVELS[(i + n) % LEVELS.length]!,
          note: "Neubewertung nach Gegenmaßnahmen.",
          createdBy: raisedBy,
        });
      }
    }
  }
  await createManyChunked(issueRows, (data) => prisma.issue.createMany({ data }));
  if (mitigationRows.length) await prisma.issueMitigation.createMany({ data: mitigationRows });
  if (assessmentRows.length) await prisma.issueAssessment.createMany({ data: assessmentRows });
  await prisma.issueSettings.create({
    data: { id: uid("large:issuesettings"), tenantId, prefix: "R-", lastNumber: issueNo },
  });
  const reviewCount = (v: string) => issueRows.filter((r) => r.reviewStatus === v).length;
  console.log(
    `  ✓ ${issueRows.length} Issues (${reviewCount("documented")} dokumentiert, ` +
      `${reviewCount("suggested")} vorgeschlagen, ${reviewCount("rejected")} abgelehnt) ` +
      `unter ${headIssueIds.length} Kopf-Issues`,
  );

  /**
   * System-Demos je abgeschlossenem PI — auf **beiden** Kadenzen. Die Agenda
   * zieht sich aus den Features, die in diesem PI abgeschlossen wurden: die
   * Demo ist die eine Gelegenheit, an der ein Ergebnis nicht als Status,
   * sondern als Sache gezeigt wird.
   */
  const completedPis = [...piSpecs, ...piBSpecs].filter((p) => p.status === "completed");
  const featuresByPi = new Map<string, Prisma.InitiativeCreateManyInput[]>();
  for (const f of featureRows) {
    if (f.piId == null || f.status !== "completed") continue;
    const list = featuresByPi.get(f.piId as string) ?? [];
    list.push(f);
    featuresByPi.set(f.piId as string, list);
  }
  let demoCount = 0;
  for (const p of completedPis) {
    const piId = piIds[p.key]!;
    const items = (featuresByPi.get(piId) ?? []).slice(0, 6);
    if (items.length === 0) continue;
    await prisma.systemDemo.create({
      data: {
        id: uid(`large:demo:${p.key}`),
        tenantId,
        piId,
        scheduledAt: addDays(p.start, 68),
        notes: "Agenda: nachgewiesene Einsparungen je Baustein, gezeigt am laufenden Prozess.",
        createdBy: ADMIN,
        items: {
          create: items.map((f, k) => ({
            id: uid(`large:demoitem:${p.key}:${k}`),
            tenantId,
            featureId: f.id as string,
            title: `Demo: ${f.title as string}`,
            ownerId: (f.ownerId as string | null) ?? U.fo,
            presented: true,
            position: k,
            createdBy: ADMIN,
          })),
        },
      },
    });
    demoCount++;
  }
  console.log(`  ✓ ${demoCount} System-Demos an abgeschlossenen PIs`);

  // ── Phase 7: Budget (nur bezahlte Epics L3–L5, Σ ≤ ~€1 Mio./Zyklus) ───────
  console.log("\n── Budget (Allocations + Historie + Kacheln)");
  // Wer Budget tragen darf, entscheidet die gemeinsame Regel — nicht eine
  // Liste von Reifegraden, die neben ihr veraltet.
  /**
   * **Die Zuteilung ist das Ergebnis der Kachel, nicht ihr Parallelwert.**
   *
   * Vorher entstanden hier eigene Beträge (`80_000 + (i % 6) * 8_000`), während
   * die Kachel unten mit anderen Zahlen rechnete — dasselbe Epic trug zwei
   * verschiedene Summen. Jetzt schreibt beides dieselben Raten: die, die der
   * Durchlauf in seiner Runde beschlossen hat.
   *
   * `BudgetAllocation` ist **eine Zeile je Epic** (`epicId` ist unique); die
   * Halbjahre stehen als Karte darin. Ein Epic in Umsetzung trägt deshalb
   * mehrere Einträge — es bekommt in jeder Runde seine nächste Rate.
   */
  const fundedIdx = roundPlan.epics.filter((e) => e.tranches.length > 0).map((e) => e.idx);
  await createManyChunked(
    fundedIdx.map((i, k) => {
      const allocations = allocationsOfEpic(i);
      return {
        id: uid(`large:balloc:${i}`),
        tenantId,
        epicId: epicIds[i]!,
        priority: k,
        allocations,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      };
    }),
    (data) => prisma.budgetAllocation.createMany({ data }),
  );

  /**
   * Der eingefrorene Stand je Runde. Er zeigt, worüber **in diesem Halbjahr**
   * entschieden wurde — nicht eine Auswahl, die zufällig in den Zyklus fällt.
   *
   * **Der ART-Block wird abgeleitet, nicht gesetzt.** Bis hierher stand dort
   * `features: []` neben einem ART-Budget aus der Formel `130_000 + i * 12_000`
   * — die Bedarfszeile blieb in jeder Revision leer, und die Budgetzeile
   * darüber hatte mit den Kacheln desselben Mandanten nichts zu tun. Beides
   * kommt jetzt aus den Daten, die der Durchlauf ohnehin erzeugt hat.
   */
  const artDefs = artIds.map((id, i) => ({ id, name: artNames[i]! }));
  /** Jeder finale Kachel-Betrag, gebucht auf den ART seines Epics. */
  const artFinals: SeedArtFinal[] = roundPlan.rounds.flatMap((r) =>
    r.candidates.map((c) => ({
      artId: artOfEpic(c.epicIdx),
      cycleKey: r.cycleKey,
      amount: c.final,
    })),
  );
  /** Die Toepfe aller Runden bis einschliesslich `upToCycle`. */
  const poolUpTo = (upToCycle: string): Record<string, number> =>
    Object.fromEntries(
      roundPlan.rounds
        .filter((r) => compareCycles(r.cycleKey, upToCycle) <= 0)
        .map((r) => [r.cycleKey, r.pool]),
    );
  const revisions: BudgetPlanSnapshot[] = [];
  for (const round of roundPlan.rounds) {
    const capturedAt = beforeNow(addDays(cycleStart(round.cycleKey), PHASE.finalize), 1);
    const funded = round.candidates.filter((c) => c.final > 0);
    const { snapshot, payload } = buildSnapshotPayload({
      cycleKey: round.cycleKey,
      capturedAt,
      // Der Topf jeder bis dahin gelaufenen Kachel — `board.pool` summiert live
      // genauso ueber alle Runden. Vorher stand hier ein einziges Halbjahr,
      // waehrend die Kopfkachel „Pool gesamt" ihre Unterzeile aus dem
      // Perioden-Raster zog: eine Zahl fuer ein Halbjahr unter der Ueberschrift
      // „3 Halbjahre".
      pool: poolUpTo(round.cycleKey),
      epics: funded.map((c, k) => ({
        epicId: epicIds[c.epicIdx]!,
        title: epicTitles[c.epicIdx]!,
        valueStreamId: vsIds[epicVs[c.epicIdx]!]!,
        valueStreamName: vsNames[epicVs[c.epicIdx]!]!,
        priority: k,
        allocations: allocationsOfEpic(c.epicIdx, round.cycleKey),
      })),
      // Der Stand **zum Erfassungszeitpunkt**: ein Beleg aus 2024 darf weder
      // ein 2026 angelegtes Feature noch das Budget von 2026 kennen.
      features: snapshotFeatures(featureRows, {
        artNameById,
        piById,
        asOf: capturedAt,
        cycleKey: round.cycleKey,
      }),
      artRows: snapshotArtRows(artDefs, artFinals, round.cycleKey),
    });
    revisions.push(snapshot);
    await prisma.budgetPlanRevision.create({
      data: {
        id: uid(`large:bprev:${round.cycleKey}`),
        tenantId,
        cycleKey: round.cycleKey,
        capturedAt,
        capturedBy: ADMIN,
        payload,
      },
    });
  }
  assertSnapshotLoad(revisions, TENANT_NAME);

  // PB-Kacheln: eine je Halbjahr — closed bis einschließlich des laufenden,
  // running für das nächste, draft für das übernächste.
  const parts = [U.portfolio, U.vmo, U.rte, U.owner, U.vso, U.fo, U.viewer];
  const rtb = await seedRunTheBusiness(
    tenantId,
    ADMIN,
    // Zwei wertstrom-übergreifende Positionen (ohne Solution) plus der Betrieb
    // des H1-Kerns — beide Ausprägungen kommen im Mandanten vor.
    vsIds.map((vsId, k) => ({
      valueStreamId: vsId,
      items: [
        {
          name: "Programm-Office & Controlling",
          plannedAmount: 20_000 + k * 4_000,
          interval: "half_yearly",
        },
        { name: "Externe Beratung", plannedAmount: 30_000 + k * 6_000, interval: "yearly" },
        {
          name: "Betrieb & Support",
          plannedAmount: 100_000 + k * 20_000,
          interval: "yearly",
          solutionId: solId(k, "h1"),
        },
        // Je ART ein ART-Epic-Budget — beide ARTs des Wertstroms, damit die
        // Flächen unter Last mit Daten laufen und nicht nur mit Sonderfällen.
        {
          name: `ART-Epic-Budget ${artNames[k * 2]}`,
          plannedAmount: 120_000 + k * 20_000,
          interval: "half_yearly",
          artId: artIds[k * 2]!,
          kind: "art_change",
        },
        {
          name: `ART-Epic-Budget ${artNames[k * 2 + 1]}`,
          plannedAmount: 80_000 + k * 10_000,
          interval: "half_yearly",
          artId: artIds[k * 2 + 1]!,
          kind: "art_change",
        },
      ],
    })),
  );
  /** Die Positionen, die einen ART-Epic-Rahmen tragen — je ART genau eine. */
  const changeItemIdSet = new Set(
    rtb.filter((it) => it.kind === "art_change" && it.artId != null).map((it) => it.id),
  );
  const rtbCands = rtb.map((r) => ({
    rtbItemId: r.id,
    title: r.name,
    ask: rtbCycleAmount(r.plannedAmount, r.interval),
    valueStreamId: r.valueStreamId,
  }));
  /**
   * **Die Kandidaten der kommenden Runden** sind die, die auf Geld warten:
   * freigegebener Business Case, noch keine Zuteilung. Genau die Menge, die der
   * Merker `stagedForBudgeting` anmeldet — und genau die, die `isPbEligible`
   * durchlässt. ART-Epics stehen nicht darunter; sie ziehen aus dem Rahmen
   * ihres ARTs.
   */
  const waitingIdx = roundPlan.epics
    .filter((e) => e.finalStep === "L3.1" && e.tranches.length === 0)
    .filter((e) => e.epicClass === "portfolio")
    .map((e) => e.idx);
  const candOf = (i: number, ask: number) => ({
    epicId: epicIds[i]!,
    title: epicTitles[i]!,
    ask,
    valueStreamId: vsIds[epicVs[i]!]!,
    artId: artOfEpic(i),
  });
  const backlogCands = waitingIdx.slice(0, 22).map((i) => candOf(i, roundPlan.epics[i]!.cost));
  /**
   * Die Zyklen, in denen ein ART-Epic aus dem Rahmen bedient wurde — Grundlage
   * der `ArtEpicAllocation`-Zeilen weiter unten.
   */
  const artFundedByCycle = new Map<number, number[]>();
  for (const e of roundPlan.epics) {
    for (const t of e.tranches) {
      if (t.source !== "art_epic_budget") continue;
      artFundedByCycle.set(t.cycleIdx, [...(artFundedByCycle.get(t.cycleIdx) ?? []), e.idx]);
    }
  }
  const buildGroups = (
    submitted: boolean[],
    amountsBy: ((gi: number) => Record<string, number>) | null,
  ): GroupSpec[] => [
    {
      name: "Verwaltung & Overhead",
      spokespersonUserId: U.portfolio,
      submitted: submitted[0]!,
      memberUserIds: [U.portfolio, U.owner, U.rte],
      amounts: amountsBy ? amountsBy(0) : {},
    },
    {
      name: "Logistik",
      spokespersonUserId: U.vso,
      submitted: submitted[1]!,
      memberUserIds: [U.vso, U.fo, U.viewer],
      amounts: amountsBy ? amountsBy(1) : {},
    },
    {
      name: "Produktion",
      spokespersonUserId: U.vmo,
      submitted: submitted[2]!,
      memberUserIds: [U.vmo, U.owner, U.fo],
      amounts: amountsBy ? amountsBy(2) : {},
    },
  ];
  const amountsFor = (cands: { epicId: string; ask: number }[]) => (gi: number) => {
    const out: Record<string, number> = {};
    cands.forEach((c, j) => {
      if (j % 3 !== gi % 3) out[c.epicId] = c.ask;
    });
    rtbCands.forEach((c, j) => {
      if (j % 3 !== gi % 3) out[c.rtbItemId] = c.ask;
    });
    return out;
  };
  /**
   * **Eine Kachel je Halbjahr — und ihre Zahlen sind die des Durchlaufs.**
   *
   * Der Betrieb steht zuerst fest, dann wird um den Rest gerungen: genau die
   * Reihenfolge, die der Motor gespielt hat. Die Endbeträge kommen von dort,
   * nicht aus einer zweiten, gierigen Rechnung an dieser Stelle — sonst trügen
   * Kachel und Zuteilung wieder verschiedene Zahlen für dasselbe Epic.
   */
  for (const round of roundPlan.rounds) {
    const cycleKey = round.cycleKey;
    const finalByEpic = new Map(round.candidates.map((c) => [c.epicIdx, c.final]));
    const epicCands = round.candidates.map((c) => candOf(c.epicIdx, c.ask));
    /**
     * **Der Rahmen wird exakt festgeschrieben, der Betrieb anteilig gekürzt.**
     * Der Rahmen ist der Deckel, gegen den der Motor entschieden hat — käme
     * hier eine andere Zahl heraus, wären die ART-Zuteilungen sofort überzogen.
     * Der Betrieb dagegen ist verhandelbar und trägt die Kürzung.
     */
    const runAskSum = rtbCands
      .filter((c) => !changeItemIdSet.has(c.rtbItemId))
      .reduce((sum, c) => sum + c.ask, 0);
    const runBudget = RUN_COST(round.cycleIdx);
    const rtbFinalOf = (c: { rtbItemId: string; ask: number }): number =>
      changeItemIdSet.has(c.rtbItemId)
        ? ART_FRAME(round.cycleIdx)
        : runAskSum === 0
          ? 0
          : Math.round((c.ask / runAskSum) * runBudget);
    await seedBudgetPeriod(tenantId, ADMIN, {
      key: `large-closed-${round.cycleIdx}`,
      cycleKey,
      // Die finalen Beträge entstehen im Übergang `entschieden → abgeschlossen`.
      // Auch das **laufende** Halbjahr ist deshalb abgeschlossen: ohne
      // festgeschriebene `art_change`-Beträge wäre jeder ART-Epic-Budget 0 €,
      // und kein ART könnte verteilen.
      status: "closed",
      poolTotal: round.pool,
      startDate: cycleStart(cycleKey),
      endDate: cycleEnd(cycleKey),
      submissionDeadline: addDays(cycleStart(cycleKey), PHASE.distribute),
      reserveAmount: round.reserve,
      participantUserIds: parts,
      epicCandidates: epicCands.map((cd, k) => ({
        ...cd,
        finalAmount: finalByEpic.get(round.candidates[k]!.epicIdx) ?? 0,
      })),
      rtbCandidates: rtbCands.map((cd) => ({ ...cd, finalAmount: rtbFinalOf(cd) })),
      groups: buildGroups([true, true, true], amountsFor(epicCands)),
    });
  }

  // Die laufende Runde ist die des **nächsten** Halbjahres — man budgetiert H2
  // im Lauf von H1. Hier konkurrieren die wartenden L2-Epics um den Rest.
  const runningCycle = ALL_CYCLES[Math.min(CURRENT_IDX + 1, MAX_IDX)]!;
  await seedBudgetPeriod(tenantId, ADMIN, {
    key: "large-running",
    cycleKey: runningCycle,
    status: "running",
    poolTotal: budgetPoolByPeriod[runningCycle]!,
    startDate: cycleStart(runningCycle),
    endDate: cycleEnd(runningCycle),
    submissionDeadline: addDays(realNow, 40),
    participantUserIds: parts,
    epicCandidates: backlogCands,
    rtbCandidates: rtbCands,
    groups: buildGroups([true, false, false], amountsFor(backlogCands)),
  });

  // Eine Entwurfsrunde für das übernächste Halbjahr.
  const draftCycle = ALL_CYCLES[Math.min(CURRENT_IDX + 2, MAX_IDX)]!;
  await seedBudgetPeriod(tenantId, ADMIN, {
    key: "large-draft",
    cycleKey: draftCycle,
    status: "draft",
    poolTotal: budgetPoolByPeriod[draftCycle]!,
    startDate: cycleStart(draftCycle),
    endDate: cycleEnd(draftCycle),
    submissionDeadline: addDays(cycleStart(draftCycle), 40),
    participantUserIds: parts,
    epicCandidates: backlogCands,
    rtbCandidates: rtbCands,
    groups: buildGroups([false, false, false], null),
  });

  // ── Phase 8: Ziele — Top-Ziel + je Wertstrom aufgebrochen ─────────────────
  console.log("\n── Ziele (Top-Ziel + Wertstrom-Breakdown)");
  const themeAdmin = uid("large:theme:admin");
  const themeLog = uid("large:theme:log");
  const themeProd = uid("large:theme:prod");
  await prisma.strategicTheme.createMany({
    data: [
      {
        id: themeAdmin,
        tenantId,
        title: "Verwaltung & Overhead",
        narrative: "SG&A/Overhead senken: Automatisierung, Shared Services, IT & Einkauf.",
        kind: "business",
        color: "#6366f1",
        budgetPlanned: 500_000,
        ownerId: U.portfolio,
        sortOrder: 0,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeLog,
        tenantId,
        title: "Logistik",
        narrative: "Fracht, Netzwerk, Bestände und Verpackung kostenoptimieren.",
        kind: "business",
        color: "#f59e0b",
        budgetPlanned: 800_000,
        ownerId: U.vso,
        sortOrder: 1,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
      {
        id: themeProd,
        tenantId,
        title: "Produktion",
        narrative: "OEE, Ausschuss, Energie und Materialkosten senken.",
        kind: "enabler",
        color: "#10b981",
        budgetPlanned: 1_200_000,
        ownerId: U.vmo,
        sortOrder: 2,
        createdBy: ADMIN,
        updatedBy: ADMIN,
      },
    ],
  });
  const vsTheme = [themeAdmin, themeLog, themeProd];

  /**
   * Jedes Epic hängt an dem Thema seines Workstreams. Ohne diese Kante wären
   * die drei Themen von keinem Vorhaben aus erreichbar — ein Kopf ohne Körper.
   */
  await createManyChunked(
    epicIds
      // Die Zuordnung zu einem Thema ist eine Einordnung, die das
      // Anlege-Formular nicht kennt. Sie entsteht mit der Analyse (L2) — die
      // Ziel-Verknuepfung dagegen gehoert zu L0 und bleibt fuer alle bestehen.
      .map((epicId, i) => ({ epicId, i }))
      .filter(({ i }) => contentForGate(roundPlan.epics[i]!.finalStep).themeLink)
      .map(({ epicId, i }) => ({
        id: uid(`large:themelink:${i}`),
        tenantId,
        themeId: vsTheme[epicVs[i]!]!,
        epicId,
        createdBy: ADMIN,
      })),
    (data) => prisma.themeEpicLink.createMany({ data, skipDuplicates: true }),
  );

  const roots: Prisma.ObjectiveCreateManyInput[] = [];
  const children: Prisma.ObjectiveCreateManyInput[] = [];
  const objBase = (
    id: string,
    themeId: string,
    title: string,
    extra: Partial<Prisma.ObjectiveCreateManyInput>,
  ): Prisma.ObjectiveCreateManyInput => ({
    id,
    tenantId,
    themeId,
    title,
    path: id,
    createdBy: ADMIN,
    updatedBy: ADMIN,
    ...extra,
  });

  // Top-Ziel (Unternehmensführung) → je Wertstrom aufgebrochen (kpi_tree, aus Epics).
  // Ziel-getriebener Prozess: das Ziel steht zuerst, Epics füllen es — ALLE
  // Epics (auch L0/L1) zählen in die Pipeline; das Ziel liegt mit 15 % Stretch
  // darüber, damit der Benefit-Wasserfall eine sichtbare Deckungslücke behält.
  const GOAL_STRETCH = 1.15;
  const gVs = [uid("large:goal:vs0"), uid("large:goal:vs1"), uid("large:goal:vs2")];
  const vsTarget = [0, 0, 0];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const k = epicSavingsKpi[i];
    if (!k) continue;
    vsTarget[epicVs[i]!]! += k.target;
  }
  for (let v = 0; v < vsTarget.length; v++) vsTarget[v] = Math.round(vsTarget[v]! * GOAL_STRETCH);
  const gCost = uid("large:goal:cost-total");
  roots.push(
    objBase(gCost, themeProd, "Gesamt-Kostenreduktion (€ p.a.)", {
      progressMode: "kpi_tree",
      metricType: "currency",
      metricUnit: "€",
      currencyCode: "EUR",
      baseline: 0,
      target: vsTarget[0]! + vsTarget[1]! + vsTarget[2]!,
      status: "on_track",
      period: PROGRAM_TARGET_YEAR,
      ownerId: U.portfolio,
    }),
  );
  const vsNodeTitles = [
    "Verwaltung: Overhead senken (€ p.a.)",
    "Logistik: Logistikkosten senken (€ p.a.)",
    "Produktion: Herstellkosten senken (€ p.a.)",
  ];
  children.push(
    ...gVs.map((id, vs) =>
      objBase(id, vsTheme[vs]!, vsNodeTitles[vs]!, {
        parentObjectiveId: gCost,
        level: 1,
        progressMode: "kpi_tree",
        metricType: "currency",
        metricUnit: "€",
        currencyCode: "EUR",
        baseline: 0,
        target: vsTarget[vs]!,
        parentUnitPerChildUnit: 1,
        status: vs === 2 ? "at_risk" : "on_track",
        ownerId: U.vmo,
      }),
    ),
  );

  // Bewusst KEINE weiteren Ziele: Der Ziele-Baum besteht ausschließlich aus dem
  // Top-Ziel „Gesamt-Kostenreduktion" und den drei Wertstrom-Kindern (kpi_tree
  // aus den Epic-Einsparungs-KPIs) — keine operativen KRs, keine geschlossenen
  // Meilensteine, keine Check-in-Historie.
  await prisma.objective.createMany({ data: roots });
  await prisma.objective.createMany({ data: children });

  /**
   * Epics dem Baum zuordnen — **jedes**, auf allen Gates. Die Verknüpfung
   * gehört zu L0: der Anlege-Dialog setzt sie in einem zweiten Schritt, und ein
   * ziel-getriebener Prozess fängt genau damit an.
   *
   * Die **treibende KPI** gibt es dagegen erst ab L2. Bis dahin steht der Link
   * ohne sie da — `kpiId` ist nullable, und das Schema nennt diesen Fall
   * ausdrücklich. Vorher hing die Verknüpfung an der KPI und fiel mit ihr weg:
   * 128 von 176 statt 176.
   */
  const goalLinkRows: Prisma.GoalEpicLinkCreateManyInput[] = [];
  for (let i = 0; i < EPIC_COUNT; i++) {
    const k = epicSavingsKpi[i];
    goalLinkRows.push({
      id: uid(`large:gel:${i}`),
      tenantId,
      objectiveId: gVs[epicVs[i]!]!,
      epicId: epicIds[i]!,
      ...(k ? { kpiId: k.id, conversionFactor: 1 } : {}),
      impactKind: "recurring",
      recurringInterval: "yearly",
      createdBy: ADMIN,
    });
  }
  await prisma.goalEpicLink.createMany({ data: goalLinkRows });

  // Szenario-Invariante: JEDES Epic hat genau einen Goal-Link.
  const goalLinkCount = await prisma.goalEpicLink.count({ where: { tenantId } });
  if (goalLinkCount !== EPIC_COUNT) {
    throw new Error(`Seed-Invariante verletzt: ${goalLinkCount}/${EPIC_COUNT} Goal-Epic-Links.`);
  }

  // ── Phase 9: Aktivität (Freigaben) + TOM ──────────────────────────────────
  console.log("\n── Freigaben + TOM");
  // Die Reifegrad-Historie aller Epics: eine Antragszeile je gegangenem Schritt
  // plus die Abnahmen, gesammelt in Phase 5. Gebuendelt geschrieben — bei 200
  // Epics sind das einige hundert Zeilen, und Einzel-Inserts wuerden den Seed
  // spuerbar bremsen. Reihenfolge: Antraege vor Abnahmen (Fremdschluessel).
  await createManyChunked(gateTransitionRows, (data) =>
    prisma.stageGateTransition.createMany({ data }),
  );
  await createManyChunked(gateApprovalRows, (data) =>
    prisma.stageGateApproval.createMany({ data }),
  );
  console.log(
    `  ✓ ${gateTransitionRows.length} Reifegrad-Anträge, ${gateApprovalRows.length} Abnahmen`,
  );
  // Invariante: jedes Epic, das L0 verlassen hat, traegt die Antragshistorie,
  // die es dorthin gebracht hat. Genau das war vorher nicht der Fall.
  {
    const moved = epicRows.filter((e) => e.stageGate !== "L0");
    const withHistory = new Set(
      gateTransitionRows.filter((t) => t.status === "approved").map((t) => t.initiativeId),
    );
    const missing = moved.filter((e) => !withHistory.has(e.id as string));
    if (missing.length > 0) {
      throw new Error(
        `Seed-Invariante verletzt: ${missing.length} Epic(s) jenseits von L0 ohne abgenommenen Reifegrad-Wechsel.`,
      );
    }
  }

  await prisma.targetOperatingModel.create({
    data: {
      id: uid("large:tom"),
      tenantId,
      status: "active",
      template: "portfolio_safe",
      targetValueStreams: 3,
      targetArtsTotal: 6,
      targetTeamsTotal: 18,
      targetPiCadenceWeeks: 10,
      targetDate: cycleStart(ALL_CYCLES[MAX_IDX]!),
      // Guardrail 3 an — der Lastdatensatz soll die neuen Flächen mit Masse
      // durchlaufen, nicht mit Sonderfällen.
      artEpics: true,
      createdBy: ADMIN,
      updatedBy: ADMIN,
    },
  });

  // ── Guardrail 3: Rahmen-Verteilung und Ziele je Wertstrom ─────────────────
  //
  // Erzeugt, nicht von Hand gesetzt: der Lastdatensatz braucht Masse in den
  // neuen Tabellen. Klassifiziert wird über den freigegebenen Business Case —
  // deshalb kommen nur Epics infrage, die L3.1 erreicht haben.
  /**
   * **Der zweite Weg zum Geld.** Ein ART-Epic steht nicht auf dem PB-Liste; es
   * wird aus dem ART-Epic-Budget seines ARTs bedient. Der Seed schreibt
   * diese Zuteilungen für **jeden** Zyklus, in dem ein ART-Epic bezahlt wurde,
   * nicht nur für das laufende Halbjahr — sonst stünde in der Vergangenheit
   * eine Budget-Zuteilung ohne jede Herkunft.
   *
   * Welches Epic welche Klasse trägt, entschied bereits `epicClassOf` mit
   * derselben Regel wie `classifyEpic`: Kosten gegen das Portfolio-Limit des
   * Wertstroms, und eine gesetzte Ausnahme hebt auf Portfolio.
   */
  const artFundedIdxAll = [...artFundedByCycle.values()].flat();

  // Die Verteilliste des ARTs zeigt nur **vorgemerkte** Epics. Bei der Anlage
  // war `stagedForBudgeting` an L2 geknüpft (definiert, wartet auf Budget) —
  // ein ART-Epic braucht aber einen freigegebenen Business Case und steht damit
  // frühestens auf L3.1. Die beiden Mengen überschneiden sich nie, die Liste
  // bliebe zwangsläufig leer. Die Vormerkung meldet hier keine Portfolio-Runde
  // an, sondern die Verteilung durch den Wertstrom.
  await prisma.initiative.updateMany({
    where: { tenantId, id: { in: artFundedIdxAll.map((i) => epicIds[i]!) } },
    data: { stagedForBudgeting: true },
  });

  /**
   * **Die ART-Zuteilungen — je Halbjahr gegen den Rahmen *dieses* Halbjahres.**
   *
   * Vorher las dieser Abschnitt die Rahmen **einmal** für den laufenden Zyklus
   * und deckelte damit auch alle vergangenen. Für ein Halbjahr, in dem der
   * Rahmen kleiner war, entstanden so Zuteilungen, die es nie gegeben haben
   * kann; für eines, in dem er größer war, fielen welche weg. Der Rahmen wächst
   * mit dem Programm, also muss ihn jede Runde neu lesen.
   *
   * Die Beträge selbst kommen aus dem Durchlauf: es sind dieselben Raten, die
   * auch in `BudgetAllocation` stehen. Zwei Zeilen, ein Betrag.
   */
  const allocSpecs: ArtAllocationSpec[] = [];
  for (const [c, idxs] of [...artFundedByCycle.entries()].sort((a, b) => a[0] - b[0])) {
    const cycleKey = ALL_CYCLES[c]!;
    const frame = ART_FRAME(c);
    const usedByArt = new Map<string, number>();
    for (const i of idxs) {
      const artId = artOfEpic(i);
      const pe = roundPlan.epics[i]!;
      const amount = pe.tranches
        .filter((t) => t.cycleIdx === c && t.source === "art_epic_budget")
        .reduce((sum, t) => sum + t.amount, 0);
      if (amount <= 0) continue;
      const used = usedByArt.get(artId) ?? 0;
      usedByArt.set(artId, used + amount);
      // Der Rahmen ist der einzige Grund, aus dem ein ART-Epic leer ausgeht.
      // Dass er hier hält, hat der Motor schon entschieden — diese Prüfung ist
      // die Gegenprobe gegen einen Rahmen, der in der Datenbank anders steht.
      if (used + amount > frame) {
        throw new Error(
          `Seed-Invariante verletzt: ART-Rahmen ${cycleKey}/${artId} überzogen ` +
            `(${used + amount} > ${frame}).`,
        );
      }
      allocSpecs.push({ artId, epicId: epicIds[i]!, cycleKey, amount, ask: pe.cost });
    }
  }
  await seedArtEpicAllocations(tenantId, ADMIN, allocSpecs);

  // ── Die Budgetierungs-Regel gegenprüfen, Runde für Runde ─────────────────
  //
  // Laut scheitern statt still falsche Daten schreiben — dieselbe Haltung wie
  // `assertGateHistory`. Neu ist der Umfang: geprüft wird **jedes gespielte
  // Halbjahr**, nicht nur das laufende. Der Datensatz, den dieser Seed ablöst,
  // hätte diese Prüfung nicht bestanden: er trug Zuteilungen in genau einem
  // Zyklus, obwohl zehn Runden geschlossen waren.
  //
  // **Beide Töpfe sind abgedeckt, aber nur durch die Bauart.** `amountInCycle`
  // summiert die Tranchen des Durchlaufs, und die ART-Zuteilungen (`allocSpecs`,
  // oben) stammen aus genau denselben Tranchen — derselbe Euro, anders geroutet.
  // Sie hier zusätzlich zu addieren wäre Doppelzählung. Wer aber je eine
  // ART-Zuteilung **von Hand** dazuschreibt, steht ausserhalb dieser Summe und
  // öffnet damit dasselbe Loch, das `seed-demo` hatte: dort lag ein L2-Epic mit
  // 100.000 € aus dem ART-Rahmen, und der Wächter sah nur den Portfolio-Topf.
  {
    let checked = 0;
    for (const round of roundPlan.rounds) {
      const c = round.cycleIdx;
      const facts: AllocationFacts[] = roundPlan.epics
        .filter((e) => e.stepAtCycleEnd[c] != null)
        .map((e) => ({
          id: epicIds[e.idx]!,
          title: epicTitles[e.idx] ?? `Epic #${e.idx}`,
          step: e.stepAtCycleEnd[c]!,
          amountInCycle: e.tranches
            .filter((t) => t.cycleIdx === c)
            .reduce((sum, t) => sum + t.amount, 0),
        }));
      const violations = allocationRuleViolations(facts, round.cycleKey);
      if (violations.length > 0) {
        throw new Error(
          `Budgetierungs-Regel verletzt (${round.cycleKey}):\n${formatAllocationViolations(violations.slice(0, 12))}` +
            (violations.length > 12 ? `\n  … und ${violations.length - 12} weitere` : ""),
        );
      }
      checked += facts.length;
    }
    console.log(
      `  ✓ Budgetierungs-Regel geprüft — ${roundPlan.rounds.length} Runden, ` +
        `${checked} Epic-Stände, keine Verstöße`,
    );
  }

  const currentAllocs = allocSpecs.filter((a) => a.cycleKey === CURRENT_CYCLE).length;
  console.log(
    `  ✓ ${allocSpecs.length} ART-Zuteilungen über ${artFundedByCycle.size} Halbjahre ` +
      `(${currentAllocs} im laufenden ${CURRENT_CYCLE})`,
  );

  await seedValueStreamGuardrails(
    tenantId,
    ADMIN,
    vsIds.map((vsId, k) => ({
      valueStreamId: vsId,
      targets: {
        capacity: { business: 70 + k * 5, enabler: 30 - k * 5 },
        approval: { portfolioThreshold: PORTFOLIO_THRESHOLD[k]! },
      },
    })),
  );
  console.log(`  ✓ Guardrail-Ziele für ${vsIds.length} Wertströme`);

  /**
   * **Die Gegenprobe am geschriebenen Bestand.** Nicht an den Absichten des
   * Seeds, sondern an dem, was in der Datenbank steht — so wie
   * `allocationRuleViolations` es fuer das Geld tut.
   *
   * Vorher hatten 28 von 30 Funnel-Ideen eine Timeline mit Umsetzungsterminen,
   * KPIs und teils Features. Das fiel niemandem auf, weil niemand danach fragte.
   */
  await assertWrittenContentMatchesGates(tenantId);

  console.log(
    `\n✅ Large-Seed fertig (sechs gespielte Runden, laufendes Halbjahr ${CURRENT_CYCLE}).\n`,
  );
}

/**
 * Liest die geschriebenen Epics samt ihrer Nebenobjekte und haelt sie gegen
 * `contentForGate`. Der Reifegrad-**Schritt** wird dabei aus denselben Stempeln
 * abgeleitet, aus denen die Anwendung ihn liest (`currentGateStep`) — nicht aus
 * der Absicht des Seeds.
 */
async function assertWrittenContentMatchesGates(tenantId: string): Promise<void> {
  const rows = await prisma.initiative.findMany({
    where: { tenantId, level: 0, deletedAt: null },
    select: {
      id: true,
      title: true,
      stageGate: true,
      approvedAt: true,
      implementationCompletedAt: true,
      benefitHypothesis: true,
      businessCase: true,
      timeline: true,
      costToMvp: true,
      epicType: true,
      helpRequestedAt: true,
      stagedForBudgeting: true,
      _count: { select: { children: true, kpis: true, themeLinks: true } },
    },
  });
  const funded = new Set(
    (await prisma.budgetAllocation.findMany({ where: { tenantId }, select: { epicId: true } })).map(
      (a) => a.epicId,
    ),
  );
  const linked = new Set(
    (
      await prisma.dependency.findMany({
        where: { tenantId },
        select: { fromId: true, toId: true },
      })
    ).flatMap((d) => [d.fromId, d.toId]),
  );

  assertGateContent(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      step: currentGateStep({
        stageGate: r.stageGate as StageGate,
        approvedAt: r.approvedAt,
        implementationCompletedAt: r.implementationCompletedAt,
      }),
      has: {
        benefitHypothesis: r.benefitHypothesis != null,
        timeline: r.timeline != null,
        businessCase: r.businessCase != null,
        costToMvp: r.costToMvp != null,
        epicType: r.epicType != null,
        kpis: r._count.kpis > 0,
        features: r._count.children > 0,
        budget: funded.has(r.id),
        themeLink: r._count.themeLinks > 0,
        epicDependency: linked.has(r.id),
        helpRequested: r.helpRequestedAt != null,
        stagedForBudgeting: r.stagedForBudgeting,
      },
    })),
  );
  console.log(`  ✓ ${rows.length} Epics tragen nur, was ihr Reifegrad hergibt`);
}

// ── Kleine Helfer ───────────────────────────────────────────────────────────

async function createManyChunked<T>(
  rows: T[],
  run: (data: T[]) => Promise<unknown>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await run(rows.slice(i, i + size));
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function simulateSeries(
  baseline: number,
  target: number,
  opts: {
    monthsBack?: number;
    fraction: number;
    seed: number;
    endExact?: number;
    /**
     * Anker der Erfassung (Umsetzungsstart L4.1): Punkte im 30-Tage-Raster ab
     * `from` bis maximal `now`; der erste Punkt ist die Baseline-Erfassung am
     * Ankerdatum. Ohne `from`: Bestandsverhalten (rückwärts von `now`,
     * `monthsBack` Punkte).
     */
    from?: Date;
    /**
     * Ende der Rampe statt `now`. Für Epics mit abgenommener Umsetzung ist das
     * das L4.2-Datum: dort friert die gelieferte Menge ein, also muss die Reihe
     * bis dahin ihren Endwert erreicht haben. Ohne diesen Anker rampte sie bis
     * heute weiter, und das Einfrieren träfe sie mitten im Anstieg — ein
     * fertiges Epic sähe dann aus, als habe es kaum etwas geliefert.
     */
    until?: Date;
  },
): { date: string; value: number }[] {
  const end = opts.until ?? now;
  const months = opts.from
    ? Math.max(0, Math.floor((end.getTime() - opts.from.getTime()) / (30 * DAY)))
    : (opts.monthsBack ?? 9);
  const dir = target >= baseline ? 1 : -1;
  const span = Math.abs(target - baseline);
  const finalDelta = span * opts.fraction;
  const decimals = span < 20 ? 1 : 0;
  const round = (v: number): number => Number(v.toFixed(decimals));
  // Frisch gestartet (< 1 Monat Umsetzung): nur die Baseline-Erfassung selbst.
  if (opts.from && months === 0) return [{ date: isoDate(opts.from), value: round(baseline) }];
  const dateAt = (i: number): Date =>
    opts.from ? addDays(opts.from, 30 * i) : addDays(end, -30 * (months - i));
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i <= months; i++) {
    const t = months === 0 ? 1 : i / months;
    const eased = t * t * (3 - 2 * t);
    const jitter = i === 0 || i === months ? 0 : Math.sin(opts.seed + i * 1.7) * finalDelta * 0.06;
    const magnitude = Math.min(finalDelta, Math.max(0, eased * finalDelta + jitter));
    const value =
      i === months && opts.endExact != null ? opts.endExact : baseline + dir * magnitude;
    out.push({ date: isoDate(dateAt(i)), value: round(value) });
  }
  return out;
}

/**
 * Der eingefrorene Beleg einer Runde — und der Snapshot dazu, damit der
 * Aufrufer ihn pruefen kann, statt ihn nur wegzuschreiben.
 *
 * `artRows` und `features` kommen von aussen herein. Frueher erfand diese
 * Funktion beides: das ART-Budget als Formel, die Feature-Last als `[]`.
 */
function buildSnapshotPayload(input: {
  cycleKey: string;
  capturedAt: Date;
  pool: Record<string, number>;
  epics: {
    epicId: string;
    title: string;
    valueStreamId: string;
    valueStreamName: string;
    priority: number;
    /** Die gewaehrten Raten je Halbjahr — **nicht** nur die des Zyklus. */
    allocations: Record<string, number>;
  }[];
  artRows: readonly ArtSnapshotInput[];
  features: readonly FeatureSnapshotInput[];
}): { snapshot: BudgetPlanSnapshot; payload: Prisma.InputJsonValue } {
  const snapshot = buildBudgetPlanSnapshot({
    cycleKey: input.cycleKey,
    capturedAt: input.capturedAt,
    pool: input.pool,
    epics: input.epics.map((e) => ({
      id: e.epicId,
      title: e.title,
      valueStreamId: e.valueStreamId,
      valueStream: e.valueStreamName,
      // `costSlices`/`startKey` sind der **Bedarf** aus dem Business Case; die
      // Snapshot-Faltung liest sie nicht (sie rechnet ausschliesslich ueber
      // `allocations`, auch im Wertstrom-Rollup). Sie stehen hier nur, weil
      // `BudgetEpicView` sie verlangt — der frueheste gewaehrte Zyklus ist die
      // ehrlichste Fuellung.
      costSlices: Object.values(e.allocations),
      startKey: Object.keys(e.allocations).sort()[0] ?? input.cycleKey,
      allocations: e.allocations,
      priority: e.priority,
    })),
    artRows: input.artRows,
    features: input.features,
  });
  return { snapshot, payload: { version: 1, snapshot } as unknown as Prisma.InputJsonValue };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
