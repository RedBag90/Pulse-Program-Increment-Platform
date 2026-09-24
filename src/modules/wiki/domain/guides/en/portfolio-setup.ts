import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Portfolio entsteht“ — the English reading. The versioned long form
 * lives at `docs/concepts/portfolio-setup-walkthrough.md` and stays German,
 * with the code look-up points alongside; this file is the product version:
 * no file paths, but jump targets instead.
 *
 * **Deliberately without `module`**, as in the German file. The top goal,
 * value streams, ARTs and solutions are core; so the build-up belongs to every
 * tenant.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/portfolio-setup.ts`; `guides-parity.test.ts` holds
 * them together. What differs here is only the prose.
 */
export const PORTFOLIO_SETUP_EN: Guide = {
  slug: "ein-portfolio-entsteht",
  title: "A portfolio comes into being",
  standfirst:
    "The build-up, told three times over: from the view of the portfolio manager who sets the top goal and takes down the organisation, the value stream owner who brings their own section into focus, and the product manager who classifies their solution. The one procedure you generally go through **once**.",
  teaser: "Top goal, value streams, ARTs, solutions, timelines, guardrails, sub-goals.",
  cadence: "einmalig",
  seeAlso: ["der-mandant-und-seine-menschen"],

  mechanics: [
    {
      kind: "paragraph",
      text: "**The order is a dependency, not a convention.** The build-up looks like a checklist and is not one: four of the seven steps presuppose another, and getting it wrong means going back.",
    },
    {
      kind: "code",
      text: `Top goal ──────────────────────────────────────┐
                                               │
Value stream ┬── ART ──┬── Solution            ├── Sub-goal
             │         │                       │   needs top goal
             │         └── join a timeline     │   + value stream + ART
             │
             └── finance approver · portfolio manager
                 sign-offs per maturity level
                 capacity · portfolio threshold

