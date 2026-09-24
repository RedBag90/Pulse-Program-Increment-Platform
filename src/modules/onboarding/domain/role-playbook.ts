import { ROLES, type Role } from "@/modules/core/kernel/domain/roles";
import type { Practice } from "@/modules/core/kernel/domain/operating-model";
import type { ModuleKey } from "@/modules/core/kernel/domain/modules";
import type { Action } from "@/server/auth/policies";

/**
 * Single-Source-of-Truth für das, was eine Rolle in Pulse tut — je Rolle ein
 * Playbook aus Mission, Verantwortung, Übergaben und einer Tour durch die
 * zugehörigen Flächen.
 *
 * Diese Datei ist **pure Daten**. Hier nichts berechnen und nichts filtern —
 * das Filtern gegen Entitlement/Practice/Capability macht `role-tour.ts`.
 *
 * Warum Strings statt Importe: Das Modul `onboarding` ist ein Blatt über Core
 * (ADR-0017). Es erklärt Funktionen der oberen Module, darf sie aber nicht
 * importieren — also verweist es per Route, `data-tour`-Anker und
 * Capability-Name. Was der Compiler an Strings nicht sieht, prüfen die Tests in
 * `__tests__/role-playbook.test.ts`: jede Route muss auf ein registriertes,
 * statisches, real existierendes Segment zeigen, und jede Capability muss der
 * Rolle in `POLICIES` tatsächlich gewährt sein. Wer hier etwas ändert, ohne dass
 * die Rechte es hergeben, fliegt dort auf.
 *
 * **Die Texte stehen im Katalog, nicht hier.** Seit Zug 4 trägt jedes Feld
 * einen Schlüssel (`onboarding.playbook.<rolle>.<sache>`); die Wörter liegen in
 * `messages/de.json` und `messages/en.json`. Die Struktur — welcher Schritt zu
 * welcher Route gehört, welche Capability er braucht — bleibt hier, weil sie
 * Logik ist und keine Sprache. Wer eine Formulierung ändert, fasst den Katalog
 * an; wer einen Schritt hinzufügt, diese Datei.
 *
 * Textquellen beim Schreiben: `docs/personas.md` (Ton), `docs/setup-guide.md`
 * (chronologische Spine), `epic-lifecycle-doc.ts` + `epic-next-step.ts` (die
 * Übergaben stehen dort bereits als deutsche Sätze),
 * `docs/concepts/risk-management-module.md` (Risk-Kette). Gelesen, nicht importiert.
 */

/**
 * Bestand, den ein Schritt voraussetzt. Viele Flächen ersetzen ihren Inhalt im
 * Leerzustand vollständig (die Ziele-Tabelle weicht einem „Noch keine Strategie
 * definiert", die Budgeting-Grafik verschwindet ganz) — ein Anker dorthin ginge
 * dann ins Leere. Solche Schritte werden **serverseitig** ausgeblendet, nicht
 * erst im Browser: sonst gälten sie als ungesehen und würden direkt nach der
 * Tour als „neue Aufgaben" erneut angeboten.
 */
export type DataRequirement = "valueStream" | "art" | "epic" | "feature" | "pi" | "risk" | "goal";

/** Ein Schritt der geführten Tour: eine Fläche, ein Satz Verantwortung. */
export interface TourStep {
  /** Stabil — landet in `RoleOnboarding.seenStepKeys`. Nie nachträglich umbenennen. */
  key: string;
  titleKey: string;
  /** 1–3 Sätze: was du hier tust und warum es deine Aufgabe ist. Katalog-Schlüssel. */
  bodyKey: string;
  /** Locale-loses Ziel. Muss statisch sein (kein `[param]`) — die Tour navigiert dorthin. */
  route: string;
  /** `data-tour`-Wert des hervorzuhebenden Elements. Fehlt er, zeigt die Tour eine zentrierte Karte. */
  anchor?: string;
  /** Schritt entfällt, wenn der Nutzer diese Capability nicht hat. */
  capability?: Action;
  /** Schritt entfällt, wenn diese Practice im Operating Model aus ist. */
  practice?: Practice;
  /**
   * Schritt entfällt, solange es im Workspace keinen Bestand dieser Art gibt.
   * Nötig überall dort, wo der Leerzustand die Fläche komplett ersetzt.
   */
  requires?: DataRequirement;
}

