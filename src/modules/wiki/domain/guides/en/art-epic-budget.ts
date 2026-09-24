import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein ART-Epic kommt an Geld“ — the English reading. The versioned long form
 * lives at `docs/concepts/art-epic-budget-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/art-epic-budget.ts`; `guides-parity.test.ts` holds
 * them together. What differs here is only the prose.
 */
export const ART_EPIC_BUDGET_EN: Guide = {
  slug: "ein-art-epic-kommt-an-geld",
  title: "An ART epic gets its money",
  teaser: "Pot, allocation, ceiling.",
  standfirst:
    "An ART epic waits for no budget round. It appears on no candidate list — not rejected, but at home somewhere else. The second route to money, told three times over: from the view of the epic owner, the product manager, and the value stream owner where the pot comes from.",
  cadence: "je_halbjahr",
  module: "budgeting",
  seeAlso: ["ein-budget-zeitraum", "ein-epic-reift"],

  mechanics: [
    {
      kind: "paragraph",
      text: "There are four things to know, and three of them come as a surprise.",
    },
    { kind: "quote", text: "The pot is not operating money." },
    {
      kind: "paragraph",
      text: "The ART pot is kept like a run-the-business item but carries a **kind of its own** — deliberately separate, so that growth money is not reported as operations. **Operating money never funds an epic.** Anyone asking about “the remaining run-the-business budget” is asking about the wrong figure.",
    },
    {
      kind: "paragraph",
      text: "Like every other item, the pot goes through the candidate list of a half-year round. What is finalised there **is** the pot. **Without a closed round for this half-year it is zero**, even when the item itself is maintained.",
    },
    { kind: "quote", text: "The pot holds per half-year and does not travel." },
    {
      kind: "paragraph",
      text: "Allocation happens in the **current or the next** half-year, never retroactively. Past ones are locked, and Pulse says why: the allocation history stays immovable.",
    },
    {
      kind: "aside",
      text: "A remainder from the last cycle is **not available money** — it neither lapses nor travels; it is reported, and it is the basis for the conversation about the next pot.",
    },
    { kind: "quote", text: "First the allocation, then the request." },
    {
      kind: "paragraph",
      text: "The step **L2 → L3** has exactly one criterion, and it is **blocking**: the allocated sum is greater than zero. Otherwise the request fails at creation, not at sign-off.",
    },
    {
      kind: "paragraph",
      text: "That is not an oversight but a decision: the investment call should be **a step of its own, requested deliberately**, and not the side effect of a budget allocation. Which is why sign-off approves no money — **it establishes that money is there.**",
    },
    { kind: "quote", text: "Allocated is allocated." },
    {
      kind: "paragraph",
      text: "The model has no in-between state of “earmarked but not yet in force”: the row on the ART comes into being, the remaining pot drops at once, and the epic shows the same sum a budget round would have written.",
    },
    { kind: "quote", text: "The pot also pays for work without an epic." },
    {
      kind: "paragraph",
      text: "An ART does not deliver only epic features. Whatever hangs on no epic is paid from the pot as well — for that the distribution list carries **one** row: “ART's own work (no epic)”. The RTE puts a figure on it once per half-year; individual features are **not** budgeted.",
    },
    {
      kind: "aside",
      text: "Beside it stands a **reference figure**: the planned standalone feature load times this ART's € rate. It is an estimate and is never pre-filled — with no rate on file it reads “—”. If it exceeds the open pot, Pulse says so; nobody is stopped.",
    },
  ],

  perspectives: [
    {
      label: "The epic owner",
      role: "epic_owner",
      question: "How do I get hold of the money I need?",
      stations: [
        {
          title: "The classification has happened",
          body: [
            {
              kind: "paragraph",
              text: "My business case is approved, the epic sits at **L2**. With that sign-off something happened that was not possible before: Pulse added up the cost slices and held them against my value stream's portfolio threshold — mine come in below it, so my endeavour is an **ART epic**.",
            },
            {
              kind: "paragraph",
              text: "What that means shows immediately: **I do not appear on the candidate list of the next budget round at all.** I am waiting for no round. My money is elsewhere.",
            },
          ],
        },
        {
          title: "My first step is a tick-box",
          body: [
            {
              kind: "paragraph",
              text: "In the overview I tick **put forward for the next budget meeting**. On a portfolio epic that box signs up for a round; **on mine it does something else** — it opens my epic on my ART's distribution list.",
            },
            {
              kind: "paragraph",
              text: "Without it there is no row for anybody to enter an amount into. It is the one action in this section that rests with me.",
            },
          ],
        },
        {
          title: "Then I have to ask",
          body: [
            {
              kind: "paragraph",
              text: "On my epic page I can see **whether** a pot exists for my ART at all — if there is none, Pulse tells me plainly rather than letting me find out by waiting. **How much of it is free I cannot see.**",
            },
            {
              kind: "quote",
              text: "Money belongs at the node, not at the epic.",
            },
            {
              kind: "paragraph",
              text: "Those who can tell me are the **value stream owner**, the **finance party**, the **RTE** — who sees their ART's pot — or **portfolio management**. And the **product manager** of my primary solution, who does not merely inform me but may allocate.",
            },
          ],
        },
        {
          title: "Requesting L3 — only now",
          body: [
            {
              kind: "paragraph",
              text: "Once the amount is entered I request **budget allocated**. Before that the request would not have left the building; the criterion blocks. Sign-off comes from **two** sides — my value stream's VMO and the finance party.",
            },
            {
              kind: "paragraph",
              text: "The rest is the same path as for any other epic: assign features to PIs — that is an action in the cockpit, **not a consequence of a sign-off** — and request **L4.1**.",
            },
          ],
        },
      ],
    },

    {
      label: "The product manager",
      question: "What happens to my product, and can I do anything about it?",
      stations: [
        {
          title: "A field, not a role",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "I am recorded on a solution as its product manager. **That is not a role but a person field** — product responsibility does not coincide with a SAFe role, and who carries it is a question for the organisation, not for the permission model.",
            },
            {
              kind: "paragraph",
              text: "Three things follow: I may edit my solution, I countersign sign-offs — and **I may allocate the money for it**.",
            },
          ],
        },
        {
          title: "Allocating, but only for my epics",
          body: [
            {
              kind: "paragraph",
              text: "From the ART's pot, but **only to my solution's epics**. The pot belongs to the ART, responsibility for the individual endeavour to me; which is why this right hangs **on the epic, not on the pot**.",
            },
            {
              kind: "paragraph",
              text: "Were it on the pot, I would get a say over other people's endeavours in the same ART merely because they happen to sit next to mine.",
            },
            {
              kind: "paragraph",
              text: "So on the distribution surface I see **every** row but can operate my own. On the others the amount stands as text — **an input field that refuses on save would be the poorer answer.**",
            },
            {
              kind: "aside",
              text: "The tab opens to me at all only on those ARTs where at least one put-forward epic of my solution is waiting for money. Where I can do nothing, I do not see the pot either.",
            },
            {
              kind: "quote",
              text: "Responsibility without the means to act would be an empty label.",
            },
          ],
        },
      ],
    },

    {
      label: "The value stream owner",
      role: "value_stream_owner",
      question: "Is the money I have enough for what is coming?",
      stations: [
        {
          title: "The pot comes into being with me",
          route: "/budgeting/value-streams",
          body: [
            {
              kind: "paragraph",
              text: "In the _set up_ tab I create **one item per ART** with the kind _ART pot_. It takes the same path as any run-the-business item: it becomes a candidate on the half-year round's list, and what gets finalised there is the pot.",
            },
            {
              kind: "note",
              text: "**If I create none for an ART, every ART epic of that ART has no route to money**: it is not on the candidate list and has no pot. The way out is either a pot — or the deliberate statement that this endeavour, despite its size, stays a portfolio matter.",
            },
          ],
        },
        {
          title: "Distribution happens at the ART",
          route: "/budgeting/value-streams",
          body: [
            {
              kind: "paragraph",
              text: "**Each ART has a tab of its own** — its name sits in the rail, and beside it what is left of its pot. There I find the three figures **ART pot, allocated from the pot, pot remaining**, and beneath them the distribution list: the put-forward ART epics with their reference figure — **which freezes on the first allocation**, or else the list would shift between two visits, chasing the business case, without anybody having done a thing.",
            },
            {
              kind: "paragraph",
              text: "Two limits hold me, and **the write path checks both in the same transaction**, not just the interface:",
            },
            {
              kind: "list",
              items: [
                "**The pot is the ceiling.** Whatever no longer fits stays visibly uncovered. There is no quota and no distribution key — whoever goes empty-handed does so because the money has run out.",
                "**The half-year is locked or open.** Current and next yes, past ones no.",
              ],
            },
          ],
        },
        {
          title: "Who else distributes — and what I do not decide",
          body: [
            {
              kind: "paragraph",
              text: "Besides me, my value stream's **finance party** — without needing a role for it — and **portfolio management**. Plus a solution's **product manager**, but only for that solution's own epics.",
            },
            {
              kind: "paragraph",
              text: "**And the ART's own RTE**, on their own ART. They distribute the pot but do not **set** it — how large it is I decide when splitting the award. They divide up what I have given them.",
            },
            {
              kind: "quote",
              text: "And I do not countersign.",
            },
            {
              kind: "paragraph",
              text: "At L3 stand the VMO and the finance party; the investment call is theirs, not mine. **I provide the money and allocate it — governance decides on the maturity step.**",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "I request L3 so that the budget gets approved.",
      why: "The other way round. L3 **presupposes** the allocation — it is the step's single, blocking criterion.",
    },
    {
      claim: "I ask the solution manager.",
      why: "There is no such role. The nearest thing is a solution's **product manager** — a field, not a role.",
    },
    {
      claim: "I ask how much run-the-business budget is left.",
      why: "Wrong figure. The ART pot is a kind of its own; operating money never funds an epic.",
    },
    {
      claim: "The money comes from the last budget cycle.",
      why: "The pot holds per half-year and does not travel. Past half-years are locked.",
    },
    {
      claim: "The budget is reserved.",
      why: "There is no in-between state. Allocated is allocated, and the remainder drops at once.",
    },
    {
      claim: "With L4.1 the features move into the next PI.",
      why: "No sign-off touches the features. A feature must _already_ sit in a PI to be startable.",
    },
    {
      claim: "The RTE can give their ART a bigger pot when it does not stretch.",
      why: "Distribute yes, enlarge no. The size of the pot arises at the value stream and is finalised in the half-year round.",
    },
  ],

  who: [
    {
      step: "Create the ART pot",
      who: "Value stream owner, portfolio management; finance party through the seam",
      capability: "rtb_item.manage",
    },
    {
      step: "Finalise the pot on the candidate list",
      who: "Finance, when closing the round",
      capability: "budget.manage",
    },
    { step: "Put an epic forward", who: "Epic owner", capability: "epic.update" },
    {
      step: "See the free pot",
      who: "Tenant admin, portfolio manager, value stream owner; RTE on their ART; finance party; product manager on their ARTs",
      capability: "budget.read",
    },
    {
      step: "Allocate from the pot",
      who: "Value stream owner, portfolio management; **RTE** on their own ART; finance party; **product manager** for their solution's epics",
      capability: "art_budget.distribute",
    },
    { step: "Request L3 and L4.1", who: "Epic owner", capability: "epic.gate.request" },
    { step: "Sign off L3", who: "The value stream's VMO **and** finance party" },
    { step: "Sign off L4.1", who: "VMO; on ART epics the product manager as well" },
  ],
};
