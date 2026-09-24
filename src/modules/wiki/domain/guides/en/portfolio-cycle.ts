import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Halbjahr im Portfolio“ — the English reading. The versioned long form
 * lives at `docs/concepts/portfolio-cycle-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/portfolio-cycle.ts`; `guides-parity.test.ts` holds
 * them together. What differs here is only the prose.
 */
export const PORTFOLIO_CYCLE_EN: Guide = {
  slug: "ein-halbjahr-im-portfolio",
  title: "A half-year in the portfolio",
  teaser: "Organise the round, report the need, keep the status.",
  standfirst:
    "How a budget round comes about that is worth something — and what happens in the weeks beforehand that never take place in the tool. The round is set up in two minutes; preparing it takes weeks.",
  cadence: "je_halbjahr",
  module: "budgeting",
  seeAlso: ["ein-portfolio-entsteht", "eine-idee-wird-ein-vorhaben"],

  mechanics: [
    { kind: "quote", text: "The rule that holds kanban and budget together." },
    {
      kind: "paragraph",
      text: "The kanban manages the epics; in allocation, **epics already under way take precedence**. Two directions follow from that, and each is a statement about the running cycle.",
    },
    { kind: "figure", figure: "allocationRule" },
    {
      kind: "list",
      items: [
        "**Whoever carries money stands at L2 or beyond.** Before that there is nothing to fund: in the funnel it is an idea, in the hypothesis a supposition, in analysis scheduling an intention, in the business case a calculation nobody has approved yet.",
        "**Whoever is in delivery has money.** An epic at L4.1 that got nothing in the running cycle is a gap — either in the allocation or in the data.",
      ],
    },
    {
      kind: "note",
      text: "**Where the rule bites — and where it does not.** The first direction is **enforced**: only an epic with an approved business case reaches the candidate list, and the service turns everything else away. The second direction — “whoever delivers has money” — is **checked only when generating test data**. The running application has no guard for it; keeping it is the portfolio manager's job.",
    },
    { kind: "quote", text: "Which round holds today." },
    {
      kind: "paragraph",
      text: "A round's state describes its **preparation**, not its validity. Validity is **derived**:",
    },
    {
      kind: "table",
      head: ["Validity", "When"],
      rows: [
        ["**Being worked out**", "not closed, or the period has not yet begun"],
        ["**Budget in force**", "closed **and** today falls inside the period"],
        ["**Expired budget period**", "closed, period over"],
      ],
    },
    {
      kind: "paragraph",
      text: "If today falls into **no** round, the last expired one carries on — measured, 3 to 10 days gape between two rounds, and without this rule every figure in the system would vanish for a few days several times a year.",
    },
    {
      kind: "aside",
      text: "A round covers a **half-year**. Its cycle key is **not an input field** — it is derived from the start date, and **two rounds must not begin in the same half-year**.",
    },
  ],

  perspectives: [
    {
      label: "The portfolio manager",
      role: "portfolio_manager",
      question: "How do I bring about a round that is worth something?",
      stations: [
        {
          title: "Setting up the round",
          route: "/budgeting/periods",
          body: [
            {
              kind: "paragraph",
              text: "I am responsible for the budget process being run properly. Through **new round** I create the period.",
            },
            {
              kind: "table",
              head: ["Field", "Note"],
              rows: [
                [
                  "**Period the budget applies to**",
                  "“From when to when this budget holds — not how long the preparation takes.”",
                ],
                ["**Pot (€)**", "—"],
                ["**Submission deadline**", "optional; defaults to the end of the period"],
                ["☑ **Carry the reserve over**", "the reserve of the last closed round"],
                [
                  "☑ **Carry over from the previous period**",
                  "participants, groups with their spokespeople, and the candidate list",
                ],
              ],
            },
            {
              kind: "paragraph",
              text: "Both carry-overs are pre-selected — **anyone budgeting for the second time is nearly finished here**; the rest of the setup is correction, not construction.",
            },
            {
              kind: "note",
              text: "**There is only one deadline, and it means something other than you expect.** The submission deadline is the date by which the **groups submit their distribution** — not the date for requests coming in from the value streams. There is no field for the latter; that deadline has to be set and chased outside Pulse.",
            },
          ],
        },
        {
          title: "Then the real work begins",
          body: [
            {
              kind: "paragraph",
              text: "The round is created in two minutes. What takes weeks stands beside it:",
            },
            {
              kind: "list",
              items: [
                "**Epics have to be prepared.** Whoever is not through L2 by the deadline is not in this round.",
                "**Value streams, ARTs and solutions have to define and submit their need.**",
                "**Colleagues come with questions right up to the deadline.** That is not an interruption but the reason the deadline sits before the meeting.",
              ],
            },
          ],
        },
        {
          title: "Curating the candidate list",
          route: "/budgeting/periods",
          body: [
            {
              kind: "paragraph",
              text: "In the **setup** tab, step 2: what goes to the vote — the epics put forward plus the active run-the-business items that join at the start.",
            },
            {
              kind: "paragraph",
              text: "What is offered to me satisfies **both** conditions: the marker _put forward for the next budget meeting_ **and** an approved business case.",
            },
            {
              kind: "quote",
              text: "The marker is the epic owner's registration, taking it on is my decision.",
            },
            {
              kind: "paragraph",
              text: "Two things stand there that I **cannot** change:",
            },
            {
              kind: "list",
              items: [
                "The **run-the-business items** join automatically at the start. Their sum still counts against the pot already — otherwise the figure below would mislead me.",
                "**ART epics are not on offer at all.** If the costs sit below the portfolio threshold, the ART serves the epic from its own pot. The surface says how many those are.",
              ],
            },
          ],
        },
        {
          title: "Forming the groups",
          body: [
            {
              kind: "paragraph",
              text: "Step 3: I enter the people and cut them into groups. To each group I assign one person responsible for submitting.",
            },
            {
              kind: "aside",
              text: "In Pulse that person is the **spokesperson**, not the “group lead”. Only they — or a member expressly marked as a submitter — can submit the distribution; **every** member may save.",
            },
            {
              kind: "paragraph",
              text: "Pulse checks the cut and warns: fewer than three groups, groups under four or over six people, a group without a spokesperson. **Warnings, not blocks.**",
            },
          ],
        },
        {
          title: "Preparing the meeting and starting",
          body: [
            {
              kind: "paragraph",
              text: "Most of this does not live in the tool. But two things belong to it: **the epic owners have to know they are pitching their epic** — Pulse has no surface for that, it is an arrangement. And for groups working on paper there are the **ballot sheets**, one per group.",
            },
            {
              kind: "paragraph",
              text: "On the day of the meeting I press **start the round**. That freezes the candidate list, takes the active run-the-business items along, and opens the group distribution.",
            },
            {
              kind: "aside",
              text: "The button says so when it is not allowed yet — the candidate list is empty, or no group has a member.",
            },
          ],
        },
      ],
    },

    {
      label: "The value stream owner",
      role: "value_stream_owner",
      question: "What does my value stream need, and where do I record it?",
      stations: [
        {
          title: "Gathering the need",
          body: [
            {
              kind: "paragraph",
              text: "The portfolio manager has said that budgeting needs preparing. That is my cue. I go to my solutions and ask two things:",
            },
            {
              kind: "list",
              ordered: true,
              items: [
                "**What does it take to keep the solution running?**",
                "**What is planned for developing it further?**",
              ],
            },
            {
              kind: "paragraph",
              text: "I document both myself — the solutions supply the figures, and they are recorded in **one** place.",
            },
          ],
        },
        {
          title: "Where it gets recorded",
          route: "/budgeting/value-streams",
          body: [
            {
              kind: "paragraph",
              text: "My value stream's money surface is cut by process step, not by kind of money. **Set up** carries the items to be requested — that is where I work here. **This half-year** divides up the award, **look up** shows where things landed, **budget KPIs** the coverage. Each ART has a tab of its own.",
            },
            {
              kind: "paragraph",
              text: "Per row: item · period · amount · p.a. The period is monthly, half-yearly or yearly; Pulse computes both from it — what it costs per year and how much of that goes into one round.",
            },
          ],
        },
        {
          title: "The split is the point",
          body: [
            {
              kind: "table",
              head: ["Kind", "What belongs in it"],
              rows: [
                ["**Operations**", "licences, maintenance — everything that holds what exists"],
                ["**ART pot**", "the pot for further development that the ART distributes later"],
              ],
            },
            {
              kind: "paragraph",
              text: "Mixing them would be more than a formal error: **change work would then be paid for out of the operations pot**, and four surfaces would state an untruth — the solution's grow/run tiles, the run share of the value stream, the structure of the candidate list, and the capacity guardrail.",
            },
            {
              kind: "quote",
              text: "The value stream decides in the round how large the pot is, the ART afterwards what it is for.",
            },
          ],
        },
        {
          title: "Getting the portfolio epics on their way",
          body: [
            {
              kind: "paragraph",
              text: "What I still need: the epics of my value stream that need money in this round. **They do not reach the list by themselves.** I make sure the ready epics have the marker set — without it they do not appear on the candidate list at all.",
            },
            {
              kind: "note",
              text: "**Without a closed round the pot is zero.** What I record here is the **request**, not the money. An ART's development pot carries something only once a round for this half-year has been closed and finalised.",
            },
          ],
        },
      ],
    },

    {
      label: "The product manager",
      question: "Is my product still where the system says it is?",
      stations: [
        {
          title: "The portfolio review",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "I am in the portfolio review regularly. The solutions are discussed there — and part of that is the question of whether the **classification** has shifted. If it has moved, I follow it through on the lifecycle rail.",
            },
            {
              kind: "paragraph",
              text: "**Why that counts on the beat and not as an afterthought:** the _investment by horizon_ guardrail measures the horizons of the **epics** — and they inherit theirs from their solution as long as they carry none of their own. If a solution's horizon goes untended, the guardrail measures a distribution that no longer exists, and the next budget round decides against a false picture.",
            },
            {
              kind: "aside",
              text: "When a solution moves, its already-approved epics do **not** move with it: their horizon froze with the business-case sign-off. Otherwise a single solution change would rewrite the measured balance of the past.",
            },
          ],
        },
        {
          title: "Keeping the run baseline current",
          body: [
            {
              kind: "paragraph",
              text: "Before every round I report to my value stream owner what operations will cost in the coming half-year, and what I am planning for further development.",
            },
            {
              kind: "paragraph",
              text: "In my solution's tiles I see the two against each other: **grow** from the active primary epics, **run** as operations per year — and the ratio between them.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "The deadline is the date for submitting requests.",
      why: "The submission deadline is the date for the group distribution. For requests there is no field.",
    },
    {
      claim: "An epic in the business case stage can get budget.",
      why: "Budget starts at **L2** — with an approved business case.",
    },
    {
      claim: "Pulse warns when an epic under way has no money.",
      why: "That direction is checked only when generating test data, not in the running application.",
    },
    {
      claim: "The group lead submits.",
      why: "They are called the **spokesperson**. Every member may save, only they may submit.",
    },
    {
      claim: "I enter the cycle key.",
      why: "It is derived from the start date. Two rounds must not begin in the same half-year.",
    },
    {
      claim: "The running round is the one with the state “running”.",
      why: "Validity is derived: **closed**, and today inside the period.",
    },
    {
      claim: "I record operating costs and further development together.",
      why: "Two kinds: **operations** and **ART pot**. Mixed, operations pays for the change.",
    },
    {
      claim: "The pot in the run-the-business tab is the ART's money.",
      why: "It is the **request**. Without a closed round for the half-year the pot is zero.",
    },
    {
      claim: "ART epics are on the candidate list too.",
      why: "They are expressly excluded — the ART funds them from its own pot.",
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
      who: "Value stream owner, finance party, portfolio manager / admin",
      capability: "rtb_item.manage",
    },
    {
      step: "Set the budget marker on an epic",
      who: "whoever may edit the epic",
      capability: "epic.update",
    },
    { step: "Set a group's amounts", who: "every member of the group" },
    {
      step: "Submit a group's distribution",
      who: "**only** the spokesperson or a marked submitter",
    },
    {
      step: "Follow through a solution's horizon",
      who: "Product manager, portfolio manager",
      capability: "solution.manage",
    },
  ],
};