/**
 * Eine Aussage über die Rolle (Verantwortung oder Übergabe) mit denselben Gates
 * wie ein Schritt — sonst verspricht der Text Verantwortung, die es in diesem
 * Tenant gar nicht gibt.
 */
export interface PlaybookClaim {
  /** Katalog-Schlüssel — die Domäne benennt, die Oberfläche übersetzt (ADR-0024). */
  textKey: string;
  capability?: Action;
  practice?: Practice;
  /** Explizit, weil ein Bullet keine Route hat, aus der sich das Modul ableiten ließe. */
  module?: ModuleKey;
}

export interface RolePlaybook {
  role: Role;
  /** Ein Satz. MODULNEUTRAL — wird immer gezeigt, auch im reinen Core-Tenant. */
  missionKey: string;
  responsibilities: readonly PlaybookClaim[];
  /** Woher die Arbeit kommt und wohin sie weitergeht. */
  handoffs: readonly PlaybookClaim[];
  steps: readonly TourStep[];
}

const {
  PLATFORM_ADMIN,
  TENANT_ADMIN,
  PORTFOLIO_MANAGER,
  VALUE_STREAM_OWNER,
  EPIC_OWNER,
  RTE,
  FEATURE_OWNER,
  VIEWER,
} = ROLES;

export const ROLE_PLAYBOOKS: Record<Role, RolePlaybook> = {
  // ── Plattform ───────────────────────────────────────────────────────────
  [PLATFORM_ADMIN]: {
    role: PLATFORM_ADMIN,
    missionKey: "onboarding.playbook.platformAdmin.mission",
    responsibilities: [
      { textKey: "onboarding.playbook.platformAdmin.neueKundenWorkspacesBereitstellen" },
      { textKey: "onboarding.playbook.platformAdmin.mitgliedschaftenUndPlattformAdminrechte" },
      { textKey: "onboarding.playbook.platformAdmin.betriebsstoerungenErkennenBevorDie" },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.platformAdmin.duUebergibstAnDen",
      },
    ],
    steps: [
      {
        key: "platform_admin.scope",
        titleKey: "onboarding.playbook.platformAdmin.deineArbeitLiegtAusserhalb",
        bodyKey: "onboarding.playbook.platformAdmin.alsEinzigeRolleArbeitest",
        route: "/my-tasks",
        anchor: "group:myTasks",
      },
      {
        key: "platform_admin.structure",
        titleKey: "onboarding.playbook.platformAdmin.stehtDerWorkspace",
        bodyKey: "onboarding.playbook.platformAdmin.derStrukturbaumIstDein",
        route: "/structure",
        anchor: "structure-tree",
      },
      {
        key: "platform_admin.audit",
        titleKey: "onboarding.playbook.platformAdmin.nachvollziehenWasPassiertIst",
        bodyKey: "onboarding.playbook.platformAdmin.jedeZustandsaenderndeAktionLandet",
        route: "/admin/audit-log",
        anchor: "audit-log-filter",
        capability: "admin.audit-log.read",
      },
    ],
  },

  // ── Governance ──────────────────────────────────────────────────────────
  [TENANT_ADMIN]: {
    role: TENANT_ADMIN,
    missionKey: "onboarding.playbook.tenantAdmin.mission",
    responsibilities: [
      { textKey: "onboarding.playbook.tenantAdmin.nutzerEinladenRollenVergeben" },
      {
        textKey: "onboarding.playbook.tenantAdmin.getrenntDavonFestlegenWelche",
        capability: "role.capability.manage",
      },
      { textKey: "onboarding.playbook.tenantAdmin.dieOrganisationAbbildenWertstroeme" },
      {
        textKey: "onboarding.playbook.tenantAdmin.externeSystemeAnbindenJira",
        capability: "integration.manage",
      },
      {
        textKey: "onboarding.playbook.tenantAdmin.beiRueckfragenAusAudit",
        capability: "admin.audit-log.read",
      },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.tenantAdmin.duUebernimmstVonDer",
      },
      {
        textKey: "onboarding.playbook.tenantAdmin.duUebergibstAnPortfolio",
      },
    ],
    steps: [
      {
        key: "tenant_admin.setup",
        titleKey: "onboarding.playbook.tenantAdmin.derSetupGuideGibt",
        bodyKey: "onboarding.playbook.tenantAdmin.achtMeilensteineVonWorkspace",
        route: "/setup",
        anchor: "setup-milestone-m1",
        capability: "tenant.users.manage",
      },
      {
        key: "tenant_admin.users",
        titleKey: "onboarding.playbook.tenantAdmin.werArbeitetInDiesem",
        bodyKey: "onboarding.playbook.tenantAdmin.dieseListeIstDeine",
        route: "/admin/users",
        anchor: "admin-user-list",
        capability: "admin.users.read",
      },
      {
        key: "tenant_admin.invite",
        titleKey: "onboarding.playbook.tenantAdmin.jemandenEinladen",
        bodyKey: "onboarding.playbook.tenantAdmin.ueberEinladenOeffnestDu",
        route: "/admin/users?selected=invite",
        anchor: "admin-user-list",
        capability: "tenant.users.manage",
      },
      {
        key: "tenant_admin.roles",
        titleKey: "onboarding.playbook.tenantAdmin.berechtigungenJeRolleNachschaerfen",
        bodyKey: "onboarding.playbook.tenantAdmin.werNutzerEinlaedtUnd",
        route: "/admin/roles",
        anchor: "admin-roles-nav",
        capability: "role.capability.manage",
      },
      {
        key: "tenant_admin.value_stream",
        titleKey: "onboarding.playbook.tenantAdmin.denErstenWertstromAnlegen",
        bodyKey: "onboarding.playbook.tenantAdmin.wertstroemeFinanzierenEpicsOhne",
        route: "/structure",
        anchor: "value-stream-create-button",
        capability: "value_stream.create",
      },
      {
        key: "tenant_admin.structure",
        titleKey: "onboarding.playbook.tenantAdmin.dieOrganisationImBlick",
        bodyKey: "onboarding.playbook.tenantAdmin.dieKarteZeigtJe",
        route: "/structure",
        anchor: "structure-tree",
        requires: "valueStream",
      },
      {
        key: "tenant_admin.cadence",
        titleKey: "onboarding.playbook.tenantAdmin.dieKadenzEtablieren",
        bodyKey: "onboarding.playbook.tenantAdmin.ohneWiederkehrendenPiTakt",
        route: "/setup",
        anchor: "setup-milestone-m3",
        capability: "tenant.users.manage",
      },
      {
        key: "tenant_admin.audit",
        titleKey: "onboarding.playbook.tenantAdmin.auskunftsfaehigBleiben",
        bodyKey: "onboarding.playbook.tenantAdmin.beiRueckfragenAusAudit2",
        route: "/admin/audit-log",
        anchor: "audit-log-filter",
        capability: "admin.audit-log.read",
      },
    ],
  },

  // ── Portfolio ───────────────────────────────────────────────────────────
  [PORTFOLIO_MANAGER]: {
    role: PORTFOLIO_MANAGER,
    missionKey: "onboarding.playbook.portfolioManager.mission",
    responsibilities: [
      {
        textKey: "onboarding.playbook.portfolioManager.denZielzustandUndDie",
        capability: "target.manage",
      },
      {
        textKey: "onboarding.playbook.portfolioManager.dieOrganisationAufbauenWertstroeme",
        capability: "art.create",
      },
      {
        textKey: "onboarding.playbook.portfolioManager.epicsDurchDenInvestment",
        capability: "epic.gate.request",
        practice: "stageGates",
      },
      {
        textKey: "onboarding.playbook.portfolioManager.denReifegradWechselAuf",
        capability: "epic.gate.decide",
        practice: "stageGates",
      },
      {
        textKey: "onboarding.playbook.portfolioManager.dasBudgetAufDie",
        capability: "budget.manage",
      },
      { textKey: "onboarding.playbook.portfolioManager.denRealisiertenMehrwertIm", module: "work" },
      {
        textKey: "onboarding.playbook.portfolioManager.risikenFinalBewertenDu",
        capability: "risk.delete",
      },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.portfolioManager.duUebernimmstVomEpic",
        module: "work",
      },
      {
        textKey: "onboarding.playbook.portfolioManager.duUebergibstAnDen",
        module: "drumbeat",
      },
    ],
    steps: [
      {
        key: "portfolio_manager.goals",
        titleKey: "onboarding.playbook.portfolioManager.derTagBeginntBei",
        bodyKey: "onboarding.playbook.portfolioManager.hierStehenZielbildUnd",
        route: "/ziele",
        anchor: "goals-table",
        capability: "target.manage",
        requires: "goal",
      },
      {
        key: "portfolio_manager.overview",
        titleKey: "onboarding.playbook.portfolioManager.derPortfolioStandAuf",
        bodyKey: "onboarding.playbook.portfolioManager.dasBoardStelltAlle",
        route: "/portfolio",
        anchor: "portfolio-kanban",
        practice: "portfolioLevel",
      },
      {
        key: "portfolio_manager.funnel",
        titleKey: "onboarding.playbook.portfolioManager.derInvestmentFunnel",
        bodyKey: "onboarding.playbook.portfolioManager.inDerEpicListe",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.gate.request",
        practice: "stageGates",
      },
      {
        key: "portfolio_manager.approvals",
        titleKey: "onboarding.playbook.portfolioManager.deineEntscheidungenSammelnSich",
        bodyKey: "onboarding.playbook.portfolioManager.beantragteReifegradWechselUnd",
        route: "/my-approvals",
        anchor: "approvals-list",
        capability: "epic.gate.decide",
        practice: "stageGates",
      },
      {
        key: "portfolio_manager.budget_pool",
        titleKey: "onboarding.playbook.portfolioManager.denBudgetTopfSetzen",
        bodyKey: "onboarding.playbook.portfolioManager.jeHalbjahrEineKachel",
        route: "/budgeting/periods",
        anchor: "budget-pool",
        capability: "budget.manage",
      },
      {
        key: "portfolio_manager.budget_allocate",
        titleKey: "onboarding.playbook.portfolioManager.budgetAufEpicsVerteilen",
        bodyKey: "onboarding.playbook.portfolioManager.verteiltWirdInDer",
        route: "/budgeting/periods",
        anchor: "budget-pool",
        capability: "budget.manage",
        requires: "epic",
      },
      {
        key: "portfolio_manager.review",
        titleKey: "onboarding.playbook.portfolioManager.derWiederkehrendeSteuerungstermin",
        bodyKey: "onboarding.playbook.portfolioManager.diePortfolioUebersichtIst",
        route: "/portfolio",
        practice: "portfolioLevel",
      },
      {
        key: "portfolio_manager.risk_matrix",
        titleKey: "onboarding.playbook.portfolioManager.dieRisikolageLesen",
        bodyKey: "onboarding.playbook.portfolioManager.dieMatrixStelltEintrittswahrscheinlichkeit",
        // Die Matrix steht als Streifen über dem Register; der Schritt spricht über
        // ihren Inhalt und bringt sie deshalb aufgeklappt mit.
        route: "/issues?matrix=1",
        anchor: "risk-matrix",
        requires: "risk",
      },
      {
        key: "portfolio_manager.risk_roam",
        titleKey: "onboarding.playbook.portfolioManager.risikenEinordnen",
        bodyKey: "onboarding.playbook.portfolioManager.ueberDerListeFiltert",
        route: "/issues",
        anchor: "issue-create-button",
        capability: "risk.roam",
      },
    ],
  },

  [VALUE_STREAM_OWNER]: {
    role: VALUE_STREAM_OWNER,
    missionKey: "onboarding.playbook.valueStreamOwner.mission",
    responsibilities: [
      {
        textKey: "onboarding.playbook.valueStreamOwner.epicsInDeinemWertstrom",
        capability: "epic.create",
      },
      {
        textKey: "onboarding.playbook.valueStreamOwner.einenEpicOwnerBenennen",
        capability: "epic.owner.assign",
      },
      {
        textKey: "onboarding.playbook.valueStreamOwner.alsBenannterAbnehmerUeber",
        capability: "epic.gate.decide",
      },
      // `art_budget.manage` stand hier bis September 2026 — eine Attrappe: die
      // Capability ist erteilbar und wird von keinem einzigen Seam geprueft.
      // Ihr Konsument entfiel, als der ART-Rahmen eine **abgeleitete** Summe
      // wurde (Σ der Zusprueche auf den Positionen der Art `art_change`); seither
      // traegt das Recht daran `rtb_item.manage`. Ein Versprechen an einer
      // Attrappe ist schlimmer als keines: wer es im Admin-UI entzieht, aendert
      // nichts, und der Rollen-Test hier haette es nie gemerkt.
      {
        textKey: "onboarding.playbook.valueStreamOwner.dasWertstromBudgetAuf",
        capability: "rtb_item.manage",
      },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.valueStreamOwner.duUebernimmstVomPortfolio",
      },
      {
        textKey: "onboarding.playbook.valueStreamOwner.duUebergibstAnDen",
        module: "work",
      },
    ],
    steps: [
      {
        key: "value_stream_owner.structure",
        titleKey: "onboarding.playbook.valueStreamOwner.deinWertstrom",
        bodyKey: "onboarding.playbook.valueStreamOwner.imBaumFindestDu",
        route: "/structure",
        anchor: "structure-tree",
        capability: "value_stream.update",
        requires: "valueStream",
      },
      {
        key: "value_stream_owner.epic_create",
        titleKey: "onboarding.playbook.valueStreamOwner.einVorhabenBeauftragen",
        bodyKey: "onboarding.playbook.valueStreamOwner.neueEpicsDeinesWertstroms",
        route: "/portfolio/epics",
        anchor: "epic-create-button",
        capability: "epic.create",
      },
      {
        key: "value_stream_owner.funnel",
        titleKey: "onboarding.playbook.valueStreamOwner.woStehenDeineEpics",
        bodyKey: "onboarding.playbook.valueStreamOwner.derReifegradFunnelZeigt",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        requires: "epic",
      },
      {
        key: "value_stream_owner.approvals",
        titleKey: "onboarding.playbook.valueStreamOwner.freigabenDieAufDich",
        bodyKey: "onboarding.playbook.valueStreamOwner.woDuAlsAbnehmer",
        route: "/my-approvals",
        anchor: "approvals-list",
        capability: "epic.gate.decide",
      },
      {
        key: "value_stream_owner.art_budget",
        titleKey: "onboarding.playbook.valueStreamOwner.mittelAufDieArts",
        bodyKey: "onboarding.playbook.valueStreamOwner.derFinanzierungsrahmenDeinesWertstroms",
        route: "/budgeting",
        capability: "rtb_item.manage",
      },
      {
        key: "value_stream_owner.risk",
        titleKey: "onboarding.playbook.valueStreamOwner.einRisikoMelden",
        bodyKey: "onboarding.playbook.valueStreamOwner.vorschlagenDarfJederDein",
        route: "/issues",
        anchor: "issue-create-button",
        capability: "risk.suggest",
      },
    ],
  },

  [EPIC_OWNER]: {
    role: EPIC_OWNER,
    missionKey: "onboarding.playbook.epicOwner.mission",
    responsibilities: [
      {
        textKey: "onboarding.playbook.epicOwner.dieBenefitHypotheseFormulieren",
        capability: "epic.gate.request",
      },
      {
        textKey: "onboarding.playbook.epicOwner.denBusinessCaseAusarbeiten",
        capability: "epic.gate.request",
      },
      {
        textKey: "onboarding.playbook.epicOwner.risikenDeinesEpicsDokumentieren",
        capability: "risk.document",
      },
      {
        textKey: "onboarding.playbook.epicOwner.nachEinerAblehnungUeberarbeiten",
        capability: "epic.gate.request",
      },
    ],
    handoffs: [
      { textKey: "onboarding.playbook.epicOwner.duUebernimmstVomWertstrom" },
      {
        textKey: "onboarding.playbook.epicOwner.duUebergibstAnPortfolio",
        module: "work",
      },
    ],
    steps: [
      {
        key: "epic_owner.epics",
        titleKey: "onboarding.playbook.epicOwner.deineEpics",
        bodyKey: "onboarding.playbook.epicOwner.hierLiegenDieVorhaben",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.update",
        requires: "epic",
      },
      {
        key: "epic_owner.create",
        titleKey: "onboarding.playbook.epicOwner.einNeuesEpicAnlegen",
        bodyKey: "onboarding.playbook.epicOwner.titelUndWertstromGenuegen",
        route: "/portfolio/epics",
        anchor: "epic-create-button",
        capability: "epic.create",
      },
      {
        key: "epic_owner.tabs",
        titleKey: "onboarding.playbook.epicOwner.dieReiterSindDeine",
        bodyKey: "onboarding.playbook.epicOwner.inEinemGeoeffnetenEpic",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.update",
        requires: "epic",
      },
      {
        key: "epic_owner.hypothesis",
        titleKey: "onboarding.playbook.epicOwner.benefitHypotheseZuerst",
        bodyKey: "onboarding.playbook.epicOwner.derDritteReiterDirekt",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.gate.request",
        practice: "stageGates",
      },
      {
        key: "epic_owner.business_case",
        titleKey: "onboarding.playbook.epicOwner.businessCaseBelegen",
        bodyKey: "onboarding.playbook.epicOwner.kostenNutzenZeitraumSteht",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.gate.request",
      },
      {
        key: "epic_owner.approvers",
        titleKey: "onboarding.playbook.epicOwner.abnehmerBenennen",
        bodyKey: "onboarding.playbook.epicOwner.beimAntragAufL",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.gate.request",
      },
      {
        key: "epic_owner.risk_document",
        titleKey: "onboarding.playbook.epicOwner.risikenDokumentieren",
        bodyKey: "onboarding.playbook.epicOwner.vorschlagenDarfJederPruefen",
        route: "/issues",
        anchor: "issue-create-button",
        capability: "risk.document",
      },
      {
        key: "epic_owner.risk_matrix",
        titleKey: "onboarding.playbook.epicOwner.dieRisikenDeinesEpics",
        bodyKey: "onboarding.playbook.epicOwner.wahrscheinlichkeitMalAuswirkungErgibt",
        // Die Matrix steht als Streifen über dem Register; der Schritt spricht über
        // ihren Inhalt und bringt sie deshalb aufgeklappt mit.
        route: "/issues?matrix=1",
        anchor: "risk-matrix",
        capability: "risk.update",
        requires: "risk",
      },
    ],
  },

  // ── Programm ────────────────────────────────────────────────────────────
  [RTE]: {
    role: RTE,
    missionKey: "onboarding.playbook.rte.mission",
    responsibilities: [
      {
        textKey: "onboarding.playbook.rte.programIncrementsAnlegenStarten",
        capability: "pi.create",
        practice: "programLevel",
      },
      {
        textKey: "onboarding.playbook.rte.dasFeatureBacklogDes",
        capability: "feature.delivery.set",
      },
      {
        textKey: "onboarding.playbook.rte.abhaengigkeitenZwischenVorhabenSichtbar",
        capability: "dependency.link",
        practice: "dependencies",
      },
      {
        textKey: "onboarding.playbook.rte.risikenUndBlockadenDer",
        capability: "risk.roam",
      },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.rte.duUebernimmstVomPortfolio",
        module: "work",
      },
      {
        textKey: "onboarding.playbook.rte.duUebergibstZurueckAns",
        module: "work",
      },
    ],
    steps: [
      {
        key: "rte.approvals",
        titleKey: "onboarding.playbook.rte.derTagBeginntIn",
        bodyKey: "onboarding.playbook.rte.woDuAlsStakeholder",
        route: "/my-approvals",
        anchor: "approvals-list",
      },
      {
        key: "rte.cockpit",
        titleKey: "onboarding.playbook.rte.dasUmsetzungsCockpitIst",
        bodyKey: "onboarding.playbook.rte.vierSichtenAufDieselben",
        route: "/umsetzung",
        anchor: "cockpit-view-tabs",
        practice: "programLevel",
      },
      {
        key: "rte.pi_strip",
        titleKey: "onboarding.playbook.rte.woStehtDerZug",
        bodyKey: "onboarding.playbook.rte.derStreifenZeigtDie",
        route: "/umsetzung",
        anchor: "cockpit-pi-strip",
        practice: "programLevel",
        requires: "pi",
      },
      {
        key: "rte.table",
        titleKey: "onboarding.playbook.rte.dieTabellensichtZumPflegen",
        bodyKey: "onboarding.playbook.rte.hierSiehstDuJedes",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        practice: "programLevel",
        requires: "feature",
      },
      {
        key: "rte.delivery",
        titleKey: "onboarding.playbook.rte.lieferstatusSetzen",
        bodyKey: "onboarding.playbook.rte.inDerStatusSpalte",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        capability: "feature.delivery.set",
        requires: "feature",
      },
      {
        key: "rte.dependencies",
        titleKey: "onboarding.playbook.rte.abhaengigkeitenAufloesen",
        bodyKey: "onboarding.playbook.rte.gerichteteVerknuepfungenZwischenVorhaben",
        route: "/dependencies",
        anchor: "dependencies-funnel",
        capability: "dependency.link",
        practice: "dependencies",
      },
      {
        key: "rte.issues",
        titleKey: "onboarding.playbook.rte.blockadenImBlickBehalten",
        bodyKey: "onboarding.playbook.rte.risikenUndBlockadenLiegen",
        route: "/issues",
        anchor: "issues-funnel-bar",
        capability: "risk.roam",
      },
      {
        key: "rte.timelines",
        titleKey: "onboarding.playbook.rte.dieKadenzPflegen",
        bodyKey: "onboarding.playbook.rte.eineTimelineIstDer",
        route: "/structure/timelines",
        anchor: "structure-tree",
        practice: "programLevel",
      },
      {
        key: "rte.risk",
        titleKey: "onboarding.playbook.rte.risikenDerUmsetzung",
        bodyKey: "onboarding.playbook.rte.wasDieLieferungGefaehrdet",
        route: "/issues",
        anchor: "issue-create-button",
        capability: "risk.document",
      },
    ],
  },

  [FEATURE_OWNER]: {
    role: FEATURE_OWNER,
    missionKey: "onboarding.playbook.featureOwner.mission",
    responsibilities: [
      {
        textKey: "onboarding.playbook.featureOwner.featuresAnlegenUndFachlich",
        capability: "feature.create",
      },
      {
        textKey: "onboarding.playbook.featureOwner.nachWsjfPriorisierenDie",
        capability: "feature.wsjf.set",
        practice: "wsjf",
      },
      {
        textKey: "onboarding.playbook.featureOwner.denLieferstatusDeinerFeatures",
        capability: "feature.delivery.set",
      },
      {
        textKey: "onboarding.playbook.featureOwner.abhaengigkeitenDeinerFeaturesBenennen",
        capability: "dependency.link",
        practice: "dependencies",
      },
      {
        textKey: "onboarding.playbook.featureOwner.risikenUndBlockadenMelden",
        capability: "risk.suggest",
      },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.featureOwner.duUebernimmstVomEpic",
        module: "work",
      },
      {
        textKey: "onboarding.playbook.featureOwner.duUebergibstAnDen",
        module: "drumbeat",
      },
    ],
    steps: [
      {
        key: "feature_owner.cockpit",
        titleKey: "onboarding.playbook.featureOwner.deinArbeitsplatz",
        bodyKey: "onboarding.playbook.featureOwner.dasCockpitZeigtDie",
        route: "/umsetzung",
        anchor: "cockpit-view-tabs",
        practice: "programLevel",
      },
      {
        key: "feature_owner.backlog",
        titleKey: "onboarding.playbook.featureOwner.deinBacklogInEiner",
        bodyKey: "onboarding.playbook.featureOwner.titelArtPiStatus",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        practice: "programLevel",
        requires: "feature",
      },
      {
        key: "feature_owner.wsjf",
        titleKey: "onboarding.playbook.featureOwner.nachWsjfPriorisieren",
        bodyKey: "onboarding.playbook.featureOwner.dieWsjfSpalteMacht",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        capability: "feature.wsjf.set",
        practice: "wsjf",
        requires: "feature",
      },
      {
        key: "feature_owner.delivery",
        titleKey: "onboarding.playbook.featureOwner.lieferstatusAktuellHalten",
        bodyKey: "onboarding.playbook.featureOwner.dieStatusSpalteIst",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        capability: "feature.delivery.set",
        requires: "feature",
      },
      {
        key: "feature_owner.dependencies",
        titleKey: "onboarding.playbook.featureOwner.abhaengigkeitenBenennen",
        bodyKey: "onboarding.playbook.featureOwner.wasVonAnderenAbhaengt",
        route: "/dependencies",
        anchor: "dependencies-funnel",
        capability: "dependency.link",
        practice: "dependencies",
      },
      {
        key: "feature_owner.risk",
        titleKey: "onboarding.playbook.featureOwner.einRisikoOderEine",
        bodyKey: "onboarding.playbook.featureOwner.wasDuBeimBauen",
        route: "/issues",
        anchor: "issue-create-button",
        capability: "risk.suggest",
      },
    ],
  },

  // ── Stakeholder ─────────────────────────────────────────────────────────
  [VIEWER]: {
    role: VIEWER,
    missionKey: "onboarding.playbook.viewer.mission",
    responsibilities: [
      { textKey: "onboarding.playbook.viewer.portfolioFortschrittUndLieferstand" },
      {
        textKey: "onboarding.playbook.viewer.risikenVorschlagenDasIst",
        capability: "risk.suggest",
      },
    ],
    handoffs: [
      {
        textKey: "onboarding.playbook.viewer.duUebergibstAnDen",
        capability: "risk.suggest",
      },
    ],
    steps: [
      {
        key: "viewer.portfolio",
        titleKey: "onboarding.playbook.viewer.derGesamtstand",
        bodyKey: "onboarding.playbook.viewer.dasBoardStelltAlle",
        route: "/portfolio",
        anchor: "portfolio-kanban",
        practice: "portfolioLevel",
      },
      {
        key: "viewer.risk_matrix",
        titleKey: "onboarding.playbook.viewer.dieRisikolage",
        bodyKey: "onboarding.playbook.viewer.wahrscheinlichkeitGegenAuswirkungWas",
        // Die Matrix steht als Streifen über dem Register; der Schritt spricht über
        // ihren Inhalt und bringt sie deshalb aufgeklappt mit.
        route: "/issues?matrix=1",
        anchor: "risk-matrix",
        requires: "risk",
      },
      {
        key: "viewer.risk_suggest",
        titleKey: "onboarding.playbook.viewer.dasEineWasAuch",
        bodyKey: "onboarding.playbook.viewer.einRisikoVorschlagenDer",
        route: "/issues",
        anchor: "issue-create-button",
        capability: "risk.suggest",
      },
    ],
  },
};
