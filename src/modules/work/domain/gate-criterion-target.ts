/**
 * **Wo man ein Gate-Kriterium erfüllt** — Kriterium → Reiter, als reine Tabelle.
 *
 * Sie stand bis September 2026 privat in `gate/epic-gate-card.tsx` und trug
 * fertige deutsche Sätze („Zu den Deliverables"). Herausgezogen aus zwei
 * Gründen, und der zweite ist der wichtigere:
 *
 * 1. Die Checklisten-Zeile braucht den **Link**.
 * 2. Die Reiter-Schiene braucht dieselbe Zuordnung für ihre Ringe — und ein
 *    Client-Baustein in `components/` ist kein Ort, an dem eine Server-Seite
 *    nachschlägt.
 *
 * Rein: kein I/O, keine Übersetzung. `tab` ist der `?tab=`-Schlüssel der
 * Epic-Detailseite, `labelKey` ein Katalog-Pfad (ADR-0024, Regel 2). Die `href`
 * baut der Aufrufer — sie braucht die Epic-Id, die Tabelle nicht.
 */
export interface CriterionTarget {
  /** `?tab=`-Schlüssel der Epic-Detailseite, oder `null` für eine fremde Fläche. */
  tab: string | null;
  /** Wohin der Link führt, als Pfad-Bauer. */
  href: (epicId: string) => string;
  labelKey: string;
}

export const CRITERION_TARGET: Record<string, CriterionTarget> = {
  hypothesis_drafted: {
    tab: "benefit-hypothesis",
    href: (id) => `/portfolio/epics/${id}?tab=benefit-hypothesis`,
    labelKey: "work.gate.target.hypothese",
  },
  hypothesis_approved: {
    tab: "benefit-hypothesis",
    href: (id) => `/portfolio/epics/${id}?tab=benefit-hypothesis`,
    labelKey: "work.gate.target.hypothese",
  },
  owner_nominated: {
    tab: "overview",
    href: (id) => `/portfolio/epics/${id}?tab=overview`,
    labelKey: "work.gate.target.overview",
  },
  // Die zwei L1-Kriterien von September 2026 — beide im Overview: die
  // Einordnung in der Karte „Einordnung", die Zielverbindung im Panel
  // „Strategische Beiträge".
  intended_class_set: {
    tab: "overview",
    href: (id) => `/portfolio/epics/${id}?tab=overview`,
    labelKey: "work.gate.target.overview",
  },
  goal_linked: {
    tab: "overview",
    href: (id) => `/portfolio/epics/${id}?tab=overview`,
    labelKey: "work.gate.target.overview",
  },
  business_case_drafted: {
    tab: "business-case",
    href: (id) => `/portfolio/epics/${id}?tab=business-case`,
    labelKey: "work.gate.target.businessCase",
  },
  deliverables_drafted: {
    tab: "breakdown",
    href: (id) => `/portfolio/epics/${id}?tab=breakdown`,
    labelKey: "work.gate.target.deliverables",
  },
  dependencies_mapped: {
    tab: "dependencies",
    href: (id) => `/portfolio/epics/${id}?tab=dependencies`,
    labelKey: "work.gate.target.dependencies",
  },
  kpis_defined: {
    tab: "kpis",
    href: (id) => `/portfolio/epics/${id}?tab=kpis`,
    labelKey: "work.gate.target.kpis",
  },
  budget_allocated: {
    // Eine Fläche ausserhalb des Epics — kein Reiter, also auch kein Ring.
    tab: null,
    href: () => "/budgeting/periods",
    labelKey: "work.gate.target.budgeting",
  },
  feature_started: {
    tab: "breakdown",
    href: (id) => `/portfolio/epics/${id}?tab=breakdown`,
    labelKey: "work.gate.target.deliverables",
  },
  features_completed: {
    tab: null,
    href: (id) => `/umsetzung?epic=${id}`,
    labelKey: "work.gate.target.cockpit",
  },
};

/**
 * Die Reiter, auf denen für den **nächsten** Schritt noch etwas offen ist.
 *
 * Das ist die Frage, die der Ring in der Schiene beantworten soll. Vorher
 * verglich sie `tab.gate === currentGate` — ein exakter Treffer gegen genau
 * einen Reifegrad, und `EPIC_TABS` vergibt nur `L0` und `L1`. Stand ein Epic
 * auf `analysis`, traf kein einziger Reiter, und alle Ringe verschwanden:
 * ausgerechnet mitten in der Arbeit Richtung L2.
 */
export function tabsNeedingAttention(
  criteria: readonly { key: string; satisfied: boolean }[],
): ReadonlySet<string> {
  const tabs = new Set<string>();
  for (const c of criteria) {
    if (c.satisfied) continue;
    const tab = CRITERION_TARGET[c.key]?.tab;
    if (tab != null) tabs.add(tab);
  }
  return tabs;
}
