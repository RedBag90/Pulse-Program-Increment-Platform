import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Budget-Zeitraum“ — the English reading. The versioned long form lives
 * at `docs/concepts/budgeting-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/budgeting.ts`; `guides-parity.test.ts` holds them
 * together. What differs here is only the prose.
 */
export const BUDGETING_EN: Guide = {
  slug: "ein-budget-zeitraum",
  title: "A budget period",
  teaser: "Seven phases, four states, a median.",
  standfirst:
    "Distribute, close, finalise, freeze — a round's way from draft to a frozen budget plan. Told three times over: from the view of the portfolio manager, the group member at the ballot sheet, and finance, who sets the figures.",
  cadence: "je_halbjahr",
  module: "budgeting",
  seeAlso: ["ein-halbjahr-im-portfolio", "ein-art-epic-kommt-an-geld", "ein-epic-reift"],

  mechanics: [
    {
      kind: "paragraph",
      text: "A budget period is a **round**. It passes through seven phases across four states: draft → running → decided → closed.",
    },
    { kind: "figure", figure: "periodPhases" },
    {
      kind: "paragraph",
      text: "**The phases are stored nowhere.** They are derived from the round's state and appear as a rail above the three tabs. Whatever is locked says why.",
    },
    {
      kind: "aside",
      text: "Several rounds exist side by side — one running, one planned, several closed. There is **no tenant-wide “active cycle”**: active is the round that is running.",
    },
    { kind: "quote", text: "Three transitions carry a statement of substance." },
    {
      kind: "list",
      items: [
        "**Start the round** freezes the candidate list and takes the active run-the-business items along with it. From here the selection is fixed.",
        "**Close the distribution** ends the groups' self-distribution.",
        "**Finalise the distribution** sets the final amount per candidate, writes the budget allocation of the funded epics, computes the reserve, and freezes the state as a budget plan revision.",
      ],
    },
    {
      kind: "paragraph",
      text: "**The rules worth knowing, so as not to be caught out:**",
    },
    {
      kind: "list",
      items: [
        "**Run the business is budgeted along with everything else**, not deducted up front. An item's reference figure is its share of _this_ round.",
        "**The distribution window** is open as long as the round is running, the group has not yet submitted, and the deadline has not passed. Lose any one of those and it is over — even mid-work.",
        "**The median** of the submitting groups pre-fills the final amounts; it is **not the result**. Finance sets them.",
        "**The reserve** is the distributable pot minus the sum of the final amounts. It can be added to the next round's pot when that one is created.",
        "**Undoing is possible.** A closed round goes back to “decided”; the final amounts stay as pre-fill.",
      ],
    },
    {
      kind: "note",
      text: "**One limitation you have to know about.** The service behind _start the round_ checks only that the round is a draft. That a candidate list and a staffed group must be in place is enforced by **the interface** — through the API a round could be started with no groups at all.",
    },
  ],

  perspectives: [
    {
      label: "The portfolio manager",
      role: "portfolio_manager",
      question: "How do I bring a round about?",
      stations: [
        {
          title: "The gallery",
          route: "/budgeting/periods",
          body: [
            {
              kind: "paragraph",
              text: "Four figures at the top for the running round — period, pot, submissions, last frozen state — and below them the rounds as cards.",
            },
            {
              kind: "quote",
              text: "Each shows its phase, not just its state.",
            },
            {
              kind: "paragraph",
              text: "“Running” does not tell me whether distribution is under way or finalisation has begun. The phase does.",
            },
          ],
        },
        {
          title: "Frame and candidate list",
          body: [
            {
              kind: "paragraph",
              text: "**1 · Frame.** Pot and deadline already came from the dialogue; here I correct them, as long as the round is not running.",
            },
            {
              kind: "paragraph",
              text: "**2 · Candidate list.** I pick epics from the budget-ready pool. For each, Pulse shows the reference figure it derives from the business case. The run-the-business items sit above as a separate, collapsed section: **I cannot change them here**, they join automatically at the start, and their sum counts against the pot all the same.",
            },
            {
              kind: "quote",
              text: "As a rule the sum of the requests is well above the pot.",
            },
            {
              kind: "paragraph",
              text: "That is not a fault, **that is the reason for the whole exercise**.",
            },
          ],
        },
        {
          title: "Groups and start",
          body: [
            {
              kind: "paragraph",
              text: "**3 · Participants & groups.** The value of the procedure hangs on this cut, so Pulse checks it and warns: fewer than three groups — then the spread cannot be read —, groups under four or over six people, a group without a spokesperson, submitters spread unevenly. **Warnings, not blocks.**",
            },
            {
              kind: "paragraph",
              text: "**4 · Start the round.** Press it and the candidate list freezes, the run items join, the round moves to _running_ — and the groups get their prompt.",
            },
            {
              kind: "paragraph",
              text: "After that my work is **watching**: who has submitted and who has not, and how much each group distributed. Anyone who would rather work on paper gets the ballot sheets.",
            },
          ],
        },
      ],
    },

    {
      label: "The group member",
      question: "What am I meant to decide?",
      stations: [
        {
          title: "The prompt",
          route: "/my-tasks",
          body: [
            {
              kind: "paragraph",
              text: "My group, the period, the deadline. **The prompt disappears as soon as my group has submitted.** One click takes me to the worksheet.",
            },
          ],
        },
        {
          title: "The worksheet",
          body: [
            {
              kind: "paragraph",
              text: "Three figures at the top: **distributable · distributed · remaining**, with a bar beneath. The remainder turns red as soon as I have handed out too much.",
            },
            {
              kind: "paragraph",
              text: "Then the candidates — **not as one long list but in sections**. _Run the business_ comes first: the ongoing operation that has to carry on. After that a section per value stream, largest first, with its own total and a bar.",
            },
            {
              kind: "paragraph",
              text: "Two columns: **request** — what the candidate costs — and **my amount**. **Nothing is pre-filled**: every allocation is a decision, nothing flows by accident.",
            },
            {
              kind: "aside",
              text: "Sorting follows the request, not my entry. That is deliberate: I type, and nothing jumps around under my hands.",
            },
          ],
        },
        {
          title: "Saving and submitting",
          body: [
            {
              kind: "paragraph",
              text: "If I go over the distributable pot, Pulse tells me and still lets me **save** — but not submit. **Every member can save, only the spokesperson can submit.** After that our proposal is fixed; the window is shut.",
            },
            {
              kind: "paragraph",
              text: "It is just as shut when the deadline passes before we have submitted. What we saved up to then **counts**: finance sees our figures in the overview — but **the median is computed only from the groups that actually submitted**.",
            },
          ],
        },
      ],
    },

    {
      label: "Finance",
      question: "Where does the money go?",
      stations: [
        {
          title: "Before the round, operations are mine",
          route: "/budgeting/run-the-business",
          body: [
            {
              kind: "paragraph",
              text: "In the value stream I maintain the **run-the-business items**: name, amount, and the period the amount applies to. I can attribute each item to a solution; whatever spans value streams — the programme office, shared licences — I leave without one.",
            },
            {
              kind: "paragraph",
              text: "The header names both totals: what that costs per year, and how much of it goes into one budget round. **Active items join every round's candidate list automatically at the start.**",
            },
          ],
        },
        {
          title: "Closing and setting",
          route: "/budgeting/board",
          body: [
            {
              kind: "paragraph",
              text: "When everybody has submitted — or the deadline has passed — **I close the distribution**. The round moves to _decided_, and the groups can change nothing further.",
            },
            {
              kind: "paragraph",
              text: "Now the _result_ tab: the same sections but different columns — **request · median · final**. The median is pre-filled; **I set the figures**.",
            },
            {
              kind: "paragraph",
              text: "If the reserve goes negative I cannot proceed: the sum of the final amounts must not exceed the distributable pot.",
            },
          ],
        },
        {
          title: "Freezing",
          body: [
            {
              kind: "paragraph",
              text: "**Finalise the distribution** closes the round. A great deal happens at once, and it is worth knowing what:",
            },
            {
              kind: "list",
              items: [
                "Every candidate gets its final amount.",
                "Every funded epic gets its **budget allocation** for this half-year.",
                "The **reserve** is computed and recorded.",
                "The state is frozen as a **budget plan revision** — without my doing anything.",
              ],
            },
            {
              kind: "paragraph",
              text: "Beneath that stand the derived budgets: per value stream, split into run the business and the epics by ART. **Nobody maintains these figures** — they are the distribution, grouped differently.",
            },
            {
              kind: "aside",
              text: "If I got something wrong I undo the finalisation: the amounts stay as pre-fill, and the frozen state remains as **a record of what held at the time**. The next finalisation overwrites it.",
            },
          ],
        },
        {
          title: "The seam to the epic",
          body: [
            {
              kind: "paragraph",
              text: "The maturity step **L2 → L3** has exactly one blocking condition: budget is allocated. **That sum arises along two routes**, and which one applies depends solely on the costs against the value stream's portfolio threshold.",
            },
            {
              kind: "table",
              head: ["", "Portfolio epic", "ART epic"],
              rows: [
                ["Costs", "**above** the threshold", "**below** the threshold"],
                [
                  "Who decides",
                  "the portfolio, in a round",
                  "the value stream, through the ART pot",
                ],
                ["On the candidate list", "yes", "**no** — expressly excluded"],
              ],
            },
            {
              kind: "paragraph",
              text: "In the end both write into **the same** allocation. So for the epic the condition does not change. **Only the route there is split in two** — and with it the question of whom to ask.",
            },
            {
              kind: "note",
              text: "If a portfolio epic goes unfunded in the round it stays at L2 — **not rejected but unpaid**, and back in for the next period. An ART epic whose ART has no pot, by contrast, has **no** route at all. Pulse states this on the epic page rather than keeping quiet about it.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "The median is the result of the round.",
      why: "It is the **pre-fill** for the final amounts. Finance sets them.",
    },
    {
      claim: "A group that did not submit does not count at all.",
      why: "The saved figures stay visible. Only the **median** is computed from submitting groups alone.",
    },
    {
      claim: "Run the business is deducted from the pot up front.",
      why: "It is **budgeted along with everything else** — the items stand as candidates on the same list.",
    },
    {
      claim: "A round's phases are stored.",
      why: "They are derived from its state. Which is why no phase can drift away from reality.",
    },
    {
      claim: "There is one active cycle in the tenant.",
      why: "Active is the round that is running. Several exist side by side.",
    },
    {
      claim: "A closed round is final.",
      why: "The finalisation can be undone; the amounts stay as pre-fill.",
    },
    {
      claim: "Starting a round is guarded against empty groups.",
      why: "Only the interface enforces that. The service checks solely that the round is a draft.",
    },
    {
      claim: "My amount is pre-filled with the request.",
      why: "Nothing is pre-filled. Every allocation is a decision — nothing flows by accident.",
    },
  ],

  who: [
    {
      step: "Create a round, frame, candidate list, groups, start",
      who: "Portfolio manager / admin",
      capability: "budget.round.manage",
    },
    {
      step: "Maintain run-the-business items",
      who: "Value stream owner, the value stream's finance party, portfolio manager / admin",
      capability: "rtb_item.manage",
    },
    { step: "Set a group's amounts", who: "every member of the group" },
    { step: "Submit the distribution", who: "Spokesperson or a marked submitter" },
    {
      step: "Close, finalise and undo the distribution",
      who: "Finance / portfolio manager / admin",
      capability: "budget.manage",
    },
    {
      step: "Capture the budget plan",
      who: "the same — automatic on finalising anyway",
      capability: "budget_plan.revision.capture",
    },
    {
      step: "See a node's money tabs at all",
      who: "Admin, portfolio manager, value stream owner; RTE on **their** ART; finance party",
      capability: "budget.read",
    },
  ],
};
