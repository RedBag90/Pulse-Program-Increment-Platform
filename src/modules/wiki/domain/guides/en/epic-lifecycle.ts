import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Epic reift“ — the English reading. The versioned long form lives at
 * `docs/concepts/epic-lifecycle-walkthrough.md` and stays German.
 *
 * The longest procedure in the wiki, and the only one that runs the same
 * stretch three times in full. Which is exactly why it stands here as **one**
 * guide with three perspectives and not as three: the hand-overs are the point.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/epic-lifecycle.ts`; `guides-parity.test.ts` holds them
 * together. What differs here is only the prose.
 */
export const EPIC_LIFECYCLE_EN: Guide = {
  slug: "ein-epic-reift",
  title: "An epic matures",
  teaser: "Eight steps, eight gates, five parties.",
  standfirst:
    "The same run-through, told three times over: from the view of the epic owner who drives it, the portfolio manager who steers and signs it off, and finance who countersigns the money and the benefit. Using the names Pulse actually uses.",
  cadence: "je_idee",
  module: "work",
  seeAlso: ["eine-idee-wird-ein-vorhaben", "die-wirkung", "ein-art-epic-kommt-an-geld"],

  mechanics: [
    {
      kind: "paragraph",
      text: "An epic passes through **eight steps**. Each one moves because somebody **requests** it and named people **sign it off** — configurable per value stream and gate.",
    },
    { kind: "figure", figure: "gateLadder" },
    {
      kind: "paragraph",
      text: "Before the request Pulse shows a checklist: which criteria are met and which are missing. On requesting, that checklist is **frozen** and carried on the request row — so that it stays traceable later what the approval was given against.",
    },
    {
      kind: "paragraph",
      text: "Two of these steps also carry a **statement of substance**:",
    },
    {
      kind: "list",
      items: [
        "Signing off **L0 → L1** is the approval of the **benefit hypothesis**.",
        "Signing off **analysis → L2** is the approval of the **lean business case**.",
      ],
    },
    {
      kind: "paragraph",
      text: "That same sign-off settles a third thing: **the classification of the epic** as a portfolio or an ART epic comes into being with it. Before that it does not exist — and so before that it cannot govern anything.",
    },
    {
      kind: "quote",
      text: "Approving and advancing are one act: one request, one sign-off, one statement.",
    },
    {
      kind: "paragraph",
      text: "While a request is open the text being decided on is **locked** — the approvers should not be looking at something that changes underneath them.",
    },
    {
      kind: "aside",
      text: "Seven of the eight rungs are requested this way. One is purely **derived**: _L4.1 delivery under way_ means “in delivery, but not yet confirmed done”. And two steps carry no number on the epic at all: _selected for analysis_ leaves it at L1, _L4.2 delivery done_ at L4 — they are requested and signed off like any other, but leave a stamp instead of a maturity level.",
    },
    { kind: "quote", text: "Who the three are." },
    {
      kind: "table",
      head: ["Who", "Where their reach comes from"],
      rows: [
        ["**Epic owner**", "the role, plus being recorded as owner on the epic."],
        [
          "**Portfolio manager / VMO**",
          "the role — the consolidated portfolio lead. The **VMO seat** in the gate policy is separate from it: the value stream names, per stream, the person who gets the sign-off rows.",
        ],
        [
          "**Finance**",
          "**Not a role.** The value stream names the person; from that follow their sign-off seats and the right to maintain that stream's run-the-business items.",
        ],
      ],
    },
  ],

  perspectives: [
    {
      label: "The epic owner",
      role: "epic_owner",
      question: "How do I get my endeavour through?",
      stations: [
        {
          title: "From the goal to the idea",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "I look at a top goal and recognise an endeavour that pays into it. I create it as an epic and link it to the goal — through the KPI chain Pulse works out later how much my epic contributes to that goal.",
            },
            {
              kind: "paragraph",
              text: "The epic then sits at **L0 · idea** in the funnel. The timeline in the _maturity timeline_ tab gets its first entry.",
            },
          ],
        },
        {
          title: "Working out the hypothesis",
          anchor: "entity-tab-rail",
          body: [
            {
              kind: "paragraph",
              text: "I am recorded as the owner — so the work of making it concrete is mine. In the _hypothesis_ tab I write the benefit hypothesis: expected benefit, the assumption behind it, leading indicators, risks. In the _overview_ I classify the epic: business or enabler, plus the horizon.",
            },
            {
              kind: "paragraph",
              text: "Alongside that I enter a first pass in the timeline tab, one estimated date per phase. It is rough — but **two of those estimates are more than a note**: from “delivery started” and “delivery done” Pulse derives the planned time window.",
            },
          ],
        },
        {
          title: "L0 → L1 · The hypothesis is approved",
          anchor: "epic-lifecycle-stepper",
          body: [
            {
              kind: "paragraph",
              text: "Once the hypothesis is worked out I request the step. **From the moment the request is filed the text is locked.** The VMO agrees — and with that single act the hypothesis is approved **and** the epic sits at L1.",
            },
            {
              kind: "paragraph",
              text: "If they refuse with reasons, the epic stays at L0 and the text is free again. If I have changed my mind, I withdraw my own request.",
            },
          ],
        },
        {
          title: "Money for making it concrete",
          body: [
            {
              kind: "paragraph",
              text: "Making it concrete needs money, and it comes from the same budget round as everything else — **one per half-year**. My epic reaches the candidate list with the approved hypothesis already: Pulse then applies a tenant-wide configured default effort as the reference figure, roughly what working out the business case costs.",
            },
            {
              kind: "paragraph",
              text: "In the overview I tick **put forward for the next budget meeting**. The round decides, I get the money, and I request **L1 → analysis**.",
            },
            {
              kind: "aside",
              text: "Sitting at L2 _is_ “business case in progress” — there is no subdivision here.",
            },
          ],
        },
        {
          title: "The business case",
          body: [
            {
              kind: "paragraph",
              text: "Now the actual work, spread across four tabs:",
            },
            {
              kind: "list",
              items: [
                "_Deliverables_ — I cut the end products into features.",
                "_Dependencies_ — I attach the dependencies.",
                "_KPI & benefit_ — baseline, target, unit; together with finance the value per unit and the kind of benefit, one-off or ongoing.",
                "_Concerns_ — what could become dangerous to me, scored by likelihood × impact.",
              ],
            },
            {
              kind: "paragraph",
              text: "**The baseline is a field I set here**, not an act at some later point. If I get stuck I tick _I need help_ on the gate card — the one place in the procedure where I ask for support instead of requesting something.",
            },
          ],
        },
        {
          title: "Analysis → L2 · Five parties sign",
          body: [
            {
              kind: "paragraph",
              text: "When requesting I fill the five seats: **architect lead, business owner, finance, IRT owner and LACE/VMO**. Four of them are pre-filled from the value stream's governance — only the IRT owner do I name myself. Pre-filled means pre-filled: I can override any of them.",
            },
            {
              kind: "paragraph",
              text: "If my epic's primary solution has a named **product manager**, they countersign as a sixth: the endeavour changes their product. If none is named, they drop out **silently** — the request runs as before.",
            },
            {
              kind: "note",
              text: "**A dialogue may intervene before I send it.** At creation I recorded what I was expecting. If the classification derived from the costs differs from that, Pulse tells me before the request goes out: “created as …, the costs make it a …”. If the costs are above the portfolio limit, the request itself switches the classification to portfolio epic — an ART budget could not carry it. If a portfolio epic comes in below the limit, it may stay a portfolio matter, with a reason.",
            },
            {
              kind: "paragraph",
              text: "Every approval takes a **snapshot** of the approved text. If I need a second attempt, the epic is demoted with reasons — only portfolio management can do that — I rework it and request again. This time the approvers see a **comparison**: what stood there last, what stands there now.",
            },
          ],
        },
        {
          title: "With the approval the classification comes into being",
          body: [
            {
              kind: "paragraph",
              text: "Before that my epic read “not yet classified” — and that was not a gap but the truth: without an approved business case there is no costing that holds, and without one it is not settled how large the endeavour is.",
            },
            {
              kind: "list",
              items: [
                "**above** → portfolio epic. It takes the familiar route via a budget round's candidate list.",
                "**below** → ART epic. It is **not** on the candidate list but is served from my ART's pot.",
              ],
            },
            {
              kind: "paragraph",
              text: "The exception is called an **override**: whoever holds it can declare that an epic stays a portfolio matter although its costs sit below the line — with reasons. **The reverse is not possible.** Whatever sits above the threshold needs a portfolio decision, and an ART's pot could not carry it anyway.",
            },
          ],
        },
        {
          title: "The route to the money",
          body: [
            {
              kind: "paragraph",
              text: "**If my epic is a portfolio epic**, it stands on the candidate list with its approved business case, and the reference figure is now the sum of the cost slices from the BC instead of the default. The round discusses, decides, allocates.",
            },
            {
              kind: "paragraph",
              text: "**If it is an ART epic**, I wait for no round. It does not appear on the candidate list at all; instead it stands for distribution in my ART's budget tab. Distribution happens in the current or the next half-year, **not retroactively**.",
            },
            {
              kind: "note",
              text: "If my ART has no pot, my epic has **no** route to money. Pulse says so on the epic page rather than letting me find out by waiting.",
            },
            {
              kind: "paragraph",
              text: "**I cannot see the free amount:** the money tabs carry a right of their own, and it sits above the epic owner. What I can see is **whether** there is a pot at all. The rest is a conversation, and that is deliberate.",
            },
          ],
        },
        {
          title: "L2 → L3 · The investment decision",
          body: [
            {
              kind: "quote",
              text: "First the allocation, then the request.",
            },
            {
              kind: "paragraph",
              text: "The order is the one people easily expect the other way round. **Approving L3 approves no money; it establishes that money is there.** One blocking criterion: the allocated sum is greater than zero.",
            },
            {
              kind: "paragraph",
              text: "Both routes — budget round and ART pot — write into the same sum; so for this step it makes no difference where the money came from. With the sign-off Pulse stamps approver and date onto the epic.",
            },
          ],
        },
        {
          title: "L3 → L4.1 · Plan feature delivery",
          body: [
            {
              kind: "paragraph",
              text: "I assign my features to PIs and request the start. There is one criterion — at least one feature has started — but it does not block: **the request itself _is_ the deliberate start**.",
            },
            {
              kind: "aside",
              text: "**On naming:** the ladder knows **L4.1** and **L4.2** — nowhere a bare “L4”. The main gate spanning both sub-rungs is still called L4 in the funnel rail and the kanban; there, though, it is a **column**, not a step.",
            },
            {
              kind: "paragraph",
              text: "Assigning to a PI is not a consequence of this sign-off but its **precondition**: a feature can only be started once it sits in a PI. At the start of delivery I record the first measurement per KPI — that begins the series.",
            },
          ],
        },
        {
          title: "L4 → L4.2 · Delivery done",
          body: [
            {
              kind: "paragraph",
              text: "One criterion reminds us that every child feature ought to be finished — but it does not hold the request up: **that delivery is done is established by the sign-off, not by the counter.**",
            },
            {
              kind: "quote",
              text: "With it the quantity delivered is settled too.",
            },
            {
              kind: "paragraph",
              text: "If my success KPI stands at 70 %, then it is 70 % — the rest is not extrapolated, because **built is built**. If it is above 100 %, it counts in full. Later measurements no longer move the quantity; what can still change after that is its _value_, and finance answers for that.",
            },
          ],
        },
        {
          title: "L4.2 → L5 · And then I wait",
          body: [
            {
              kind: "paragraph",
              text: "“Finished building” is not “benefit demonstrated”, and any amount of time may lie between the two. At some point controlling sees in the report that the bottom line has moved, and says so.",
            },
            {
              kind: "paragraph",
              text: "I request the last step; the precondition is confirmed delivery. The sign-off sets the impact stamp — and only with that is the circle back to the top goal from the beginning closed.",
            },
          ],
        },
      ],
    },

    {
      label: "The portfolio manager",
      role: "portfolio_manager",
      question: "Are we working on the right things, and where does something need deciding?",
      stations: [
        {
          title: "The day begins with the goals",
          route: "/ziele",
          body: [
            {
              kind: "paragraph",
              text: "I do not see **one** epic, I see all of them. The target picture and the top goals stand here; every epic will later pay into one of them.",
            },
            {
              kind: "paragraph",
              text: "Without well-kept goals there is no demonstrating value at the year's end — the epics' KPI chain hangs on them.",
            },
          ],
        },
        {
          title: "The portfolio board",
          route: "/portfolio",
          anchor: "portfolio-kanban",
          body: [
            {
              kind: "paragraph",
              text: "Every epic by maturity level. **What piles up on the left is undecided; what stands on the right is already running.** The epic list shows the same set as a funnel, with the next necessary step per row and the number of outstanding approvers where a request is in flight.",
            },
          ],
        },
        {
          title: "My decisions",
          route: "/my-tasks",
          anchor: "approvals-list",
          body: [
            {
              kind: "paragraph",
              text: "What sits there are requested maturity transitions on which I am named as an approver — beside them, in sections of their own, the support requests and the distribution tasks.",
            },
            {
              kind: "paragraph",
              text: "For each I see what it is about and — as soon as there is an earlier approval — the comparison with the last approved version. I agree or refuse with reasons; **a refusal without text Pulse does not accept.**",
            },
            {
              kind: "quote",
              text: "While I do nothing, the epic stands still.",
            },
            {
              kind: "paragraph",
              text: "That is not a side effect but the intent: the maturity level moves only through a signature.",
            },
          ],
        },
        {
          title: "Where I sign",
          body: [
            {
              kind: "paragraph",
              text: "That depends on my value stream's gate policy. These are the **code defaults**, overridable per value stream; the quorum is **unanimous** throughout — whoever is entered has to agree.",
            },
            { kind: "figure", figure: "lifecycleSteps" },
            {
              kind: "paragraph",
              text: "**The product manager stands at two steps, with different reach.** At → L2 they countersign on **every** epic of their solution — the classification does not even exist there yet, so restricting it to ART epics would not be decidable. At → L4.1 it is known, and there they sign only on ART epics: their product is being changed out of their ART's pot.",
            },
            {
              kind: "aside",
              text: "The five parties at → L2 are at the same time the expression of the **multi-party sign-off** practice. Switch it off in the target picture and the VMO signs there alone. Who signs for _this_ epic is decided by the requester when requesting — the pre-fill from the value stream is a proposal, not a rule. That remains a property of the epic.",
            },
          ],
        },
        {
          title: "Two lists that arrive unasked",
          route: "/portfolio",
          body: [
            {
              kind: "paragraph",
              text: "**Marked for steering** carries the epics whose owner has set the steering tick, sorted by the longest time without an update — **that is the agenda of the next meeting, not my invention.**",
            },
            {
              kind: "paragraph",
              text: "And the open _I need help_ requests: as a portfolio manager I see all of them in the tenant, a pure VMO those of their value stream.",
            },
          ],
        },
        {
          title: "The money",
          body: [
            {
              kind: "paragraph",
              text: "It is distributed **not on the epic** but in a budget period: I create a round with its pot, take the epics put forward onto the candidate list, and groups distribute independently of one another.",
            },
            {
              kind: "paragraph",
              text: "For an individual epic only the result counts. **That does not push it forward** — it satisfies the blocking criterion for → L3, nothing more. The investment decision is the request plus my sign-off and finance's.",
            },
            {
              kind: "note",
              text: "**Without the budgeting module the criterion falls away.** There is then no allocation that could satisfy it, and the step L2 → L3 rests on the sign-off by the VMO and finance alone. That is not a loophole but the rule in its pure form: the investment decision should arise from a **signature** and not from a figure — the budget is its precondition, not the decision itself.",
            },
          ],
        },
        {
          title: "Review and guardrails",
          route: "/portfolio/guardrails",
          body: [
            {
              kind: "paragraph",
              text: "In the **portfolio review** I hold plan against actual: benefit plan, forecast, plan adherence, schedule variance — top-down from the portfolio through the value streams to individual epics. Using the reference date I compare states.",
            },
            {
              kind: "paragraph",
              text: "On the **guardrails** surface I read whether the distribution still fits the target picture: the horizon mix, the split between business and enabler, and **business owner engagement** — whether the business owners are signing at L2 at all, and how long they take.",
            },
          ],
        },
        {
          title: "The corrective authority",
          body: [
            {
              kind: "paragraph",
              text: "When something goes wrong, I am it: **only I may demote a maturity level**, by exactly one step, with a mandatory reason.",
            },
            {
              kind: "paragraph",
              text: "That **clears the stamps of the step being left** — a withdrawn BC approval really is withdrawn, and the text becomes editable again. With concerns the same principle holds: anyone may classify, only I may delete.",
            },
          ],
        },
      ],
    },

    {
      label: "Finance",
      question: "Does the sum add up, and did it work out in the end?",
      stations: [
        {
          title: "I have no role in the system",
          body: [
            {
              kind: "paragraph",
              text: "I am **named as the finance approver** on my value stream, and everything else follows from that: the sign-off rows that reach me, and the right to maintain this value stream's run-the-business items — without anybody having to give me a portfolio role.",
            },
            {
              kind: "paragraph",
              text: "What the value stream and its ARTs carry in budget follows from the budget periods; **I read it, I do not set it.** I have **three seats** in an epic's lifecycle.",
            },
          ],
        },
        {
          title: "→ L2 · The business case",
          body: [
            {
              kind: "paragraph",
              text: "I am one of the five parties. What I check the epic owner wrote down, but **worked out with me**: the cost slices on one side, on the other the KPI costing — value per unit, kind of benefit one-off or ongoing, and from those the benefit contribution.",
            },
            {
              kind: "paragraph",
              text: "The owner keeps the fields; my signature is the **cross-check**. It covers deliverables and KPIs as well; there is no separate sign-off per section. If I do not sign, the business case is not approved — the quorum is unanimous.",
            },
          ],
        },
        {
          title: "→ L3 · The investment decision",
          body: [
            {
              kind: "paragraph",
              text: "Here I sign together with the VMO, and here the money falls. The blocking criterion is an allocation greater than zero; the sign-off stamps approver and date onto the epic.",
            },
            {
              kind: "quote",
              text: "An approved business case is not yet an investment.",
            },
            {
              kind: "paragraph",
              text: "That this step is separate from entering L3 is deliberate for exactly that reason.",
            },
          ],
        },
        {
          title: "→ L5 · Impact realised",
          body: [
            {
              kind: "paragraph",
              text: "The last step is **mine alone**. The precondition is confirmed delivery. I confirm that the forecast benefit has arrived, in the KPIs or on the balance sheet.",
            },
            { kind: "figure", figure: "gateCriteria" },
          ],
        },
        {
          title: "Quantity and value — two axes",
          body: [
            {
              kind: "paragraph",
              text: "My actual work lies precisely in the window between L4.2 and L5. The **quantity** is settled with L4.2, the **value** is not: now it shows whether one unit of improvement really brought as much as the business case assumed.",
            },
            {
              kind: "paragraph",
              text: "If I adjust the conversion factor, the new value holds **retroactively** across the whole actual figure — the **plan**, by contrast, stays with the factor and the target that held at approval. **Only that way does plan against actual measure anything.**",
            },
            {
              kind: "paragraph",
              text: "In that sits an asymmetry that explains the cut: I countersign the **money** decision and confirm the **benefit** at the end — but not, on my own, the entry into L3 with the approved business case. Which is exactly why L2 and L3 are two steps and not one.",
            },
            {
              kind: "aside",
              text: "An epic that reaches only 70 % of its KPI target, but whose units turn out to be worth more, can still deliver on balance — and you can see what it came down to.",
            },
          ],
        },
        {
          title: "The reading surface in between",
          route: "/portfolio/dashboard",
          body: [
            {
              kind: "paragraph",
              text: "Break-even, benefit velocity against the plan, the cost curve against the cost-neutrality target, and the waterfall “value by maturity state” against the respective top goal's target.",
            },
            {
              kind: "paragraph",
              text: "What stands there as **forecast** is exactly what I countersigned at L2 — and what stands beside it as **actual** is what came of it at L5.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "An epic advances when the criteria are met.",
      why: "Nothing advances by itself. Every maturity transition is requested and signed off; the criteria are the checklist beforehand, not the trigger.",
    },
    {
      claim: "The business-case approval and the investment decision are one step.",
      why: "They are two: L2 approves the text, L3 establishes that money is there. Which is why finance signs twice.",
    },
    {
      claim: "The budget allocation pushes my epic to L3.",
      why: "It only satisfies the blocking criterion. The step stays a request with two sign-offs.",
    },
    {
      claim: "The classification as a portfolio or ART epic is settled at creation.",
      why: "At creation there is an **expectation**. The classification comes into being with the BC approval, from the costs against the portfolio threshold.",
    },
    {
      claim: "An oversized epic can be declared an ART epic by override.",
      why: "The override runs one way only: a portfolio matter despite small costs. The other way round, an ART's pot could not carry it anyway.",
    },
    {
      claim: "“L4” is a step.",
      why: "It is a **column** — the main gate spanning L4.1 and L4.2. As a step, entering delivery is called **L4.1** everywhere.",
    },
    {
      claim: "If the KPI rises later after all, the quantity delivered rises with it.",
      why: "The quantity freezes at L4.2. What can still change afterwards is its value.",
    },
    {
      claim: "A corrected value per unit changes the plan too.",
      why: "It holds retroactively for the **actual**. The plan stays with the factor that held at approval — otherwise the comparison measures nothing.",
    },
    {
      claim: "The epic owner can see how much pot their ART has left.",
      why: "The money tabs carry a right of their own. They see **whether** a pot is there — the rest is a conversation, and that is deliberate.",
    },
    {
      claim: "A refused request needs no reason.",
      why: "A refusal without text Pulse does not accept.",
    },
  ],

  who: [
    {
      step: "Request a maturity transition",
      who: "the epic owner",
      capability: "epic.gate.request",
    },
    {
      step: "Sign off or refuse a requested step",
      who: "whoever is entered under the value stream's gate policy",
      capability: "epic.gate.decide",
    },
    {
      step: "Set the approvers per value stream and gate",
      who: "Portfolio manager",
      capability: "epic.gate.approvers.configure",
    },
    {
      step: "Demote a maturity level (exactly one step, with reasons)",
      who: "**only** portfolio management",
      capability: "epic.gate.revert",
    },
    {
      step: "Declare an epic a portfolio matter despite small costs",
      who: "Portfolio management",
      capability: "epic.portfolio_override",
    },
    {
      step: "Write the business case and the hypothesis",
      who: "the epic owner",
      capability: "epic.update",
    },
    { step: "Confirm the benefit at L5", who: "the value stream's finance party" },
    {
      step: "Maintain run-the-business items",
      who: "the value stream's finance party",
      capability: "rtb_item.manage",
    },
  ],
};
