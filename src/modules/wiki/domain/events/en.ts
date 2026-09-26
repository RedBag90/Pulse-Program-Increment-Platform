import type { EventCatalog } from "@/modules/wiki/domain/events";

/**
 * The events in English — a translation of `./de.ts`. Structure (levels, keys,
 * roles, parts, links) matches the German file; `events.test.ts` holds them
 * together. Only the prose differs.
 */
export const EVENTS_EN: EventCatalog = {
  title: "Which meetings it takes",
  lede: "The events at portfolio and ART level — who takes part, who leads, and what each role prepares. Each table lists only the roles involved in that event.",
  dutyLabels: {
    "solution.product": "Product Manager",
    "vs.finance": "Finance Approver",
    "vs.architecture": "Value Stream Architect Lead",
    "art.technical": "ART Technical Lead",
  },
  levels: [
    {
      key: "portfolio",
      title: "Portfolio level",
      note: "On top of these come ongoing activities around the **portfolio Kanban**, such as analysing epics and lean business cases. Those are not formal events, though.",
      events: [
        {
          key: "strategic-portfolio-review",
          name: "Strategic Portfolio Review",
          cadence: "quarterly",
          purpose:
            "Strategy, strategic themes and portfolio progress are reviewed, and decisions are made on epics.",
          participants: [
            {
              role: "portfolio_manager",
              part: "lead",
              prep: [
                "Agenda",
                "Portfolio canvas (current/target)",
                "Status of strategic themes and portfolio KPIs",
                "Portfolio Kanban with the epics awaiting a decision",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Value stream performance (flow metrics, business value, budget spend)",
                "Need for capacity or budget",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Lean business cases for go/no-go",
                "Status of running epics (MVP results, hypotheses validated or refuted, pivot/persevere recommendation)",
              ],
            },
            {
              role: "rte",
              part: "optional",
              prep: ["The ART's capacity and delivery risks", "Predictability of recent PIs"],
            },
            {
              duty: "vs.architecture",
              part: "active",
              prep: ["Architectural runway", "Enabler epics awaiting a decision"],
            },
            {
              duty: "vs.finance",
              part: "optional",
              prep: [
                "Budget spend of the value stream",
                "Financial impact of the pending epic decisions",
              ],
            },
          ],
          seeAlso: ["ein-epic-reift"],
        },
        {
          key: "portfolio-sync",
          name: "Portfolio Sync",
          cadence: "monthly",
          purpose: "Operational steering: epic delivery, budgets, dependencies and risks.",
          participants: [
            {
              role: "portfolio_manager",
              part: "lead",
              prep: [
                "Updated portfolio Kanban",
                "Actual budget against guardrails",
                "Open escalations",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Actual budget of the value stream",
                "Deviations and actions",
                "Dependencies on other value streams",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Status of their epics (progress, cost against forecast, risks)",
                "Decisions needed",
              ],
            },
            {
              role: "rte",
              part: "active",
              prep: [
                "ART status (PI progress, impediments, dependencies)",
                "Escalations the ART cannot resolve on its own",
              ],
            },
            {
              duty: "vs.finance",
              part: "active",
              prep: ["Actual budget against plan and guardrails", "Pending approvals"],
            },
          ],
          seeAlso: ["ein-halbjahr-im-portfolio"],
        },
        {
          key: "participatory-budgeting",
          name: "Participatory Budgeting",
          cadence: "every six months",
          purpose: "The budget is allocated to the value streams together.",
          participants: [
            {
              role: "portfolio_manager",
              part: "lead",
              prep: [
                "Total budget available",
                "Guardrails",
                "Prioritisation of the epics",
                "Organisation and rules of the session",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "The value stream's budget request with its rationale (planned epics, capacity, run costs)",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Pitch of the epics with lean business case, cost estimate and expected benefit",
              ],
            },
            {
              role: "rte",
              part: "optional",
              prep: ["The ART's capacity data as a plausibility check"],
            },
            {
              duty: "vs.finance",
              part: "active",
              prep: ["Budget available and already committed", "Approval rules and limits"],
            },
            {
              duty: "vs.architecture",
              part: "optional",
              prep: ["Share of enablers in the budget, with rationale"],
            },
          ],
          seeAlso: ["ein-budget-zeitraum"],
        },
      ],
    },
    {
      key: "art",
      title: "ART level",
      events: [
        {
          key: "pi-planning",
          name: "PI Planning",
          cadence: "every PI, 2 days",
          purpose:
            "All teams plan the next PI: PI objectives, dependencies, risks and the confidence vote.",
          participants: [
            {
              role: "rte",
              part: "lead",
              prep: [
                "Logistics and agenda",
                "Preparatory talks with teams and stakeholders",
                "Capacity overview",
                "Program board and tooling",
                "Check planning readiness",
              ],
            },
            {
              duty: "solution.product",
              part: "active",
              prep: [
                "Vision and roadmap",
                "Prioritised ART backlog with the top 10 features (WSJF), each with benefit hypothesis and acceptance criteria",
                "Presentation",
              ],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: [
                "Business context and goals (business context briefing)",
                "Criteria for rating the business value of the PI objectives",
              ],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: [
                "Status of the epics and the features derived from them",
                "Expectations for the next PI",
              ],
            },
            {
              role: "portfolio_manager",
              part: "optional",
              prep: ["Strategic guardrails and the relevant strategic themes"],
            },
            {
              duty: "vs.architecture",
              part: "active",
              prep: [
                "Architecture vision and cross-ART enablers",
                "Technical dependencies between ARTs",
              ],
            },
            {
              duty: "art.technical",
              part: "active",
              prep: [
                "Architecture briefing",
                "Enabler features and technical dependencies",
                "Runway for the next PI",
              ],
            },
          ],
          seeAlso: ["ein-pi-von-anfang-bis-ende"],
        },
        {
          key: "management-review",
          name: "Management Review",
          cadence: "evening of day 1 of PI Planning",
          purpose:
            "Draft plans are reviewed, and adjustments to scope, capacity or priorities are decided.",
          participants: [
            {
              role: "rte",
              part: "lead",
              prep: [
                "Consolidated draft plans",
                "Open problems, risks and dependencies of the teams",
              ],
            },
            {
              duty: "solution.product",
              part: "active",
              prep: ["Proposals for scope adjustments and reprioritisation"],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: ["Readiness to decide on trade-offs (scope, resources, dates)"],
            },
            {
              role: "epic_owner",
              part: "optional",
              prep: ["Effects of the adjustments on their epics"],
            },
            {
              duty: "vs.architecture",
              part: "optional",
              prep: ["Architecture risks in the draft plans"],
            },
            {
              duty: "art.technical",
              part: "optional",
              prep: ["Technical risks and feasibility of the adjustments"],
            },
          ],
          seeAlso: ["ein-pi-von-anfang-bis-ende"],
        },
        {
          key: "coach-sync",
          name: "ART Sync: Coach Sync",
          cadence: "weekly or every two weeks",
          purpose: "Progress, impediments and dependencies between the teams.",
          participants: [
            {
              role: "rte",
              part: "lead",
              prep: [
                "Update the program board and the ROAM list",
                "Impediment log",
                "Collect feedback from the Scrum Masters/team coaches",
              ],
            },
            {
              duty: "art.technical",
              part: "optional",
              prep: ["Integration impediments between the teams"],
            },
          ],
          seeAlso: ["was-dazwischenkommt"],
        },
        {
          key: "po-sync",
          name: "ART Sync: PO Sync",
          cadence: "weekly or every two weeks",
          purpose: "Scope, priorities and feature progress.",
          participants: [
            {
              duty: "solution.product",
              part: "lead",
              prep: [
                "Feature progress",
                "Needed changes to scope and priority",
                "Refinement status of the features for the next PI",
              ],
            },
            {
              role: "rte",
              part: "active",
              prep: ["Dependencies and risks affecting scope"],
            },
            {
              role: "epic_owner",
              part: "optional",
              prep: ["New requirements or insights from their epics"],
            },
            {
              duty: "art.technical",
              part: "active",
              prep: ["Status of the enablers", "Technical dependencies and risks affecting scope"],
            },
          ],
          seeAlso: ["was-liefert-was-blockiert"],
        },
        {
          key: "system-demo",
          name: "System Demo",
          cadence: "end of every iteration",
          purpose: "The integrated increment is shown as a whole.",
          participants: [
            {
              duty: "solution.product",
              part: "lead",
              prep: [
                "Demo script and running order",
                "Agree with the teams what will be shown",
                "Link to PI objectives and features",
              ],
            },
            {
              role: "rte",
              part: "active",
              prep: ["Date and invitations", "Ensure an integrated environment", "Record feedback"],
            },
            {
              role: "value_stream_owner",
              part: "active",
              prep: ["Know the PI objectives as the yardstick", "Prepare feedback"],
            },
            {
              role: "epic_owner",
              part: "active",
              prep: ["Check which epic hypotheses the demo is meant to support"],
            },
            {
              duty: "art.technical",
              part: "active",
              prep: ["Integrated environment (with the RTE)", "Technical feedback and NFRs"],
            },
          ],
          seeAlso: ["ein-pi-von-anfang-bis-ende"],
        },
      ],
    },
  ],
};
