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
export type DataRequirement =
  | "valueStream"
  | "art"
  | "epic"
  | "feature"
  | "pi"
  | "risk"
  | "goal";

/** Ein Schritt der geführten Tour: eine Fläche, ein Satz Verantwortung. */
export interface TourStep {
  /** Stabil — landet in `RoleOnboarding.seenStepKeys`. Nie nachträglich umbenennen. */
  key: string;
  title: string;
  /** 1–3 Sätze: was du hier tust und warum es deine Aufgabe ist. */
  body: string;
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
  text: string;
  capability?: Action;
  practice?: Practice;
  /** Explizit, weil ein Bullet keine Route hat, aus der sich das Modul ableiten ließe. */
  module?: ModuleKey;
}

export interface RolePlaybook {
  role: Role;
  /** Ein Satz. MODULNEUTRAL — wird immer gezeigt, auch im reinen Core-Tenant. */
  mission: string;
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
    mission:
      "Du betreibst Pulse mandantenübergreifend: du legst Workspaces an, schaltest Module frei und hältst den Betrieb gesund.",
    responsibilities: [
      { text: "Neue Kunden-Workspaces bereitstellen und ihre Module freischalten." },
      { text: "Mitgliedschaften und Plattform-Adminrechte über alle Mandanten hinweg verwalten." },
      { text: "Betriebsstörungen erkennen, bevor die Kunden sie melden." },
    ],
    handoffs: [
      {
        text: "Du übergibst an den Tenant-Admin: sobald der Workspace steht, richtet er Nutzer, Rollen und Organisation ein.",
      },
    ],
    steps: [
      {
        key: "platform_admin.scope",
        title: "Deine Arbeit liegt außerhalb dieses Workspaces",
        body: "Als einzige Rolle arbeitest du mandantenübergreifend: Workspaces bereitstellen, Module freischalten, Mitgliedschaften setzen. Hier drin bist du Gast — der Einstieg für den Tag ist trotzdem diese Inbox.",
        route: "/my-tasks",
        anchor: "group:myTasks",
      },
      {
        key: "platform_admin.structure",
        title: "Steht der Workspace?",
        body: "Der Strukturbaum ist dein schnellster Gesundheitscheck nach der Bereitstellung: Gibt es Wertströme und ARTs, oder hängt der Kunde noch beim Einrichten fest?",
        route: "/structure",
        anchor: "structure-tree",
      },
      {
        key: "platform_admin.audit",
        title: "Nachvollziehen, was passiert ist",
        body: "Jede zustandsändernde Aktion landet hier, inklusive Rollenvergaben. Über die Filterzeile kommst du bei Rückfragen in Sekunden an den richtigen Vorgang.",
        route: "/admin/audit-log",
        anchor: "audit-log-filter",
        capability: "admin.audit-log.read",
      },
    ],
  },

  // ── Governance ──────────────────────────────────────────────────────────
  [TENANT_ADMIN]: {
    role: TENANT_ADMIN,
    mission:
      "Du richtest den Workspace ein und hältst ihn arbeitsfähig: die richtigen Leute mit den richtigen Rechten, die Organisation korrekt abgebildet.",
    responsibilities: [
      { text: "Nutzer einladen, Rollen vergeben und deren Sichtbarkeits-Scopes setzen." },
      {
        text: "Getrennt davon festlegen, welche Rolle welche Berechtigung hat.",
        capability: "role.capability.manage",
      },
      { text: "Die Organisation abbilden: Wertströme und ARTs anlegen und pflegen." },
      { text: "Externe Systeme anbinden (Jira, Azure DevOps).", capability: "integration.manage" },
      { text: "Bei Rückfragen aus Audit oder Compliance Auskunft geben.", capability: "admin.audit-log.read" },
    ],
    handoffs: [
      { text: "Du übernimmst von der Plattform: der Workspace existiert, du füllst ihn mit Leben." },
      {
        text: "Du übergibst an Portfolio Manager und RTE: sobald Struktur und Rollen stehen, beginnt die Facharbeit.",
      },
    ],
    steps: [
      {
        key: "tenant_admin.setup",
        title: "Der Setup-Guide gibt die Reihenfolge vor",
        body: "Acht Meilensteine von „Workspace lebt\" bis „erstes PI läuft\". Das Tempo bestimmt ihr, die Reihenfolge ist fix — und du bist der Einzige, der hier abhaken darf.",
        route: "/setup",
        anchor: "setup-milestone-m1",
        capability: "tenant.users.manage",
      },
      {
        key: "tenant_admin.users",
        title: "Wer arbeitet in diesem Workspace?",
        body: "Diese Liste ist deine tägliche Anlaufstelle: Wer ist da, welche Rolle hat er, ist jemand gesperrt. Ein Klick öffnet rechts die Detailansicht mit den Rollen.",
        route: "/admin/users",
        anchor: "admin-user-list",
        capability: "admin.users.read",
      },
      {
        key: "tenant_admin.invite",
        title: "Jemanden einladen",
        body: "Über „Einladen\" öffnest du rechts das Formular. Nach der Zuweisung sieht der Eingeladene dasselbe Willkommensfenster, das du gerade gesehen hast — deine Rollenwahl bestimmt also, was er erklärt bekommt.",
        route: "/admin/users?selected=invite",
        anchor: "admin-user-list",
        capability: "tenant.users.manage",
      },
      {
        key: "tenant_admin.roles",
        title: "Berechtigungen je Rolle nachschärfen",
        body: "Wer Nutzer einlädt und wer Rechte vergibt, sind bewusst zwei getrennte Befugnisse. Links wählst du die Rolle, rechts siehst du jede Aktion und wo ihr vom Standard abweicht.",
        route: "/admin/roles",
        anchor: "admin-roles-nav",
        capability: "role.capability.manage",
      },
      {
        key: "tenant_admin.value_stream",
        title: "Den ersten Wertstrom anlegen",
        body: "Wertströme finanzieren Epics — ohne sie bleibt das Portfolio leer. Der Knopf steht im Kopf der Struktur-Seite; ARTs legst du danach im Detailbereich des jeweiligen Wertstroms an.",
        route: "/structure",
        anchor: "value-stream-create-button",
        capability: "value_stream.create",
      },
      {
        key: "tenant_admin.structure",
        title: "Die Organisation im Blick",
        body: "Der Baum zeigt Wertströme und die daran hängenden ARTs. Ein Klick auf einen Knoten öffnet rechts die Details — dort pflegst du Verantwortliche und legst weitere ARTs an.",
        route: "/structure",
        anchor: "structure-tree",
        requires: "valueStream",
      },
      {
        key: "tenant_admin.cadence",
        title: "Die Kadenz etablieren",
        body: "Ohne wiederkehrenden PI-Takt gibt es keine Planung. Dieser Meilenstein führt dich zu den Timelines, an die sich die ARTs anschließen.",
        route: "/setup",
        anchor: "setup-milestone-m3",
        capability: "tenant.users.manage",
      },
      {
        key: "tenant_admin.audit",
        title: "Auskunftsfähig bleiben",
        body: "Bei Rückfragen aus Audit oder Compliance filterst du hier nach Akteur, Aktion oder Zeitraum. Auch Rollenvergaben stehen darin.",
        route: "/admin/audit-log",
        anchor: "audit-log-filter",
        capability: "admin.audit-log.read",
      },
    ],
  },

  // ── Portfolio ───────────────────────────────────────────────────────────
  [PORTFOLIO_MANAGER]: {
    role: PORTFOLIO_MANAGER,
    mission:
      "Du führst das Portfolio: du entscheidest, woran gearbeitet wird, finanzierst es und weist am Ende nach, was es gebracht hat.",
    responsibilities: [
      { text: "Den Zielzustand und die Kopf-Ziele der Organisation setzen.", capability: "target.manage" },
      {
        text: "Epics durch den Investment-Funnel führen und die Stage Gates schalten.",
        capability: "epic.approve",
        practice: "stageGates",
      },
      {
        text: "Über die Benefit-Hypothese entscheiden — das war früher die Rolle des VMO.",
        capability: "epic.hypothesis.decide",
        practice: "multiPartyApproval",
      },
      { text: "Das Budget auf die Epics verteilen.", capability: "budget.manage" },
      { text: "Den realisierten Mehrwert im Portfolio-Review nachhalten.", module: "work" },
      { text: "Risiken final bewerten — du bist der Einzige, der eines löschen darf.", capability: "risk.delete" },
    ],
    handoffs: [
      {
        text: "Du übernimmst vom Epic Owner: er reicht Hypothese und Business Case ein, du entscheidest.",
        module: "work",
      },
      {
        text: "Du übergibst an den RTE: sobald ein Epic finanziert ist, plant er die Umsetzung im ART.",
        module: "drumbeat",
      },
    ],
    steps: [
      {
        key: "portfolio_manager.goals",
        title: "Der Tag beginnt bei den Zielen",
        body: "Hier stehen Zielbild und Kopf-Ziele. Jedes Epic zahlt später auf eines davon ein — ohne gepflegte Ziele lässt sich am Jahresende kein Wertnachweis führen.",
        route: "/ziele",
        anchor: "goals-table",
        capability: "target.manage",
        requires: "goal",
      },
      {
        key: "portfolio_manager.overview",
        title: "Der Portfolio-Stand auf einen Blick",
        body: "Das Board zeigt alle Epics nach Reifegrad L0–L5. Was sich links staut, ist unentschieden; was rechts steht, läuft bereits.",
        route: "/portfolio",
        anchor: "portfolio-kanban",
        practice: "portfolioLevel",
      },
      {
        key: "portfolio_manager.funnel",
        title: "Der Investment-Funnel",
        body: "In der Epic-Liste schaltest du die Stage Gates. Zwei Übergänge passieren allerdings von selbst: L2→L3 sobald Budget vergeben ist, L3→L4 sobald das erste Feature startet.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.approve",
        practice: "stageGates",
      },
      {
        key: "portfolio_manager.approvals",
        title: "Deine Entscheidungen sammeln sich hier",
        body: "Eingereichte Hypothesen und Business Cases warten in dieser Inbox. Freigeben, in Klärung schicken oder ablehnen — solange du nichts tust, steht das Epic still.",
        route: "/my-approvals",
        anchor: "approvals-list",
        capability: "epic.hypothesis.decide",
        practice: "multiPartyApproval",
      },
      {
        key: "portfolio_manager.budget_pool",
        title: "Den Budget-Topf setzen",
        body: "Zuerst der Rahmen je Halbjahr. Die Zeile „Verbleibend\" färbt sich rot, sobald du mehr verteilst, als im Topf ist — das ist deine Leitplanke.",
        route: "/controlling/budgeting",
        anchor: "budget-pool",
        capability: "budget.manage",
      },
      {
        key: "portfolio_manager.budget_allocate",
        title: "Budget auf Epics verteilen",
        body: "Unter dem Topf steht je Epic eine Zeile mit Priorität und Zuteilung je Periode. Sobald eine Zuteilung größer null gespeichert ist, rückt das Epic automatisch auf L3 — die Finanzierung ist die Entscheidung.",
        route: "/controlling/budgeting",
        anchor: "budget-pool",
        capability: "budget.manage",
        requires: "epic",
      },
      {
        key: "portfolio_manager.review",
        title: "Der wiederkehrende Steuerungstermin",
        body: "Das Portfolio-Review stellt Plan und Ist gegenüber: Benefit-Plan, Forecast, Plantreue, Terminabweichung. Über den Stichtag oben vergleichst du Stände.",
        route: "/portfolio/review",
        practice: "portfolioLevel",
      },
      {
        key: "portfolio_manager.risk_matrix",
        title: "Die Risikolage lesen",
        body: "Die Matrix stellt Wahrscheinlichkeit gegen Auswirkung. Mehrere Punkte in der rechten oberen Ecke sind dein Handlungssignal für den nächsten Review.",
        route: "/risks",
        anchor: "risk-matrix",
        requires: "risk",
      },
      {
        key: "portfolio_manager.risk_roam",
        title: "Risiken einordnen",
        body: "Unter der Matrix liegen die ROAM-Cluster: resolved, owned, accepted, mitigated. Du bist der Einzige, der ein Risiko auch löschen darf — für alles andere reicht die Einordnung.",
        route: "/risks",
        anchor: "risk-create-button",
        capability: "risk.roam",
      },
    ],
  },

  [VALUE_STREAM_OWNER]: {
    role: VALUE_STREAM_OWNER,
    mission:
      "Du verantwortest einen Wertstrom: welche Vorhaben dort entstehen, ob sie fachlich tragen und wer sie ausarbeitet.",
    responsibilities: [
      { text: "Epics in deinem Wertstrom anlegen und schärfen.", capability: "epic.create" },
      { text: "Einen Epic Owner benennen, der die Ausarbeitung übernimmt.", capability: "epic.owner.assign" },
      {
        text: "Als benannter Freigeber über Epics entscheiden.",
        capability: "epic.approval.decide",
        practice: "multiPartyApproval",
      },
      {
        text: "Deliverables und KPIs eines Epics fachlich abzeichnen.",
        capability: "epic.section.signoff",
        practice: "multiPartyApproval",
      },
      { text: "Das Wertstrom-Budget auf die ARTs verteilen.", capability: "art_budget.manage" },
    ],
    handoffs: [
      { text: "Du übernimmst vom Portfolio Manager: dein Wertstrom bekommt einen Finanzierungsrahmen." },
      {
        text: "Du übergibst an den Epic Owner: er arbeitet aus, was du beauftragt hast.",
        module: "work",
      },
    ],
    steps: [
      {
        key: "value_stream_owner.structure",
        title: "Dein Wertstrom",
        body: "Im Baum findest du deinen Wertstrom mit den daran hängenden ARTs. Deine Schreibrechte gelten genau hier — außerhalb kannst du lesen, aber nichts ändern.",
        route: "/structure",
        anchor: "structure-tree",
        capability: "value_stream.update",
        requires: "valueStream",
      },
      {
        key: "value_stream_owner.epic_create",
        title: "Ein Vorhaben beauftragen",
        body: "Neue Epics deines Wertstroms entstehen hier. Du legst an und benennst danach einen Epic Owner, der Hypothese und Business Case ausarbeitet.",
        route: "/portfolio/epics",
        anchor: "epic-create-button",
        capability: "epic.create",
      },
      {
        key: "value_stream_owner.funnel",
        title: "Wo stehen deine Epics?",
        body: "Der Reifegrad-Funnel zeigt, was noch in Ausarbeitung ist und was schon läuft. Über die Filterzeile grenzt du auf deinen Wertstrom ein.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        requires: "epic",
      },
      {
        key: "value_stream_owner.approvals",
        title: "Freigaben, die auf dich warten",
        body: "Wo du als Freigeber eingetragen bist, erscheint die Entscheidung hier. Ohne Begründung geht nur die Zustimmung — Ablehnen und Klären verlangen einen Text.",
        route: "/my-approvals",
        anchor: "approvals-list",
        capability: "epic.approval.decide",
        practice: "multiPartyApproval",
      },
      {
        key: "value_stream_owner.signoff",
        title: "Deliverables und KPIs abzeichnen",
        body: "Neben den Partei-Freigaben liegen hier die fachlichen Abnahmen. Erst wenn beide Abschnitte gezeichnet sind, gilt ein Epic als vollständig freigegeben.",
        route: "/my-approvals",
        anchor: "approvals-list",
        capability: "epic.section.signoff",
        practice: "multiPartyApproval",
      },
      {
        key: "value_stream_owner.art_budget",
        title: "Mittel auf die ARTs verteilen",
        body: "Der Finanzierungsrahmen deines Wertstroms wird im Controlling auf die ARTs heruntergebrochen. Die Detailansicht deines Wertstroms führt dich dorthin.",
        route: "/controlling",
        capability: "art_budget.manage",
      },
      {
        key: "value_stream_owner.risk",
        title: "Ein Risiko melden",
        body: "Vorschlagen darf jeder. Dein Vorschlag geht an den Epic Owner, der ihn prüft und dokumentiert — erst dann bekommt er eine Nummer.",
        route: "/risks",
        anchor: "risk-create-button",
        capability: "risk.suggest",
      },
    ],
  },

  [EPIC_OWNER]: {
    role: EPIC_OWNER,
    mission:
      "Du arbeitest Epics aus: du formulierst, was das Vorhaben bringen soll, belegst es und reichst es zur Entscheidung ein.",
    responsibilities: [
      { text: "Die Benefit-Hypothese formulieren und einreichen.", capability: "epic.hypothesis.submit" },
      { text: "Den Business Case ausarbeiten und einreichen.", capability: "epic.businesscase.submit" },
      {
        text: "Festlegen, wer das Epic freigeben muss.",
        capability: "epic.approval.configure",
        practice: "multiPartyApproval",
      },
      { text: "Risiken deines Epics dokumentieren, bewerten und ROAM-mäßig einordnen.", capability: "risk.document" },
      { text: "Nach einer Ablehnung überarbeiten und erneut einreichen.", capability: "epic.revision.start" },
    ],
    handoffs: [
      { text: "Du übernimmst vom Wertstrom-Verantwortlichen: er beauftragt, du arbeitest aus." },
      {
        text: "Du übergibst an Portfolio Manager und Freigeber — entscheiden darfst du über dein eigenes Epic bewusst nicht.",
        module: "work",
      },
    ],
    steps: [
      {
        key: "epic_owner.epics",
        title: "Deine Epics",
        body: "Hier liegen die Vorhaben, für die du verantwortlich bist. Ein Klick auf ein Epic öffnet die Detailansicht — dort spielt sich deine eigentliche Arbeit ab.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.update",
        requires: "epic",
      },
      {
        key: "epic_owner.create",
        title: "Ein neues Epic anlegen",
        body: "Titel und Wertstrom genügen zum Start. Alles Weitere — Hypothese, Business Case, Deliverables — entsteht danach Reiter für Reiter.",
        route: "/portfolio/epics",
        anchor: "epic-create-button",
        capability: "epic.create",
      },
      {
        key: "epic_owner.tabs",
        title: "Die Reiter sind deine Reihenfolge",
        body: "In einem geöffneten Epic führt dich die linke Leiste durch die Ausarbeitung: Hypothese, Business Case, Deliverables, KPI, Reifegrad und Timeline. Von oben nach unten abarbeiten.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.update",
        requires: "epic",
      },
      {
        key: "epic_owner.hypothesis",
        title: "Benefit-Hypothese zuerst",
        body: "Der erste Reiter. Nach dem Einreichen entscheiden die Freigeber; stimmen alle zu, rückt das Epic von L0 auf L1 — der Startschuss für den Business Case.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.hypothesis.submit",
        practice: "multiPartyApproval",
      },
      {
        key: "epic_owner.business_case",
        title: "Business Case belegen",
        body: "Kosten, Nutzen, Zeitraum. Schon der erste gespeicherte Inhalt hebt das Epic auf L2 — der Reifegrad folgt deiner Arbeit, du musst ihn nicht von Hand schalten.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.businesscase.submit",
      },
      {
        key: "epic_owner.approvers",
        title: "Freigeber benennen",
        body: "Im Reifegrad-Reiter legst du fest, welche Parteien zustimmen müssen. Deine eigene Zustimmung ist nicht vorgesehen: wer ausarbeitet, entscheidet nicht.",
        route: "/portfolio/epics",
        anchor: "epics-funnel-bar",
        capability: "epic.approval.configure",
        practice: "multiPartyApproval",
      },
      {
        key: "epic_owner.risk_document",
        title: "Risiken dokumentieren",
        body: "Vorschlagen darf jeder — prüfen und dokumentieren ist deine Aufgabe. Erst mit deiner Annahme bekommt ein Risiko seine Nummer und wird Teil des Registers.",
        route: "/risks",
        anchor: "risk-create-button",
        capability: "risk.document",
      },
      {
        key: "epic_owner.risk_matrix",
        title: "Die Risiken deines Epics bewerten",
        body: "Wahrscheinlichkeit mal Auswirkung ergibt die Exponierung. Jede Neubewertung bleibt als Spur erhalten, damit sichtbar wird, ob eure Maßnahmen wirken.",
        route: "/risks",
        anchor: "risk-matrix",
        capability: "risk.update",
        requires: "risk",
      },
    ],
  },

  // ── Programm ────────────────────────────────────────────────────────────
  [RTE]: {
    role: RTE,
    mission:
      "Du orchestrierst deinen Agile Release Train: du hältst den Takt, planst die Umsetzung und räumst weg, was die Lieferung blockiert.",
    responsibilities: [
      { text: "Program Increments anlegen, starten und abschließen.", capability: "pi.create", practice: "programLevel" },
      { text: "Das Feature-Backlog des ART pflegen und den Lieferstatus setzen.", capability: "feature.delivery.set" },
      {
        text: "Abhängigkeiten zwischen Vorhaben sichtbar machen und auflösen.",
        capability: "dependency.link",
        practice: "dependencies",
      },
      { text: "Impediments aufnehmen, eskalieren und schließen.", capability: "impediment.resolve" },
      { text: "Risiken der Umsetzung dokumentieren und ROAM-mäßig einordnen.", capability: "risk.roam" },
    ],
    handoffs: [
      {
        text: "Du übernimmst vom Portfolio: finanzierte Epics werden bei dir zu geplanter Arbeit.",
        module: "work",
      },
      {
        text: "Du übergibst zurück ans Portfolio: sobald das erste Feature in Umsetzung geht, rückt das Epic automatisch auf L4.",
        module: "work",
      },
    ],
    steps: [
      {
        key: "rte.approvals",
        title: "Der Tag beginnt in der Inbox",
        body: "Wo du als Stakeholder eingetragen bist, warten hier Entscheidungen. Kurz durchsehen, bevor du ins Cockpit gehst — Freigaben blockieren sonst die Planung anderer.",
        route: "/my-approvals",
        anchor: "approvals-list",
      },
      {
        key: "rte.cockpit",
        title: "Das Umsetzungs-Cockpit ist deine Zentrale",
        body: "Vier Sichten auf dieselben Features: Board, Tabelle, Roadmap, Netzplan. Du wechselst je nach Frage — Board für den Fluss, Tabelle zum Pflegen.",
        route: "/umsetzung",
        anchor: "cockpit-view-tabs",
        practice: "programLevel",
      },
      {
        key: "rte.pi_strip",
        title: "Wo steht der Zug im PI?",
        body: "Der Streifen zeigt die kommenden Program Increments, das laufende hervorgehoben. Er ist dein Zeitgefühl für alles, was darunter steht.",
        route: "/umsetzung",
        anchor: "cockpit-pi-strip",
        practice: "programLevel",
        requires: "pi",
      },
      {
        key: "rte.table",
        title: "Die Tabellensicht zum Pflegen",
        body: "Hier siehst du jedes Feature mit ART, PI, Status, WSJF und Blockern in einer Zeile. Das ist die Sicht, in der du tatsächlich änderst.",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        practice: "programLevel",
        requires: "feature",
      },
      {
        key: "rte.delivery",
        title: "Lieferstatus setzen",
        body: "In der Status-Spalte jeder Zeile wählst du direkt aus: bereit, in Umsetzung, blockiert, fertig. Sobald das erste Feature startet, rückt das übergeordnete Epic automatisch auf L4.",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        capability: "feature.delivery.set",
        requires: "feature",
      },
      {
        key: "rte.dependencies",
        title: "Abhängigkeiten auflösen",
        body: "Gerichtete Verknüpfungen zwischen Vorhaben, zyklusgeprüft. Über den Typ-Filter siehst du zuerst die echten Blocker — was hier offen bleibt, wird in der Planung teuer.",
        route: "/dependencies",
        anchor: "dependencies-funnel",
        capability: "dependency.link",
        practice: "dependencies",
      },
      {
        key: "rte.impediments",
        title: "Blockaden im Blick behalten",
        body: "Die ROAM-Leiste sortiert alle Impediments nach Umgang: resolved, owned, accepted, mitigated. Angelegt, eskaliert und gelöst werden sie im jeweiligen ART.",
        route: "/impediments",
        anchor: "impediments-roam-funnel",
        capability: "impediment.resolve",
      },
      {
        key: "rte.timelines",
        title: "Die Kadenz pflegen",
        body: "Eine Timeline ist der gemeinsame PI-Takt, den mehrere ARTs abonnieren. Ohne sie gibt es keine PIs — deshalb ist sie die Voraussetzung für alles darüber.",
        route: "/timelines",
        anchor: "structure-tree",
        practice: "programLevel",
      },
      {
        key: "rte.risk",
        title: "Risiken der Umsetzung",
        body: "Was die Lieferung gefährdet, gehört ins Register statt in den Kopf. Du darfst dokumentieren und ROAM setzen — die Annahme fremder Vorschläge liegt beim Epic Owner.",
        route: "/risks",
        anchor: "risk-create-button",
        capability: "risk.roam",
      },
    ],
  },

  [FEATURE_OWNER]: {
    role: FEATURE_OWNER,
    mission:
      "Du verantwortest die Vorhaben deines Zuges: was als Nächstes gebaut wird, in welcher Reihenfolge und mit welchem Nutzen.",
    responsibilities: [
      { text: "Features anlegen und fachlich schärfen.", capability: "feature.create" },
      { text: "Nach WSJF priorisieren — die Reihenfolge ist deine Aussage.", capability: "feature.wsjf.set", practice: "wsjf" },
      { text: "Den Lieferstatus deiner Features aktuell halten.", capability: "feature.delivery.set" },
      {
        text: "Abhängigkeiten deiner Features benennen.",
        capability: "dependency.link",
        practice: "dependencies",
      },
      { text: "Blockaden melden — auflösen tut sie der RTE.", capability: "impediment.create" },
    ],
    handoffs: [
      {
        text: "Du übernimmst vom Epic Owner: ein finanziertes Epic wird bei dir in Features zerlegt.",
        module: "work",
      },
      {
        text: "Du übergibst an den RTE: er plant deine priorisierten Features in ein PI ein.",
        module: "drumbeat",
      },
    ],
    steps: [
      {
        key: "feature_owner.cockpit",
        title: "Dein Arbeitsplatz",
        body: "Das Cockpit zeigt die Features deines Zuges in vier Sichten. Für die tägliche Pflege ist die Tabelle die richtige.",
        route: "/umsetzung",
        anchor: "cockpit-view-tabs",
        practice: "programLevel",
      },
      {
        key: "feature_owner.backlog",
        title: "Dein Backlog in einer Zeile pro Feature",
        body: "Titel, ART, PI, Status, WSJF und Blocker nebeneinander. Ein Klick auf den Titel öffnet die Detailansicht mit Beschreibung und Abhängigkeiten.",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        practice: "programLevel",
        requires: "feature",
      },
      {
        key: "feature_owner.wsjf",
        title: "Nach WSJF priorisieren",
        body: "Die WSJF-Spalte macht die Reihenfolge begründbar statt verhandelbar. Bewertet wird im Zeilen-Menü des Features; die Zahl hier ist das Ergebnis.",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        capability: "feature.wsjf.set",
        practice: "wsjf",
        requires: "feature",
      },
      {
        key: "feature_owner.delivery",
        title: "Lieferstatus aktuell halten",
        body: "Die Status-Spalte ist deine Zusage an den Rest des Zuges. Ein Feature, das seit Wochen auf „in Umsetzung\" steht, kostet dich Glaubwürdigkeit in der Planung.",
        route: "/umsetzung?view=table",
        anchor: "cockpit-table",
        capability: "feature.delivery.set",
        requires: "feature",
      },
      {
        key: "feature_owner.dependencies",
        title: "Abhängigkeiten benennen",
        body: "Was von anderen abhängt, gehört sichtbar gemacht — im Netzplan des Cockpits oder im Detail des Features. Diese Übersicht zeigt den Gesamtstand.",
        route: "/dependencies",
        anchor: "dependencies-funnel",
        capability: "dependency.link",
        practice: "dependencies",
      },
      {
        key: "feature_owner.impediment",
        title: "Blockaden melden",
        body: "Was dich aufhält, meldest du im ART. Eskalieren und Schließen ist Sache des RTE — bewusst getrennt, damit Meldung und Lösung nicht dieselbe Hand sind.",
        route: "/impediments",
        anchor: "impediments-roam-funnel",
        capability: "impediment.create",
      },
      {
        key: "feature_owner.risk",
        title: "Ein Risiko vorschlagen",
        body: "Was du beim Bauen siehst, weiß sonst niemand. Ein Vorschlag kostet dich zwei Sätze; geprüft wird er vom Epic Owner.",
        route: "/risks",
        anchor: "risk-create-button",
        capability: "risk.suggest",
      },
    ],
  },

  // ── Stakeholder ─────────────────────────────────────────────────────────
  [VIEWER]: {
    role: VIEWER,
    mission:
      "Du verfolgst, wie das Portfolio läuft — mit vollem Lesezugriff auf alles, was in deinem Workspace passiert.",
    responsibilities: [
      { text: "Portfolio-Fortschritt und Lieferstand verfolgen." },
      {
        text: "Risiken vorschlagen — das ist die eine Sache, die auch du schreiben darfst.",
        capability: "risk.suggest",
      },
    ],
    handoffs: [
      {
        text: "Du übergibst an den Epic Owner: ein von dir vorgeschlagenes Risiko prüft und dokumentiert er.",
        capability: "risk.suggest",
      },
    ],
    steps: [
      {
        key: "viewer.portfolio",
        title: "Der Gesamtstand",
        body: "Das Board zeigt alle Epics nach Reifegrad. Links das Unentschiedene, rechts das Laufende — das ist der schnellste Überblick, den es gibt.",
        route: "/portfolio",
        anchor: "portfolio-kanban",
        practice: "portfolioLevel",
      },
      {
        key: "viewer.reporting",
        title: "Verdichtete Auswertungen",
        body: "Portfolio-Health und die WSJF-Rangliste fassen den Stand in Kennzahlen zusammen, ohne dass du irgendwo eintauchen musst.",
        route: "/reporting/portfolio-health",
        practice: "portfolioLevel",
      },
      {
        key: "viewer.risk_matrix",
        title: "Die Risikolage",
        body: "Wahrscheinlichkeit gegen Auswirkung. Was rechts oben liegt, sollte in eurem nächsten Steuerungstermin zur Sprache kommen.",
        route: "/risks",
        anchor: "risk-matrix",
        requires: "risk",
      },
      {
        key: "viewer.risk_suggest",
        title: "Das eine, was auch du schreiben darfst",
        body: "Ein Risiko vorschlagen. Der Epic Owner prüft es; erst mit seiner Annahme wird daraus ein nummerierter Eintrag im Register.",
        route: "/risks",
        anchor: "risk-create-button",
        capability: "risk.suggest",
      },
    ],
  },
};
