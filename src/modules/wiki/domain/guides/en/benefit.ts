import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Die Wirkung“ — the English reading. The versioned long form lives at
 * `docs/concepts/benefit-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/benefit.ts`; `guides-parity.test.ts` holds them
 * together. What differs here is only the prose.
 */
export const BENEFIT_EN: Guide = {
  slug: "die-wirkung",
  title: "The effect",
  teaser: "Measure the KPI, value it, roll it into the goal.",
  standfirst:
    "How a measured figure on an epic becomes a contribution to the top-level goal — and who owns which half of that sum. Told three times over: from the view of the epic owner who measures, finance who puts a value on it, and the goal owner who brings it together.",
  cadence: "je_idee",
  module: "work",
  seeAlso: ["ein-epic-reift", "ein-portfolio-entsteht"],

  mechanics: [
    { kind: "quote", text: "Two axes, and they belong to different people." },
    {
      kind: "table",
      head: ["Axis", "What it says", "Whose it is", "When it settles"],
      rows: [
        [
          "**Quantity**",
          "how far the KPI has reached its target",
          "the epic owner's",
          "freezes at **L4.2**",
        ],
        [
          "**Value**",
          "the factor that turns one unit into money",
          "finance's",
          "correctable until **L5**",
        ],
      ],
    },
    {
      kind: "paragraph",
      text: "That separation is the whole point. **Quantity** freezes with the sign-off “delivery is done”: what is built is built, and a projected remainder would be a claim without a basis. **Value** stays open because only after delivery does it show whether a unit really was worth that much — and a correction takes effect **retroactively** across the whole actual figure.",
    },
    {
      kind: "note",
      text: "**No upper cap.** Below 100 % the remainder lapses, above 100 % it counts in full. Deliver more than promised and you get credit for it.",
    },
    { kind: "quote", text: "The plan comes into being with the business-case sign-off." },
    {
      kind: "paragraph",
      text: "Before **L2** there is no plan reference: every change to the factor *is* the plan. With sign-off it is recorded, and from then on “plan against actual” is a statement rather than a tautology. The surface says so while it is missing.",
    },
    { kind: "quote", text: "The direction sits in the sign." },
    {
      kind: "paragraph",
      text: "There is **no direction field**. Whether a KPI should rise or fall follows from the sign of `target − baseline`: lead time 10 → 6 and NPS 40 → 80 both work, because the denominator carries the sign. Whoever creates a KPI enters “today” and “the target” — nothing more is needed.",
    },
    {
      kind: "note",
      text: "**A finding that belongs here.** Check-in **and** comment both hang on the same right as tending goals. So an epic owner, RTE or feature owner can neither check in nor comment on a goal — **not even on a goal their own epic contributes to.** Whether that is intended is written nowhere; the code carries no comment on it.",
    },
  ],

  perspectives: [
    {
      label: "The epic owner",
      role: "epic_owner",
      question: "By what do we measure whether my endeavour had an effect?",
      stations: [
        {
          title: "The KPI",
          anchor: "entity-tab-rail",
          body: [
            {
              kind: "paragraph",
              text: "In my epic's **KPIs** tab I set out what success hangs on: a name, a **baseline** (“today”), a **target**, a unit. I can set a weight — leave it empty for “auto”, and the KPIs then share out evenly.",
            },
            {
              kind: "paragraph",
              text: "The card then shows the actual figure large, with `baseline … → target …` beneath it and the share of the total benefit.",
            },
            {
              kind: "aside",
              text: "**All of that hangs on the epic's edit right, not on the binding right.** Keeping the KPI is authorship on your own epic.",
            },
          ],
        },
        {
          title: "The link to the goal",
          body: [
            {
              kind: "paragraph",
              text: "Only the connection turns the KPI into a contribution. It carries **two different acts in one action**, and since September 2026 Pulse tells them apart:",
            },
            {
              kind: "table",
              head: ["Act", "What it means"],
              rows: [
                [
                  "**Plain attaching**",
                  "“this endeavour pays into that goal” — part of the proposal the VMO confirms at L0 → L1",
                ],
                [
                  "**Binding a quantified contribution**",
                  "one KPI, one conversion factor, one kind of effect — this figure rolls into the goal tree and is a **commitment**",
                ],
              ],
            },
            {
              kind: "note",
              text: "**Why the separation was needed.** Before, both required the same right, and only the portfolio manager has it. An epic owner could create their epic but not say what it paid into: the surface offered them the field, and the action answered with a permission error — **after the epic already stood.**",
            },
          ],
        },
        {
          title: "Measuring",
          body: [
            {
              kind: "paragraph",
              text: "**Record a measurement** — one figure, one date. The series hangs off the KPI as a chronological list, and the card draws a small trend line from it with the last point marked.",
            },
            {
              kind: "paragraph",
              text: "What then stands in the row is the breakdown from the shared mechanics:",
            },
            {
              kind: "code",
              text: `Plan (at sign-off)       120,000 € /year
Actual (settled)         138,000 € /year · 115 %
Quantity (attainment)    +18,000 € /year
Value (conversion)             0 € /year`,
            },
            {
              kind: "paragraph",
              text: "“(settled)” appears as soon as L4.2 is signed off. While nothing has been measured it reads **“not yet measured”**. That is information, not a zero.",
            },
          ],
        },
      ],
    },

    {
      label: "Finance",
      question: "What is one unit worth, and when do I believe it?",
      stations: [
        {
          title: "The value per unit",
          body: [
            {
              kind: "paragraph",
              text: "On the goal link I record a **value per unit** in the KPI's natural unit — euros per day saved, euros per NPS point gained. From that Pulse computes both: the euro value of the current movement and, for display, the equivalent “euros per percentage point of the target gap”. Mathematically the same number, two readings.",
            },
            {
              kind: "paragraph",
              text: "Alongside it the **kind of benefit** — and for recurring benefit an interval, monthly or yearly.",
            },
            { kind: "figure", figure: "benefitKinds" },
            {
              kind: "aside",
              text: "The default preserves the old behaviour: give nothing and you get exactly what existing KPIs have always computed.",
            },
          ],
        },
        {
          title: "Signing off the impact",
          body: [
            {
              kind: "paragraph",
              text: "The last maturity step is mine alone. Until then I may correct the factor — and the correction takes effect **retroactively** across the whole actual figure. The **quantity** I can no longer move; that has stood since L4.2.",
            },
            {
              kind: "quote",
              text: "The epic owner answers for what was delivered; I answer for what it was worth.",
            },
          ],
        },
        {
          title: "The dashboard",
          route: "/portfolio/dashboard",
          body: [
            {
              kind: "paragraph",
              text: "Seven panels on one shared monthly axis — benefit velocity, cost distribution, ROI, break-even, gained value, cost analysis, and the cash-flow balance.",
            },
            {
              kind: "paragraph",
              text: "**Three rules of calculation are needed to read the curves:**",
            },
            {
              kind: "list",
              items: [
                "The **estimated costs** fall day-weighted across the delivery window **L4.1 → L4.2**. An allocation overrides them.",
                "**Go-live** = cost start + (number of cost slices × 6 months). That is where the one-off benefit lands.",
                "The **recurring benefit** runs from go-live to the end of the horizon, one twelfth of the annual figure per month.",
              ],
            },
          ],
        },
        {
          title: "The benefit waterfall",
          body: [
            {
              kind: "paragraph",
              text: "The second view of the same money, but against a goal's **target value**: how much value sits in each column today — and how much is missing to reach the target that was set? Valuation depends on **maturity**, in three bands:",
            },
            {
              kind: "table",
              head: ["Band", "Which epics", "What they count with"],
              rows: [
                ["_Estimate_", "early ones", "their estimated contribution to the target"],
                ["_Achieved + gap_", "in delivery", "the measured share, plus a dashed remainder"],
                ["_Actual_", "finished ones", "the figure actually reached"],
              ],
            },
            {
              kind: "paragraph",
              text: "The **dimension** is free to choose — maturity, value stream, ART, epic. It only decides which column an epic lands in; the actual/forecast semantics stay the same. Every amount already stands **in the goal's unit**.",
            },
          ],
        },
      ],
    },

    {
      label: "The goal owner",
      question: "Where do we stand, and what do I tell the others?",
      stations: [
        {
          title: "The check-in",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "A check-in is **one** act that records several things at once: status (on track · at risk · off track — or a close-out), progress, for manual key results the actual figure, a note, structured sections, and a **date**.",
            },
            {
              kind: "paragraph",
              text: "Beside it there is the **slim variant**: figure and date only, with no statement of status. It produces a neutral point on the graph. And the **comment**. All three run into the same activity feed.",
            },
            {
              kind: "note",
              text: "That I can choose the date matters more than it sounds: a check-in written a week late still belongs at the point it was meant for. **Otherwise every trend curve skews to the right.**",
            },
          ],
        },
        {
          title: "Where the progress comes from",
          body: [
            {
              kind: "paragraph",
              text: "That was decided at creation. What counts here is what the three sources mean in daily use:",
            },
            {
              kind: "list",
              items: [
                "**Manual** — I keep the figure. The check-in is the keeping.",
                "**From sub-goals** — a weighted average of the children. My own metric is ignored; my check-in then carries only status and note.",
                "**KPI tree** — as a leaf the goal draws its actual from the linked epic KPIs; as a branch it cascades its sub-goals' figures upwards.",
                "**Confidence vote** — fist to five. Instead of a metric I enter a level from 1 to 5; below 3 we replan. For goals that cannot be measured in a number — where an invented percentage used to stand.",
              ],
            },
            {
              kind: "paragraph",
              text: "I can **exclude** a sub-goal from the automatic roll-up — it stays visible but does not count towards the average.",
            },
          ],
        },
        {
          title: "The cascade",
          body: [
            {
              kind: "paragraph",
              text: "The conversion factor between a sub-goal and the top goal is the **unit bridge**: “1 transaction/s = €8,000”. It is **not** the same as the factor on the goal link to the epic — the confusion is built in.",
            },
            {
              kind: "code",
              text: `Measurement on the epic KPI
   × conversion factor (on the goal link)  → contribution in goal units
   × factor sub-goal → top goal            → contribution in parent units
   × weight in the roll-up                 → share of the parent goal's progress`,
            },
            {
              kind: "paragraph",
              text: "**Features and PIs linked to a goal are expressly not a contribution of value**, only a deep link. Linking something there moves no figure.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Attainment above 100 % is capped.",
      why: "There is no upper cap. Below 100 % the remainder lapses, above 100 % it counts in full.",
    },
    {
      claim: "After L4.2 the sum is finished.",
      why: "Only the **quantity**. The **value** stays correctable until L5 — and takes effect retroactively.",
    },
    {
      claim: "A KPI needs a direction setting.",
      why: "The direction sits in the sign of `target − baseline`.",
    },
    {
      claim: "Keeping KPIs requires the binding right.",
      why: "No — the epic's edit right. The binding right governs only the bridge KPI → key result.",
    },
    {
      claim: "Whoever may create an epic may also bind it to a goal.",
      why: "Attaching yes, **quantifying** no. The two have been separate since September 2026.",
    },
    {
      claim: "Plan against actual holds from the start.",
      why: "The plan reference comes into being at L2. Before that, every change to the factor *is* the plan.",
    },
    {
      claim: "Recurring benefit is always annual.",
      why: "That is the default, but monthly exists — and then the period figure counts directly per month.",
    },
    {
      claim: "A check-in always carries today's date.",
      why: "The date is free to choose and sets the point on the trend graph.",
    },
    {
      claim: "Work linked to a goal counts towards its progress.",
      why: "It is a deep link, not a contribution of value.",
    },
    {
      claim: "The epic owner can check in on their goal.",
      why: "Check-in and comment hang on the right to tend goals — which they do not hold.",
    },
  ],

  who: [
    {
      step: "Create, weight and delete a KPI",
      who: "Epic owner, portfolio manager, value stream owner (limited to their stream)",
      capability: "epic.update",
    },
    { step: "Record a measurement", who: "the same", capability: "epic.update" },
    { step: "**Attach** an epic to a goal", who: "the same", capability: "epic.update" },
    {
      step: "Bind a **quantified** contribution (factor, kind, interval)",
      who: "Portfolio manager / admin",
      capability: "kpi.bind",
    },
    { step: "Sign off the impact (L5)", who: "Finance", capability: "epic.gate.decide" },
    {
      step: "Check-in, progress, comment",
      who: "Portfolio manager / admin; value stream owner within their value stream",
      capability: "target.manage",
    },
    {
      step: "Exclude a sub-goal from the roll-up, set the team",
      who: "the same",
      capability: "target.manage",
    },
    { step: "Set custom-field **values**", who: "the same", capability: "target.manage" },
    {
      step: "Custom-field **definitions**",
      who: "Tenant admin",
      capability: "goal.custom_field.manage",
    },
  ],
};
