import type { EventCatalog } from "@/modules/wiki/domain/events";

/**
 * Die Termine auf Deutsch — Wortlaut aus der Vorlage des Auftraggebers
 * (September 2026), die Vorbereitungen je Punkt aufgeteilt.
 */
export const EVENTS_DE: EventCatalog = {
  title: "Welche Termine es braucht",
  lede: "Die Events auf Portfolio- und ART-Ebene — wer dabei ist, wer leitet und was jede Rolle vorbereitet. Je Event stehen nur die beteiligten Rollen in der Tabelle.",
  dutyLabels: {
    "solution.product": "Produkt-Manager",
    "vs.finance": "Finance Approver",
    "vs.architecture": "Value Stream Architect Lead",
    "art.technical": "ART Technical Lead",
  },
  levels: [
    {
      key: "portfolio",
      title: "Portfolio-Ebene",
      note: "Dazu kommen laufende Aktivitäten rund um das **Portfolio Kanban**, z. B. die Analyse von Epics und Lean Business Cases. Das sind aber keine formalen Events.",
      events: [
        {
          key: "strategic-portfolio-review",
          name: "Strategic Portfolio Review",
          cadence: "quartalsweise",
          purpose:
            "Strategie, Strategic Themes und Portfolio-Fortschritt werden überprüft, und es wird über Epics entschieden.",
          participants: [
            {
              role: "portfolio_manager",
              part: "lead",
              prep: [
                "Agenda",
                "Portfolio-Canvas (Ist/Soll)",
                "Stand der Strategic Themes und Portfolio-KPIs",
                "Portfolio Kanban mit Epics, die zur Entscheidung anstehen",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Performance des Value Streams (Flow-Metriken, Business Value, Budgetverbrauch)",
                "Bedarf an Kapazität oder Budget",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Lean Business Cases für Go/No-Go",
                "Stand laufender Epics (MVP-Ergebnisse, Hypothesen validiert oder widerlegt, Empfehlung Pivot/Persevere)",
              ],
            },
            {
              role: "rte",
              part: "optional",
              prep: [
                "Kapazität und Umsetzungsrisiken des ARTs",
                "Vorhersagbarkeit der letzten PIs",
              ],
            },
            {
              duty: "vs.architecture",
              part: "active",
              prep: ["Architectural Runway", "Enabler-Epics, die zur Entscheidung anstehen"],
            },
            {
              duty: "vs.finance",
              part: "optional",
              prep: [
                "Budgetverbrauch des Wertstroms",
                "Finanzielle Auswirkung der anstehenden Epic-Entscheidungen",
              ],
            },
          ],
          seeAlso: ["ein-epic-reift"],
        },
        {
          key: "portfolio-sync",
          name: "Portfolio Sync",
          cadence: "monatlich",
          purpose: "Operative Steuerung: Epic-Umsetzung, Budgets, Abhängigkeiten und Risiken.",
          participants: [
            {
              role: "portfolio_manager",
              part: "lead",
              prep: [
                "Aktualisiertes Portfolio Kanban",
                "Budget-Ist gegen Guardrails",
                "Offene Eskalationen",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Budget-Ist des Value Streams",
                "Abweichungen und Maßnahmen",
                "Abhängigkeiten zu anderen Value Streams",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Status seiner Epics (Fortschritt, Kosten gegen Prognose, Risiken)",
                "Entscheidungsbedarf",
              ],
            },
            {
              role: "rte",
              part: "active",
              prep: [
                "ART-Status (PI-Fortschritt, Impediments, Abhängigkeiten)",
                "Eskalationen, die der ART nicht selbst lösen kann",
              ],
            },
            {
              duty: "vs.finance",
              part: "active",
              prep: ["Budget-Ist gegen Plan und Guardrails", "Offene Freigaben"],
            },
          ],
          seeAlso: ["ein-halbjahr-im-portfolio"],
        },
        {
          key: "participatory-budgeting",
          name: "Participatory Budgeting",
          cadence: "halbjährlich",
          purpose: "Das Budget wird gemeinsam auf die Value Streams verteilt.",
          participants: [
            {
              role: "portfolio_manager",
              part: "lead",
              prep: [
                "Verfügbares Gesamtbudget",
                "Guardrails",
                "Priorisierung der Epics",
                "Organisation und Regeln der Session",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Budgetantrag des Value Streams mit Begründung (geplante Epics, Kapazität, Run-Kosten)",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Pitch der Epics mit Lean Business Case, Kostenschätzung und erwartetem Nutzen",
              ],
            },
            {
              role: "rte",
              part: "optional",
              prep: ["Kapazitätsdaten des ARTs zur Plausibilisierung"],
            },
            {
              duty: "vs.finance",
              part: "active",
              prep: ["Verfügbares und bereits gebundenes Budget", "Freigaberegeln und Grenzen"],
            },
            {
              duty: "vs.architecture",
              part: "optional",
              prep: ["Anteil der Enabler am Budget, mit Begründung"],
            },
          ],
          seeAlso: ["ein-budget-zeitraum"],
        },
      ],
    },
    {
      key: "art",
      title: "ART-Ebene",
      events: [
        {
          key: "pi-planning",
          name: "PI Planning",
          cadence: "jedes PI, 2 Tage",
          purpose:
            "Alle Teams planen das nächste PI: PI Objectives, Abhängigkeiten, Risiken und Confidence Vote.",
          participants: [
            {
              role: "rte",
              part: "lead",
              prep: [
                "Logistik und Agenda",
                "Vorbereitungsgespräche mit Teams und Stakeholdern",
                "Kapazitätsübersicht",
                "Program Board und Tooling",
                "Planning-Readiness prüfen",
              ],
            },
            {
              duty: "solution.product",
              part: "active",
              prep: [
                "Vision und Roadmap",
                "Priorisierter ART-Backlog mit Top-10-Features (WSJF), jeweils mit Benefit Hypothesis und Akzeptanzkriterien",
                "Präsentation",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Geschäftskontext und Ziele (Business Context Briefing)",
                "Kriterien für die Bewertung des Business Value der PI Objectives",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Stand der Epics und daraus abgeleitete Features",
                "Erwartungen an das nächste PI",
              ],
            },
            {
              role: "portfolio_manager",
              part: "optional",
              prep: ["Strategische Leitplanken und relevante Strategic Themes"],
            },
            {
              duty: "vs.architecture",
              part: "active",
              prep: [
                "Architekturvision und ART-übergreifende Enabler",
                "Technische Abhängigkeiten zwischen ARTs",
              ],
            },
            {
              duty: "art.technical",
              part: "active",
              prep: [
                "Architektur-Briefing",
                "Enabler-Features und technische Abhängigkeiten",
                "Runway für das nächste PI",
              ],
            },
          ],
          seeAlso: ["ein-pi-von-anfang-bis-ende"],
        },
        {
          key: "management-review",
          name: "Management Review",
          cadence: "Abend von Tag 1 des PI Planning",
          purpose:
            "Planungsentwürfe werden bewertet und Anpassungen an Scope, Kapazität oder Prioritäten entschieden.",
          participants: [
            {
              role: "rte",
              part: "lead",
              prep: [
                "Konsolidierte Draft-Pläne",
                "Offene Probleme, Risiken und Abhängigkeiten der Teams",
              ],
            },
            {
              duty: "solution.product",
              part: "active",
              prep: ["Vorschläge für Scope-Anpassungen und Umpriorisierung"],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: ["Entscheidungsbereitschaft zu Zielkonflikten (Scope, Ressourcen, Termine)"],
            },
            {
              role: "epic_owner",
              part: "optional",
              prep: ["Auswirkungen der Anpassungen auf seine Epics"],
            },
            {
              duty: "vs.architecture",
              part: "optional",
              prep: ["Architektur-Risiken der Planentwürfe"],
            },
            {
              duty: "art.technical",
              part: "optional",
              prep: ["Technische Risiken und Machbarkeit der Anpassungen"],
            },
          ],
          seeAlso: ["ein-pi-von-anfang-bis-ende"],
        },
        {
          key: "coach-sync",
          name: "ART Sync: Coach Sync",
          cadence: "wöchentlich oder 14-täglich",
          purpose: "Fortschritt, Impediments und Abhängigkeiten zwischen den Teams.",
          participants: [
            {
              role: "rte",
              part: "lead",
              prep: [
                "Program Board und ROAM-Liste aktualisieren",
                "Impediment-Log",
                "Rückmeldungen der Scrum Master/Team Coaches einsammeln",
              ],
            },
            {
              duty: "art.technical",
              part: "optional",
              prep: ["Integrations-Impediments zwischen den Teams"],
            },
          ],
          seeAlso: ["was-dazwischenkommt"],
        },
        {
          key: "po-sync",
          name: "ART Sync: PO Sync",
          cadence: "wöchentlich oder 14-täglich",
          purpose: "Scope, Prioritäten und Feature-Fortschritt.",
          participants: [
            {
              // Der Produkt-Manager der Solutions des ARTs, nicht der Feature
              // Owner — Vorgabe des Auftraggebers (September 2026), ebenso bei
              // der System Demo.
              duty: "solution.product",
              part: "lead",
              prep: [
                "Feature-Fortschritt",
                "Änderungsbedarf an Scope und Priorität",
                "Refinement-Stand der Features fürs nächste PI",
              ],
            },
            {
              role: "rte",
              part: "active",
              prep: ["Abhängigkeiten und Risiken mit Auswirkung auf den Scope"],
            },
            {
              role: "epic_owner",
              part: "optional",
              prep: ["Neue Anforderungen oder Erkenntnisse aus seinen Epics"],
            },
            {
              duty: "art.technical",
              part: "active",
              prep: [
                "Stand der Enabler",
                "Technische Abhängigkeiten und Risiken mit Auswirkung auf den Scope",
              ],
            },
          ],
          seeAlso: ["was-liefert-was-blockiert"],
        },
        {
          key: "system-demo",
          name: "System Demo",
          cadence: "Ende jeder Iteration",
          purpose: "Das integrierte Gesamtinkrement wird gezeigt.",
          participants: [
            {
              duty: "solution.product",
              part: "lead",
              prep: [
                "Demo-Skript und Reihenfolge",
                "Abstimmung mit den Teams, was gezeigt wird",
                "Bezug zu PI Objectives und Features",
              ],
            },
            {
              role: "rte",
              part: "active",
              prep: [
                "Termin und Einladungen",
                "Integrierte Umgebung sicherstellen",
                "Feedback dokumentieren",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: ["Die PI Objectives als Bewertungsmaßstab kennen", "Feedback vorbereiten"],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: ["Prüfen, welche Epic-Hypothesen die Demo belegen soll"],
            },
            {
              duty: "art.technical",
              part: "active",
              prep: ["Integrierte Umgebung (mit dem RTE)", "Technisches Feedback und NFRs"],
            },
          ],
          seeAlso: ["ein-pi-von-anfang-bis-ende"],
        },
      ],
    },
  ],
};