Portfolio guardrails ── tenant-wide, at any time`,
    },
    {
      kind: "paragraph",
      text: "An ART requires its value stream in the creation dialogue. A solution requires its value stream and offers ARTs only once that is chosen. A timeline has no ARTs to join before there are ARTs. And a sub-goal cannot assign its responsibility until value streams and ARTs are in place.",
    },
    {
      kind: "aside",
      text: "**The top goal is the exception.** It hangs on nothing and may come first — and that is the statement of the whole procedure: first you agree what is to be achieved, then you take down the organisation that is to achieve it.",
    },
    {
      kind: "paragraph",
      text: "**Four horizons, five stations** — the commonest mistake when building up, and one that comes back to bite. Economically H1 falls into two phases: building out against harvesting.",
    },
    { kind: "figure", figure: "horizonLadder" },
    {
      kind: "quote",
      text: "The axis stays four-valued, the ladder shows five rungs.",
    },
    {
      kind: "paragraph",
      text: "Anyone thinking “five horizons” during the build-up will later search in vain for a guardrail field for the fifth.",
    },
    {
      kind: "aside",
      text: "**At the start the portfolio manager is all three.** On the very first pass there is nobody to ask: no value stream owners, no product managers, no finance party. They enter everything themselves and **name the others as they go**. From the second pass on it runs as set out here in three parts.",
    },
    {
      kind: "note",
      text: "Two terms in common use have **no counterpart** in Pulse: “portfolio owner” is not a role, and “VMO” is no longer one. There are eight roles; the `portfolio_manager` has absorbed the VMO. The data field on the value stream is still called `vmoId`, the field on the surface is called **portfolio manager**.",
    },
  ],

  perspectives: [
    {
      label: "The portfolio manager",
      role: "portfolio_manager",
      question: "what does this portfolio consist of, and where should it go?",
      stations: [
        {
          title: "The top goal",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "I come out of the meeting with the executive board holding a goal. The route is German: `/ziele`, not `/goals`.",
            },
            {
              kind: "paragraph",
              text: "There are **two** ways to create a goal, and they can do different amounts. The quick dialogue from the global “+” menu asks only for a title, a period and a description. The full drawer via “+ goal” in the table carries everything else.",
            },
            {
              kind: "aside",
              text: "The quick dialogue has **no owner field and no progress source**. Anyone creating with it has to open the goal afterwards anyway — for a top goal, go straight to the drawer.",
            },
            {
              kind: "paragraph",
              text: "**Period** is a switch with two settings: **grid** (FY / H1·H2 / Q1–Q4) or **custom** — two date fields, “start” and “end”, both required in the second mode. **Owner** is a person field over the tenant's users, with no role binding.",
            },
            {
              kind: "paragraph",
              text: "The **progress source** decides which fields appear at all afterwards:",
            },
            {
              kind: "table",
              head: ["Label in the UI", "Where the progress comes from"],
              rows: [
                ["Manual", "I keep the actual figure myself"],
                [
                  "From sub-goals",
                  "weighted average of the children — **an own metric is ignored**",
                ],
                [
                  "KPI tree",
                  "leaf: actual from linked epic KPIs (Δ × factor); branch: cascaded over the sub-goals",
                ],
                [
                  "Confidence vote",
                  "fist to five: a level from 1 to 5 instead of a metric — **for goals that cannot be measured in a number**",
                ],
              ],
            },
            {
              kind: "note",
              text: "Two traps. With **“from sub-goals”** and **“confidence vote”** the surface does not render the metric block at all — baseline, target, unit are gone; for the vote the scale is fixed at 1 to 5 anyway. And **“KPI tree” appears only when the portfolio module is active**; without it there are three options to choose from.",
            },
            {
              kind: "paragraph",
              text: "When **creating**, the details sit behind a fold called **advanced**; when editing later the same fields stand open in the _settings_ tab. There is no “expand” button.",
            },
            {
              kind: "table",
              head: ["Field", "Note"],
              rows: [
                ["Narrative", "the description of the goal — here it is not called “description”"],
                ["Metric type", "required: number · percent · currency · custom"],
                ["Unit (label)", "only for number and custom"],
                ["Baseline · target", "the starting figure and the goal"],
                [
                  "Current",
                  "only for progress source manual — for the vote the five buttons carry it",
                ],
              ],
            },
            {
              kind: "paragraph",
              text: "For metric type **percent** the surface pre-fills empty values with 0 and 100. “Save” — the top goal stands.",
            },
          ],
        },
        {
          title: "The value streams",
          route: "/structure",
          anchor: "value-stream-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Between the goal and this row lies the actual work, and it happens **outside** the tool: workshops and interviews with the divisions. I take down three things — which **solutions** are in use, which **groups of people** look after them, and how that clusters into **value streams**.",
            },
            {
              kind: "aside",
              text: "What I take down is sometimes the current organisation, sometimes the intended one. A decision with a long shadow: **the entire structure of the work follows from it** — budgets, sign-offs, guardrails, and the assignment of every epic.",
            },
            {
              kind: "paragraph",
              text: "In the tool it is then short. The structure does **not** sit in tabs but as three entries in the sidebar — **organisation**, **solutions**, **timelines**. `/structure` is a tree with a detail surface beside it; the word “value streams” appears there only as a **filter chip** above the tree.",
            },
            {
              kind: "paragraph",
              text: "In the tree's header sits the **value stream** button. The dialogue asks for a name and a description, with a **create** button. Nothing more — everything else belongs on the detail page and so in part 2.",
            },
          ],
        },
        {
          title: "Looking up who has already been named",
          route: "/structure/rollen",
          body: [
            {
              kind: "paragraph",
              text: "**Who does what** shows every naming in the tenant on one surface — per value stream the responsibilities as seats, filled ones with a face, unfilled ones dashed. Whoever has the right fills them straight from there, rather than visiting every detail page one by one.",
            },
            {
              kind: "aside",
              text: "They are **namings**, not app roles: a role says what somebody may do, a naming says whom to ask. Nobody has to hold a role to be named.",
            },
          ],
        },
        {
          title: "The ARTs",
          route: "/structure",
          anchor: "structure-tree",
          body: [
            {
              kind: "paragraph",
              text: "ARTs come into being through the global **“+”** at the top right. The entries sit in groups: _strategy_ carries “goal”, _portfolio_ carries “value stream”, “ART” and “solution”.",
            },
            {
              kind: "paragraph",
              text: "**The ART dialogue is in English** — the only one in this chain: “Create Agile Release Train”, fields **Value Stream \\*** and **Name \\***, buttons “Cancel” and “Create ART”. No description field, **no RTE field**, no cadence.",
            },
            {
              kind: "paragraph",
              text: "I enter the **RTE** afterwards on the ART's detail page in the _general_ tab — the field there is called **RTE (Release Train Engineer)**, committed with **save changes**. Only users holding the RTE role can be chosen; if there are none, the surface says so rather than showing an empty list.",
            },
            {
              kind: "aside",
              text: "The RTE answers for the process **inside** their ART: that the PIs are kept to and the features get planned in.",
            },
          ],
        },
        {
          title: "The solutions",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "The same “+” tile, entry “solution”. The **new solution** dialogue asks for a name, a description, **Value Stream \\***, **ART** — cascading; before the value stream is chosen it reads “value stream first…” — and **Status \\***.",
            },
            {
              kind: "note",
              text: "**The field is called “status”, not “horizon”** — although everywhere else the talk is of the horizon. Four values, all in English, in the ladder above. **H3 is not among them:** that is where research happens, and whether a product ever comes of it is open. A solution appears in H2 at the earliest.",
            },
            {
              kind: "paragraph",
              text: "The transition **emerging → investing** is the only one with a gate: the point at which a candidate becomes a product. Everything further on that is in part 3.",
            },
          ],
        },
        {
          title: "The PI cadence",
          route: "/structure/timelines",
          body: [
            {
              kind: "paragraph",
              text: "For the ARTs to have a clean beat they need a timeline: it defines how long the delivery phases run. Sidebar **structure → timelines**, button **new timeline** — not “+ timeline” — a dialogue with one name field.",
            },
            {
              kind: "list",
              ordered: true,
              items: [
                "**Program increments** — one at a time via **new PI**, or in one go via **apply a standard…**",
                "**Add ARTs** — one **+ join ART** per ART. Afterwards they stand under **linked ARTs**.",
              ],
            },
            {
              kind: "note",
              text: "**The two PI routes hang on different rights.** Both buttons are visible under the same flag (`timeline.manage`). “New PI” also checks `timeline.manage` — **but “apply a standard…” checks `pi.create`, and only the RTE carries that**. So a portfolio manager sees the button and runs into a refusal.",
            },
            {
              kind: "aside",
              text: "**One standard cadence for everybody is the recommendation.** A cadence of its own per ART is possible but costs exactly what the beat is there for: synchronised delivery. Which is also why an ART no longer carries a cadence of its own — it **joins** a timeline.",
            },
          ],
        },
        {
          title: "The guardrails",
          route: "/portfolio/guardrails",
          body: [
            {
              kind: "paragraph",
              text: "This needs alignment with the portfolio sponsor, typically senior management. The surface shows the current mix at the top and, below under **target mix**, the form.",
            },
            { kind: "figure", figure: "guardrailAxes" },
            {
              kind: "paragraph",
              text: "Guardrail 3 has no measurement of its own, only a value — it is a threshold, not a mix. Its help text says in one sentence what it does: **From this size up the portfolio decides. Below it the ART funds.**",
            },
            {
              kind: "paragraph",
              text: "The horizon distribution carries **five** fields, not four — here it pays to have understood the stations. The sum must come to 100 (tolerance 0.5), or instead of the tick it reads “— 100 expected”.",
            },
            {
              kind: "aside",
              text: "That is the reason the axis exists at all: without it every euro would run into the solutions already in flight, and nothing would be left for new ideas.",
            },
            {
              kind: "paragraph",
              text: "I set capacity allocation and the portfolio threshold here **for every value stream**. That is the normal case; exceptions are made by the individual value stream — see part 2.",
            },
            {
              kind: "aside",
              text: "What I still lack now are the **sub-goals** — step 7. They are in the next part, because they belong to the value stream owners. After that comes no further step in the tool but the starting gun: telling the participants about the goals and opening up the identification of opportunities.",
            },
          ],
        },
      ],
    },

    {
      label: "The value stream owner",
      role: "value_stream_owner",
      question: "who signs within my section, and for what?",
      stations: [
        {
          title: "What somebody answers for",
          route: "/structure",
          body: [
            {
              kind: "paragraph",
              text: "My detail page has four tabs: **general**, **guardrails**, **solutions**, **history**. The guardrail tab appears only with the budgeting module and read access to the money — or when I am this value stream's finance party.",
            },
            {
              kind: "list",
              items: [
                "**Finance approver** — “Signs off this value stream's epics as the finance party.” They sign the financial assignment, the costing, and the confirmation of the impact.",
                "**Portfolio manager** — “The value management office responsible.” First point of contact for the process and for clean documentation of every epic in this value stream. **Only** users holding the `portfolio_manager` role can be chosen.",
              ],
            },
            {
              kind: "aside",
              text: "**With these two namings the sign-off cycle is fundamentally secured** — that is their real function. The role placeholders in the sign-off rules resolve against them to actual people.",
            },
            {
              kind: "paragraph",
              text: "Committed with **save changes** (plural). Without write access the same place shows a plain definition list.",
            },
          ],
        },
        {
          title: "Sign-offs per maturity level",
          route: "/structure",
          body: [
            {
              kind: "paragraph",
              text: "Further down the same surface: **sign-offs per maturity level** — “Who signs off each maturity transition (L1–L5) in this value stream.”",
            },
            {
              kind: "paragraph",
              text: "Normally I leave this as it stands. If detailed wishes were agreed in the workshops, I open **edit** and set, per gate: **sign-off required**, **quorum** (“everyone must agree” or “one agreement suffices”), **role placeholders** and **named people**.",
            },
            {
              kind: "paragraph",
              text: "**Save** — and the rules hold **for every epic in this value stream**. A provenance badge on each row says where the governing rule comes from: “value stream rule”, “tenant default” or “standard”.",
            },
          ],
        },
        {
          title: "My own guardrails",
          route: "/structure",
          body: [
            {
              kind: "paragraph",
              text: "Under **this value stream's targets** there are three fields to set: business %, enabler % and portfolio threshold €. Their placeholder is the word that matters: **“inherited”**. An empty field is not a zero — it means the tenant-wide default applies.",
            },
            {
              kind: "paragraph",
              text: "During the build-up I generally leave both empty. **A lower portfolio threshold of my own** is the exception and has a clear consequence: smaller epics then have to go through top management too. For particularly critical value streams that is exactly what is wanted.",
            },
            {
              kind: "note",
              text: "**There is no horizon axis here.** The domain knows a value stream override for it, the surface does not offer one — “investment by horizon” is set tenant-wide only.",
            },
          ],
        },
        {
          title: "The sub-goal",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "Once the top goal and the structure stand, I break the goal down — together with the business owners and top management. **One goal per value stream is the clean split**; going further down, to ARTs or solutions, is possible too.",
            },
            {
              kind: "paragraph",
              text: "The route: the **“+”** on the top goal's row (“add a sub-goal”), or in the drawer under _links_ the **sub-goals** section with **+ new sub-goal**. **The same dialogue as for the top goal** opens. As owner I choose the value stream owners.",
            },
            {
              kind: "list",
              items: [
                "**Weight in the parent goal's roll-up (empty = 1)** — how strongly this sub-goal counts towards the parent's average.",
                "**Contribution to the parent goal — 1 {unit} = ▢ {parent unit}** — the conversion factor. Empty means “no contribution of value”.",
              ],
            },
            {
              kind: "note",
              text: "**Two factors people confuse.** This one connects **goal with goal**. There is a second that connects **goal with epic KPI** — it is kept in the epic's KPI tab, under “value (conversion factor)”.",
            },
            {
              kind: "paragraph",
              text: "Finally the connection to the organisation: drawer, **links** tab, section **related work & scope** — not “related work & score”; there is no score there. Within it, _related work_ takes on concrete work (epics, features, PIs), and **responsibility · value streams & ARTs** is where the goal's value stream and ART are recorded.",
            },
          ],
        },
      ],
    },

    {
      label: "The product manager",
      question: "where does my product stand, and what does it cost to run?",
      stations: [
        {
          title: "The status",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "My naming stands on the solution's detail page in the _overview_ tab as **product manager** — a free person field with no role binding, because product responsibility does not coincide with a SAFe role. It is not a caption: among other things, it means **I countersign the maturity sign-offs of my solution's epics**.",
            },
            {
              kind: "paragraph",
              text: "I change the **status** through the **lifecycle rail** — it sits in the detail page's sub-header and so is reachable from every tab.",
            },
            { kind: "figure", figure: "solutionLifecycle" },
            {
              kind: "paragraph",
              text: "**One edge is a gate.** _Promote to H1_ opens a dialogue with the four criteria named under the edge above — all four must be confirmed.",
            },
            {
              kind: "aside",
              text: "That is the point at which a candidate becomes a product — hence the only one with a confirmation. H1.1 → H1.2, by contrast, is a click with no dialogue.",
            },
            {
              kind: "note",
              text: "**The ladder begins at emerging.** There are no solutions in H3 — that is where research happens, and whether a product ever comes of it is open. So an R&D endeavour carries its horizon **on the epic**, and the guardrail counts it towards the H3 quota all the same. If a candidate does not prove itself, it is decommissioned rather than demoted.",
            },
            {
              kind: "paragraph",
              text: "**Where that happens in practice:** in the portfolio review. The solutions are discussed there regularly, and part of that is the question of whether the classification has shifted.",
            },
          ],
        },
        {
          title: "The run baseline",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "Solutions that arrive when Pulse is introduced are generally already running. What it costs to keep them running — _keep the lights on_ — belongs on file as **run the business**.",
            },
            {
              kind: "paragraph",
              text: "In the _overview_ tab there are three tiles for that: **grow · active primary epics**, **run · operations p.a.**, and the ratio **grow : run**. If the budgeting module is not active, the run tile reads “budgeting module not active” — that figure belongs to the module, not to the structure.",
            },
            {
              kind: "table",
              head: ["Kind", "What belongs in it"],
              rows: [
                ["Operations", "licences, maintenance, everything that holds what exists"],
                ["ART pot", "the pot for further development that the ART distributes"],
              ],
              caption: "Two kinds, one list — and the distinction is no formality.",
            },
            {
              kind: "aside",
              text: "Separating them is not an accounting formality: **otherwise change work would be paid for out of the operations pot**, and four surfaces would state an untruth — the grow/run tiles, the run share of the value stream, the structure of the portfolio backlog, and guardrail 2.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "There are five horizons.",
      why: "Four horizons, **five stations**. H1 falls into investing and extracting.",
    },
    {
      claim: "I am the portfolio owner.",
      why: "The role is called `portfolio_manager`. “Portfolio owner” and “VMO” are not roles.",
    },
    {
      claim: "The value stream has a horizon guardrail.",
      why: "Only capacity and the portfolio threshold. The horizon axis exists tenant-wide only.",
    },
    {
      claim: "I set the RTE when creating the ART.",
      why: "The dialogue knows only the value stream and the name. The RTE comes on the detail page.",
    },
    {
      claim: "An empty guardrail field means zero.",
      why: "It means **inherited** — the tenant-wide default applies.",
    },
    {
      claim: "You create a goal once, wherever.",
      why: "The quick dialogue can do neither owner nor progress source. For a top goal: the drawer.",
    },
    {
      claim: "The conversion factor connects goal and epic.",
      why: "This one connects goal and **parent goal**. The one to the epic is a different factor.",
    },
    {
      claim: "Every ART gets its own cadence.",
      why: "It **joins** a timeline. Separate cadences cost you synchronised delivery.",
    },
    {
      claim: "What I can see, I may do.",
      why: "“Apply a standard…” is visible under `timeline.manage` but requires `pi.create` (RTE).",
    },
  ],

  who: [
    {
      step: "Create a goal and a sub-goal, keep the metric",
      who: "Portfolio manager / admin; value stream owner within their value stream only",
      capability: "target.manage",
    },
    { step: "Create a value stream", who: "Portfolio manager", capability: "value_stream.create" },
    {
      step: "Set the finance approver and portfolio manager",
      who: "Portfolio manager / admin, value stream owner",
      capability: "value_stream.update",
    },
    {
      step: "Change the sign-offs per maturity level",
      who: "Portfolio manager / admin, value stream owner",
      capability: "epic.gate.approvers.configure",
    },
    {
      step: "Create an ART, set the RTE",
      who: "Portfolio manager / admin",
      capability: "art.create",
    },
    { step: "Delete an ART", who: "tenant admin only", capability: "art.delete" },
    {
      step: "Create a solution, change its status",
      who: "Portfolio manager / admin — not the value stream owner",
      capability: "solution.manage",
    },
    {
      step: "Edit a solution (status, ART, description)",
      who: "the named product manager — with no further role",
    },
    {
      step: "Set tenant-wide targets",
      who: "Portfolio manager / admin",
      capability: "target.manage",
    },
    {
      step: "Create a timeline, individual PIs, join ARTs",
      who: "Portfolio manager / admin",
      capability: "timeline.manage",
    },
    { step: "Apply a PI standard", who: "RTE / admin", capability: "pi.create" },
    {
      step: "Maintain run-the-business items",
      who: "Value stream owner, finance party, portfolio manager / admin",
      capability: "rtb_item.manage",
    },
  ],
};
