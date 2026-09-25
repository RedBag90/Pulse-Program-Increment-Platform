import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Was liefert, was blockiert“ — the English reading. The versioned long form
 * lives at `docs/concepts/delivery-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/delivery.ts`; `guides-parity.test.ts` holds them
 * together. What differs here is only the prose.
 */
export const DELIVERY_EN: Guide = {
  slug: "was-liefert-was-blockiert",
  title: "What delivers, what blocks",
  teaser: "Delivery status, WSJF, dependencies.",
  standfirst:
    "Daily life in the cockpit: the running order, the status, and whatever gets in the way. The beat sets the frame — this is what happens **inside** it day to day, and the three surfaces built for it.",
  cadence: "je_pi",
  module: "drumbeat",
  seeAlso: ["ein-pi-von-anfang-bis-ende", "was-dazwischenkommt", "ein-epic-reift"],

  mechanics: [
    { kind: "quote", text: "A feature's typewriter." },
    { kind: "figure", figure: "deliveryChain" },
    {
      kind: "paragraph",
      text: "**The way back out of _blocked_ is the point.** Being blocked is neither a blemish nor a dead end. And there are **two** endings: _cancelled_ is a decision, not a defeat.",
    },
    {
      kind: "paragraph",
      text: "The feature owner sets this status themselves. It is the **one place where something is contributed daily** — and the figure everything else is derived from: the epic's progress, the ART's load, the question of whether the PI can close.",
    },
    { kind: "quote", text: "Three surfaces for the same features." },
    {
      kind: "table",
      head: ["Surface", "What it is built for"],
      rows: [
        [
          "**Delivery cockpit**",
          "Board, table, schedule and network on one surface. The workplace. ART and PI are **cuts**, not places of their own.",
        ],
        [
          "**Features overview**",
          "Every feature within reach — across value streams, ARTs and PIs. The search for when you do not know where something is stuck.",
        ],
        [
          "**Dependencies**",
          "Every dependency across PIs; cross-ART and critical path are visible straight away.",
        ],
      ],
    },
    {
      kind: "aside",
      text: "The first two show the same thing from two sides: the cockpit **inside** one train, the overview **across** all of them.",
    },
    {
      kind: "note",
      text: "**The three parties hold almost identical rights.** The difference is not reach but direction of view: the feature owner their backlog, the RTE their ART, the portfolio manager the portfolio.",
    },
  ],

  perspectives: [
    {
      label: "The feature owner",
      role: "feature_owner",
      question: "What do I build next, and how do I know?",
      stations: [
        {
          title: "The running order is my statement",
          route: "/umsetzung",
          anchor: "cockpit-table",
          body: [
            {
              kind: "paragraph",
              text: "WSJF — **weighted shortest job first**. Four numbers, one division:",
            },
            {
              kind: "code",
              text: `        Business Value + Time Criticality + Risk Reduction
WSJF =  ─────────────────────────────────────────────────
                          Job Size`,
            },
            {
              kind: "paragraph",
              text: "The dialogue carries exactly those four fields; the result is computed to two decimal places. **If one of the four is empty there is no score** — the pill then reads “Score” instead of a number.",
            },
            {
              kind: "note",
              text: "**The same result, two bands.** The computed value is sorted into high/medium/low — but with **different thresholds** depending on where you look: the cockpit uses ≥ 8 / ≥ 4, the ART feature lists ≥ 5 / ≥ 2. That is deliberate, and it is laid out as a **difference in data**, not as two implementations. Anyone comparing bands across the two surfaces is still comparing different things.",
            },
            {
              kind: "aside",
              text: "WSJF is a **practice** of its own. Turn it off and the columns disappear — the numbers stay where they are, only nobody looks at them any more.",
            },
          ],
        },
        {
          title: "Delivering",
          route: "/umsetzung",
          anchor: "cockpit-view-tabs",
          body: [
            {
              kind: "paragraph",
              text: "I set the status myself, one at a time or **in bulk**. Every change is recorded.",
            },
            {
              kind: "table",
              head: ["Status", "What I am saying"],
              rows: [
                ["_Open_", "planned, not started yet"],
                ["_In delivery_", "being worked on right now"],
                ["_Blocked_", "it cannot go on at the moment — **not a blemish, a signal**"],
                ["_Done_", "finished"],
                ["_Cancelled_", "we are not doing it"],
              ],
            },
          ],
        },
        {
          title: "What I notice, I report",
          route: "/issues",
          anchor: "issue-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Whatever holds us up goes into the shared register as a **concern** — risks and blockers live there together. **Every role may report**, down to the read-only one.",
            },
            {
              kind: "paragraph",
              text: "What becomes of it is somebody else's decision; all that counts here: **a reported concern that nobody has classified turns up again at the PI close.**",
            },
          ],
        },
      ],
    },

    {
      label: "The RTE",
      role: "rte",
      question: "Who is waiting on whom?",
      stations: [
        {
          title: "Dependencies are a practice of their own",
          route: "/dependencies",
          anchor: "dependencies-funnel",
          body: [
            {
              kind: "paragraph",
              text: "Here they lie across every PI, with **cross-ART** and **critical path** visible straight away. Four actions, and they are deliberately not the same thing:",
            },
            {
              kind: "table",
              head: ["Action", "What it does"],
              rows: [
                ["**Create**", "a new dependency as an object of its own"],
                ["**Link**", "attach an existing one to a work item"],
                ["**Change type**", "blocks · depends on · relates to"],
                ["**Unlink**", "one at a time or in bulk — **a right of its own**"],
              ],
            },
            {
              kind: "note",
              text: "**Why unlinking is a right of its own.** Tying a dependency adds knowledge; untying it **overturns somebody else's planning assumptions**. Whoever set it was relying on it. That is why unlinking sits under its own capability — even though the same three roles carry it by default.",
            },
            {
              kind: "aside",
              text: "Dependencies are a practice of their own too. Turn it off and the surface disappears.",
            },
          ],
        },
        {
          title: "Assigning responsibility without changing the content",
          body: [
            {
              kind: "paragraph",
              text: "Assigning a feature owner is **an action of its own** rather than a use of the edit right — and the reason is written in the code: epic owners and value stream leads must not change a feature's **content**, but should be able to assign **responsibility** for it.",
            },
            {
              kind: "paragraph",
              text: "The role model has no inheritance, which is why “epic owner and above” is written out in full: portfolio manager, RTE, feature owner and epic owner unscoped, the value stream owner limited to their own stream — the same construction as on the epic.",
            },
          ],
        },
      ],
    },

    {
      label: "The portfolio manager",
      role: "portfolio_manager",
      question: "Where is it stuck, and what does that mean for the epics?",
      stations: [
        {
          title: "The view across",
          route: "/implementation/features",
          body: [
            {
              kind: "paragraph",
              text: "Every feature across value streams, ARTs and PIs — with WSJF columns as long as the practice is on. This is the surface for “where is X actually stuck?” when you do not know the train.",
            },
          ],
        },
        {
          title: "What the status moves upwards",
          body: [
            {
              kind: "paragraph",
              text: "I rarely set anything here myself. What interests me is the **derivation**:",
            },
            {
              kind: "list",
              items: [
                "The maturity step **L4 → L4.2** of an epic has an **advisory** criterion: every child feature is done. Advisory, not blocking — the request can be filed earlier, and then the outstanding number stands beside it and the approvers decide.",
                "An **ART's load** follows from the job size of the features planned into it. That is the one place where WSJF numbers do something other than sort.",
                "An **open concern without ROAM** holds up the PI close in the end — as a warning in the interface, as a block through the API.",
              ],
            },
          ],
        },
        {
          title: "Deleting",
          body: [
            {
              kind: "paragraph",
              text: "The delete right sits with portfolio managers, RTEs and tenant admins — **not** with the feature owner.",
            },
            {
              kind: "quote",
              text: "Whoever creates and tends something does not decide alone that it disappears.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "“Blocked” is a dead end.",
      why: "The way back into delivery stands open — the double arrow is deliberate.",
    },
    {
      claim: "“Cancelled” means failed.",
      why: "It is a decision. Two endings, not one.",
    },
    {
      claim: "A WSJF band means the same thing everywhere.",
      why: "Cockpit ≥ 8 / ≥ 4, ART lists ≥ 5 / ≥ 2. The same score, two classifications.",
    },
    {
      claim: "The cockpit's ART view is a page of its own.",
      why: "It is a **cut** through the same surface. The old routes redirect there.",
    },
    {
      claim: "There is a feature QA step.",
      why: "The approval loop was removed in June 2026; “acceptance” is a text field today.",
    },
    {
      claim: "As a feature owner I can delete any feature.",
      why: "Only in **your** ARTs. The delete right is ART-scoped — as are creating and editing.",
    },
    {
      claim: "Assigning responsibility is part of the edit right.",
      why: "It is an action of its own — assigning **without** changing content is the whole point.",
    },
    {
      claim: "Unlinking a dependency is as harmless as setting one.",
      why: "It overturns somebody else's planning assumptions. Hence a right of its own.",
    },
    {
      claim: "Without the WSJF practice the numbers are gone.",
      why: "They stay stored. Only the columns disappear.",
    },
  ],

  who: [
    {
      step: "Create and sharpen a feature, acceptance criteria",
      who: "Portfolio manager, RTE, feature owner",
      capability: "feature.create",
    },
    { step: "Score WSJF", who: "the same", capability: "feature.wsjf.set" },
    { step: "Assign to a PI", who: "the same", capability: "feature.update" },
    {
      step: "Set the delivery status, singly and in bulk",
      who: "the same",
      capability: "feature.delivery.set",
    },
    {
      step: "Assign responsibility",
      who: "the same **plus epic owner**; value stream owner limited to their own stream",
      capability: "feature.owner.assign",
    },
    {
      step: "Delete a feature",
      who: "Portfolio manager, tenant admin; **RTE** and **feature owner** on their own ARTs",
      capability: "feature.delete",
    },
    {
      step: "Create, link and retype a dependency",
      who: "Portfolio manager, RTE, feature owner",
      capability: "dependency.link",
    },
    { step: "Unlink a dependency", who: "the same", capability: "dependency.unlink" },
  ],
};
