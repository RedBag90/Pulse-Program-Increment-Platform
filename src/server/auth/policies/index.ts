import { ROLES, type Role } from "@/modules/core/kernel/domain/roles";

/**
 * The set of authorizable actions. Read actions are not gated here — RLS
 * handles tenant-scoped visibility; these cover state-changing actions.
 */
export type Action =
  | "tenant.create"
  | "tenant.users.manage"
  | "platform.tenants.manage"
  | "platform.users.manage"
  | "integration.manage"
  | "value_stream.create"
  | "value_stream.update"
  | "epic.create"
  | "epic.update"
  | "epic.delete"
  | "epic.gate.request"
  | "epic.gate.decide"
  | "epic.gate.withdraw"
  | "epic.gate.revert"
  | "epic.gate.approvers.configure"
  | "epic.hypothesis.submit"
  | "epic.hypothesis.decide"
  | "epic.approval.configure"
  | "epic.businesscase.submit"
  | "epic.approval.decide"
  | "epic.section.signoff"
  | "epic.revision.start"
  | "epic.owner.assign"
  | "art.create"
  | "art.update"
  | "art.delete"
  | "feature.create"
  | "feature.update"
  | "feature.wsjf.set"
  | "feature.delete"
  | "feature.review.submit"
  | "feature.review.decide"
  | "feature.delivery.set"
  | "feature.owner.assign"
  | "pi.create"
  | "pi.update"
  | "pi.start"
  | "pi.complete"
  | "pi.delete"
  | "pi_standard.manage"
  | "dependency.link"
  | "dependency.unlink"
  | "impediment.create"
  | "impediment.escalate"
  | "impediment.resolve"
  | "risk.suggest"
  | "risk.document"
  | "risk.review"
  | "risk.update"
  | "risk.roam"
  | "risk.delete"
  | "risk.link"
  | "risk.settings.manage"
  | "admin.audit-log.read"
  | "admin.users.read"
  | "target.manage"
  | "budget.manage"
  | "budget_plan.revision.capture"
  | "timeline.manage"
  | "art_budget.manage"
  | "kpi.bind"
  | "role.capability.manage"
  | "goal.custom_field.manage"
  | "pi.demo.manage"
  | "portfolio_filter.manage"
  | "role.onboarding.manage";

/** A scope dimension a grant may additionally require the principal to match. */
export type ScopeCheck = "value_stream" | "art" | "team" | "own";

export interface Grant {
  roles: Role[];
  /** When set, the principal must also satisfy this scope against the resource. */
  scope?: ScopeCheck;
}

const {
  PORTFOLIO_MANAGER,
  VALUE_STREAM_OWNER,
  EPIC_OWNER,
  RTE,
  FEATURE_OWNER,
  TENANT_ADMIN,
  VIEWER,
} = ROLES;

/**
 * Policy registry: action → grants. A request is allowed if it satisfies ANY
 * grant. `platform_admin` and `tenant_admin` are allowed everything and are
 * handled in authorize().
 */
export const POLICIES: Record<Action, Grant[]> = {
  // ── Governance ──────────────────────────────────────────────────────────
  // Platform- and tenant-level administration. `tenant_admin` already passes
  // every action via authorize(); the explicit grants document intent.
  "tenant.create": [], // platform_admin only
  // Cross-tenant Plattform-Verwaltung. Bewusst LEERE Grant-Liste: kein
  // tenant_admin-Fast-Path — die Enforcement läuft ausschliesslich über den
  // globalen `isPlatformAdmin`-Guard (`requirePlatformAdmin`), NICHT über
  // `authorize()`. Die Actions existieren fürs Audit/Doku + Nav-Gating.
  "platform.tenants.manage": [],
  "platform.users.manage": [],
  "tenant.users.manage": [{ roles: [TENANT_ADMIN] }],
  "integration.manage": [{ roles: [TENANT_ADMIN] }],
  "admin.audit-log.read": [{ roles: [TENANT_ADMIN] }],
  "admin.users.read": [{ roles: [TENANT_ADMIN] }],
  // Wer pro Rolle Capabilities zuweisen/entziehen darf — bewusst getrennt
  // von "tenant.users.manage" (Funktionstrennung "wer User einlädt" ≠
  // "wer Berechtigungen vergibt"). Standard-Träger: TENANT_ADMIN; das
  // Fast-Path-Bypass deckt das ohnehin ab, der explizite Grant
  // dokumentiert die Absicht.
  "role.capability.manage": [{ roles: [TENANT_ADMIN] }],
  "goal.custom_field.manage": [{ roles: [TENANT_ADMIN] }],
  // Define/manage the organisation's target operating model (the Soll the
  // transformation drives toward). Management-owned: the LPM/portfolio lead
  // (which now folds in the former transformation-lead) and the tenant admin.
  "target.manage": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],

  // Run participatory budgeting: distribute the budget pool across Epics. The
  // portfolio funders own this — the LPM/portfolio lead and the tenant admin.
  "budget.manage": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],
  // Freezing the live participatory-budgeting board into a half-year snapshot.
  // Same audience as `budget.manage` — whoever shapes the plan also owns the
  // revision record.
  "budget_plan.revision.capture": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],
  // Timelines are the shared PI cadences ARTs subscribe to. Managing the
  // catalogue (create / rename / delete / join / leave) sits with the same
  // audience that already shapes the portfolio plan.
  "timeline.manage": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],
  // Distribute a Value Stream's budget down to its ARTs. Coarse pre-filter; the
  // service-seam check authoritatively allows the VS's finance approver too.
  "art_budget.manage": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER, VALUE_STREAM_OWNER] }],
  // Eine Epic-KPI an einen Key Result binden (oder loesen / re-binden).
  // Eigener Capability statt `target.manage`, weil Strategie-Pflege
  // (Themes/KRs anlegen) und KPI-Bindungs-Pflege (Bewertungs-Brücke
  // Controlling) konzeptionell zwei verschiedene Verantwortlichkeiten
  // sind. Audience aktuell deckungsgleich mit `target.manage`;
  // perspektivisch koennen Finance-Rollen hier breiter zugelassen werden,
  // ohne den Strategie-Editor zu oeffnen.
  "kpi.bind": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],

  // ── Portfolio ───────────────────────────────────────────────────────────
  // The portfolio manager funds value streams and owns the Epic backlog.
  // Die Reifegrad-Achse hängt nicht mehr an einer pauschalen `epic.approve`-
  // Capability, sondern an `epic.gate.*` plus den namentlich benannten
  // Abnehmern (siehe unten, ADR-0018). `epic.impact.confirm` ist mit dem
  // eigenen L4→L5-Dialog entfallen — die Controlling-Hand steht jetzt als
  // Person auf der L5-Abnehmer-Regel.
  "value_stream.create": [{ roles: [PORTFOLIO_MANAGER] }],
  "epic.delete": [{ roles: [PORTFOLIO_MANAGER, TENANT_ADMIN] }],

  // ── Reifegrad-Wechsel (Stage Gate) ──────────────────────────────────────
  // Der Push ist ein **manueller Akt**: jemand beantragt ihn, namentlich
  // benannte Personen nehmen ihn ab. Beantragen darf, wer das Epic
  // verantwortet.
  //
  // `epic.gate.decide` ist bewusst breit: der eingefrorene Abnehmer kann ein
  // Finance-Controller ohne Portfolio-Rolle sein. Die Policy sieht die
  // Abnahme-Zeile nicht, also verengt der Service zeilenweise über
  // `assertAssignedApprover` — dieselbe Aufteilung wie bei
  // `epic.approval.decide` (grober Vorfilter hier, maßgebliche Prüfung dort).
  "epic.gate.request": [
    { roles: [PORTFOLIO_MANAGER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.gate.decide": [
    { roles: [PORTFOLIO_MANAGER, VALUE_STREAM_OWNER, EPIC_OWNER, RTE, FEATURE_OWNER] },
  ],
  "epic.gate.withdraw": [
    { roles: [PORTFOLIO_MANAGER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  // Eine Rückstufung greift in die Historie ein (sie räumt Freigabe-Stempel
  // ab) und verlangt eine Begründung — deshalb eng.
  "epic.gate.revert": [{ roles: [PORTFOLIO_MANAGER] }],
  "epic.gate.approvers.configure": [
    { roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],

  // ── Value Stream ────────────────────────────────────────────────────────
  // The value stream owner manages their own value stream and the Epics
  // within it — value_stream-scoped, so they cannot touch foreign streams.
  "value_stream.update": [
    { roles: [PORTFOLIO_MANAGER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.create": [
    { roles: [PORTFOLIO_MANAGER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.update": [
    { roles: [PORTFOLIO_MANAGER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],

  // Multi-party approval workflow (sequential): the Epic Owner submits the
  // hypothesis (the Portfolio Manager decides it — the former VMO gate folds
  // into portfolio_manager), then configures + submits the Business Case for
  // stakeholder approval. `epic.approval.decide` is additionally gated in the
  // service to the assigned approver (the policy can't see the approval row).
  // Note: portfolio_manager now both submits and decides the hypothesis —
  // owner↔approver separation remains via the distinct `epic_owner` role.
  "epic.hypothesis.submit": [
    { roles: [EPIC_OWNER, PORTFOLIO_MANAGER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],
  "epic.hypothesis.decide": [{ roles: [PORTFOLIO_MANAGER] }],
  "epic.approval.configure": [{ roles: [EPIC_OWNER, PORTFOLIO_MANAGER] }],
  "epic.businesscase.submit": [{ roles: [EPIC_OWNER, PORTFOLIO_MANAGER] }],
  "epic.approval.decide": [{ roles: [PORTFOLIO_MANAGER, VALUE_STREAM_OWNER, RTE, FEATURE_OWNER] }],
  "epic.section.signoff": [{ roles: [VALUE_STREAM_OWNER, PORTFOLIO_MANAGER] }],
  "epic.revision.start": [{ roles: [EPIC_OWNER, PORTFOLIO_MANAGER] }],
  // The Portfolio Manager nominates the Epic Owner (precondition for the
  // Detailing phase); the value stream owner (scoped to their stream) plus the
  // admins via authorize() may also assign.
  "epic.owner.assign": [
    { roles: [PORTFOLIO_MANAGER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],

  // ── ART / Program ───────────────────────────────────────────────────────
  // ART lifecycle is a tenant-admin org-structure concern; the RTE orchestrates
  // the train (PIs, objectives, team updates) and runs Feature QS.
  "art.create": [{ roles: [TENANT_ADMIN] }],
  "art.update": [{ roles: [TENANT_ADMIN] }],
  "art.delete": [{ roles: [TENANT_ADMIN] }],

  "pi.create": [{ roles: [RTE] }],
  "pi.update": [{ roles: [RTE] }],
  "pi.start": [{ roles: [RTE] }],
  "pi.complete": [{ roles: [RTE] }],
  "pi.delete": [{ roles: [RTE] }],

  // Reusable named PI calendars are an org-structure concern — managed by the
  // portfolio lead and tenant admin. Applying a standard to an ART goes through
  // `pi.create` (the RTE), not this action.
  "pi_standard.manage": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],

  // System Demo (Roadmap-P4): RTE haelt die Agenda, Feature Owner
  // pflegen ihre eigenen Demo-Items. Scope ist heute global (pro
  // Tenant) — eine ART-Scope-Verschaerfung folgt, wenn noetig.
  "pi.demo.manage": [{ roles: [RTE, FEATURE_OWNER] }],

  // Persönliche, gespeicherte Portfolio-Filter — reine Nutzer-Präferenz
  // (user-scoped). Jede Rolle mit Portfolio-Zugang darf ihre eigenen Filter
  // anlegen/löschen; die Zeilen sind ohnehin per userId isoliert.
  "portfolio_filter.manage": [
    { roles: [TENANT_ADMIN, PORTFOLIO_MANAGER, VALUE_STREAM_OWNER, EPIC_OWNER, RTE, FEATURE_OWNER, VIEWER] },
  ],

  // Eigenes Rollen-Onboarding quittieren und den Tour-Fortschritt fortschreiben
  // (Modul `onboarding`, ADR-0017) — reine Selbstbedienung wie
  // `portfolio_filter.manage`: JEDE Rolle inklusive `viewer`, weil gerade der
  // Nur-Leser eine Einführung braucht. Der Service schreibt ausschließlich
  // `userId = principal.id`, die Zeilen sind zusätzlich per RLS user-isoliert.
  "role.onboarding.manage": [
    { roles: [TENANT_ADMIN, PORTFOLIO_MANAGER, VALUE_STREAM_OWNER, EPIC_OWNER, RTE, FEATURE_OWNER, VIEWER] },
  ],

  "feature.delete": [{ roles: [PORTFOLIO_MANAGER, RTE, TENANT_ADMIN] }],
  "feature.review.decide": [{ roles: [RTE] }],

  // ── Feature ─────────────────────────────────────────────────────────────
  // The feature owner owns the Feature backlog and WSJF scoring; the RTE and
  // portfolio manager may also act. Owners submit Features to Feature QS.
  "feature.create": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "feature.update": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "feature.wsjf.set": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "feature.review.submit": [{ roles: [FEATURE_OWNER, RTE, PORTFOLIO_MANAGER] }],
  // Delivery-lifecycle transitions on Features (approved → in_progress, pause,
  // resume, complete, cancel). Same audience as "feature.update".
  "feature.delivery.set": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],

  // Wer ein Feature an eine Person übergibt. Bewusst eine eigene Action statt
  // `feature.update` mitzubenutzen: Epic Owner und Wertstrom-Verantwortliche
  // dürfen den Inhalt eines Features NICHT ändern, sollen aber die
  // Verantwortung zuweisen können. Das Rollenmodell kennt keine Vererbung —
  // „ab Epic Owner aufwärts" steht deshalb hier ausgeschrieben.
  // Der Wertstrom-Scope beim VS Owner spiegelt `epic.owner.assign`.
  "feature.owner.assign": [
    { roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER, EPIC_OWNER] },
    { roles: [VALUE_STREAM_OWNER], scope: "value_stream" },
  ],

  // ── Dependencies ────────────────────────────────────────────────────────
  "dependency.link": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "dependency.unlink": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],

  // ── Impediments ─────────────────────────────────────────────────────────
  // Anyone operating delivery may raise an impediment; escalation and
  // resolution stay with the coordinating roles.
  "impediment.create": [{ roles: [PORTFOLIO_MANAGER, RTE, FEATURE_OWNER] }],
  "impediment.escalate": [{ roles: [PORTFOLIO_MANAGER, RTE] }],
  "impediment.resolve": [{ roles: [PORTFOLIO_MANAGER, RTE] }],
  // ── Risks ─────────────────────────────────────────────────────────────────
  // Everyone suggests; the Epic Owner (value-stream-scoped) documents/reviews.
  "risk.suggest": [
    { roles: [FEATURE_OWNER, RTE, VALUE_STREAM_OWNER, EPIC_OWNER, PORTFOLIO_MANAGER, VIEWER] },
  ],
  "risk.document": [
    { roles: [PORTFOLIO_MANAGER, RTE] },
    { roles: [EPIC_OWNER], scope: "value_stream" },
  ],
  "risk.review": [{ roles: [PORTFOLIO_MANAGER] }, { roles: [EPIC_OWNER], scope: "value_stream" }],
  "risk.update": [
    { roles: [PORTFOLIO_MANAGER, RTE] },
    { roles: [EPIC_OWNER], scope: "value_stream" },
  ],
  "risk.roam": [
    { roles: [PORTFOLIO_MANAGER, RTE] },
    { roles: [EPIC_OWNER], scope: "value_stream" },
  ],
  "risk.link": [
    { roles: [PORTFOLIO_MANAGER, RTE] },
    { roles: [EPIC_OWNER], scope: "value_stream" },
  ],
  "risk.delete": [{ roles: [PORTFOLIO_MANAGER] }],
  "risk.settings.manage": [{ roles: [TENANT_ADMIN, PORTFOLIO_MANAGER] }],
};

/**
 * Flat liste aller `(role, action, scope)` Tupel aus `POLICIES` — gedacht für
 * Backfill in die `RoleCapability`-Tabelle. Eine Zeile pro Rolle pro Grant.
 * `platform_admin` und `tenant_admin` sind über den Fast-Path in
 * `authorize()` ohnehin allmächtig und tauchen hier nicht auf (die explizit
 * dokumentierten Grants tun aber, weil sie semantisch zur Default-Bundle
 * gehören — z.B. `"epic.delete": [PORTFOLIO_MANAGER, TENANT_ADMIN]`).
 */
export interface CapabilityTuple {
  role: Role;
  action: Action;
  scope: ScopeCheck | null;
}

export function enumerateDefaultCapabilities(): CapabilityTuple[] {
  const out: CapabilityTuple[] = [];
  for (const [action, grants] of Object.entries(POLICIES) as [Action, Grant[]][]) {
    for (const grant of grants) {
      for (const role of grant.roles) {
        out.push({ role, action, scope: grant.scope ?? null });
      }
    }
  }
  return out;
}
