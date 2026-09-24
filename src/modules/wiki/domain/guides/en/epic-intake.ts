import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Eine Idee wird ein Vorhaben“ — the English reading. The versioned long form
 * lives at `docs/concepts/epic-intake-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/epic-intake.ts`; `guides-parity.test.ts` holds them
 * together. What differs here is only the prose.
 */
export const EPIC_INTAKE_EN: Guide = {
  slug: "eine-idee-wird-ein-vorhaben",
  title: "An idea becomes an endeavour",
  teaser: "Submit, triage, name an owner.",
  standfirst:
    "The way from a notion to an epic with a named owner — using the names Pulse actually uses: funnel, first triage, expected classification, benefit hypothesis. The phase in which a decision is taken without any gate recording it.",
  cadence: "je_idee",
  module: "work",
  seeAlso: ["ein-portfolio-entsteht", "der-mandant-und-seine-menschen"],

  mechanics: [
    { kind: "quote", text: "Two columns, one maturity level." },
    {
      kind: "paragraph",
      text: "The portfolio kanban has six columns. The first two are the subject of this guide — and they are a special case.",
    },
    { kind: "figure", figure: "kanbanColumns" },
    {
      kind: "paragraph",
      text: "The move between _funnel_ and _hypothesis_ is **not a gate**: it happens the moment an epic owner is first named. An epic at L0 **with** that stamp appears in the hypothesis column, although its maturity level stays L0.",
    },
    {
      kind: "quote",
      text: "First triage is a decision with no approval loop.",
    },
    {
      kind: "paragraph",
      text: "There is no request, no approvers, no L0.5 stamp — there is a **naming**, and with it the card moves. That is the most important thing to know about this phase.",
    },
    { kind: "quote", text: "The class is not yet settled here." },
    {
      kind: "paragraph",
      text: "The creation dialogue asks for the **expected classification** — portfolio epic or ART epic. Its help text says in two sentences what that is and what it is not: “An expectation, not a decision. The class arises from the costs in the approved business case — if it differs, the surface asks before the request.”",
    },
    {
      kind: "paragraph",
      text: "Before L2 an epic has **no class at all**; the badge reads “not yet classified”. Only the approved business case supplies costs, and those are compared with **the value stream's** portfolio threshold: above it a portfolio epic, at or below it an ART epic.",
    },
    {
      kind: "note",
      text: "**“An employee with an idea” is not provided for in the permission model.** Only portfolio managers, epic owners and — limited to their own value stream — the value stream owner may create an epic. A feature owner, an RTE or a read-only user can create **no** epic. Anyone wanting to gather ideas from across the organisation needs a route outside Pulse for now — or gives the submitters the epic owner role.",
    },
  ],

  perspectives: [
    {
      label: "The submitter",
      question: "How do I get my idea into the portfolio?",
      stations: [
        {
          title: "Creating the epic",
          route: "/portfolio/epics",
          anchor: "epic-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Through the global **+** I pick **epic** in the _initiative_ group; on the epic list the same route is called **new epic**.",
            },
            {
              kind: "table",
              head: ["Field", "Required", "Note"],
              rows: [
                ["**Title**", "yes", "—"],
                ["**Value stream**", "yes", "“choose a value stream…”"],
                ["**ART**", "yes", "cascading — the value stream first, then the ART"],
                ["**Primary solution**", "no", "“— assign later —”"],
                [
                  "**Expected classification**",
                  "yes",
                  "“Portfolio epic — above €X” / “ART epic — up to €X”",
                ],
                [
                  "**Supported goal**",
                  "no",
                  "the goal tree; this is where the idea attaches to the strategy",
                ],
                ["**Description**", "no", "a text field — it is not called “short description”"],
              ],
            },
          ],
        },
        {
          title: "Two things you expect wrongly the first time",
          body: [
            {
              kind: "paragraph",
              text: "**There is no field for an estimated size.** What looks like one is the _expected classification_ — and it asks not for a figure but for a **side of the line**. The threshold in the option text is the chosen value stream's portfolio threshold; it changes when I change the value stream.",
            },
            {
              kind: "paragraph",
              text: "**The ART is required, the solution is not.** Anyone who does not yet know which product the idea belongs to leaves the field on “— assign later —”.",
            },
            {
              kind: "aside",
              text: "An epic without a primary solution inherits **no horizon** — that would come from the solution. If I set one on the epic itself, it counts perfectly normally towards its quota; leave both empty and it lands in the funnel's “none” lane. That is not a fault but the answer.",
            },
            {
              kind: "paragraph",
              text: "With **create** the idea is submitted. It now sits in the **funnel**, at maturity **L0**, without an owner — and waits.",
            },
          ],
        },
      ],
    },

    {
      label: "The portfolio manager",
      role: "portfolio_manager",
      question: "Is this a real thing, and who drives it?",
      stations: [
        {
          title: "First triage",
          route: "/portfolio/epics",
          anchor: "epics-funnel-bar",
          body: [
            {
              kind: "paragraph",
              text: "My job is to make sure the epics on the board can be followed and are of decent quality. I go through the submitted ones and ask, in this order:",
            },
            {
              kind: "list",
              ordered: true,
              items: [
                "**Does the idea make sense?**",
                "**Are the value stream, ART and solution right?** Correcting them is cheap while nothing hangs on them — later the money hangs on them: the value stream sets the portfolio threshold and thus the class, and it sets who signs the maturity gates.",
                "**Who works out the hypothesis?**",
              ],
            },
            {
              kind: "paragraph",
              text: "The third question is the actual act.",
            },
          ],
        },
        {
          title: "Naming the epic owner",
          anchor: "epic-owner-field",
          body: [
            {
              kind: "paragraph",
              text: "The control sits in the **overview** tab, in the **assignment** panel right at the top under **owner**. A click on the name opens the person picker; the choice **saves at once**, and a tick confirms it. With nobody named it reads **name someone**. The gate criterion “epic owner is named” leads there too, if you click it.",
            },
            {
              kind: "note",
              text: "**The entry “— nobody —” removes the naming again.** First triage is untouched by that: it took place, and the card does not travel back in the kanban.",
            },
            {
              kind: "paragraph",
              text: "**With the first naming the card travels** from _funnel_ to _hypothesis_. The maturity level stays L0; what changes is the stamp. From here the normal process runs.",
            },
          ],
        },
        {
          title: "What else the naming does",
          body: [
            {
              kind: "paragraph",
              text: "The epic owner is a criterion in **two** gates: for L1 and for L2 the list carries “epic owner is named” — both times **not blocking**. So an epic can get through without an owner if the approvers want it that way. The surface says so rather than forcing it.",
            },
            {
              kind: "paragraph",
              text: "What does block at this point is something else: **the worked-out benefit hypothesis**. And its approval is not a loop of its own — it happens with the sign-off of the step to L1.",
            },
          ],
        },
      ],
    },

    {
      label: "The epic owner",
      role: "epic_owner",
      question: "How do I get from an idea to something that holds?",
      stations: [
        {
          title: "When I get stuck",
          body: [
            {
              kind: "paragraph",
              text: "Sometimes I need support with the preparation. There is a tick-box on the maturity card for that — with a life ring and the words **I need help**. The only English text on this surface.",
            },
            {
              kind: "paragraph",
              text: "If I tick it, the surface confirms in one sentence what happens: the VMO and portfolio management now see this epic in _my tasks_.",
            },
            {
              kind: "note",
              text: "**Only I may tick it.** The control appears solely when I am recorded as the owner **and** am the signed-in user — a third party cannot ask for help on my behalf.",
            },
          ],
        },
        {
          title: "Who sees the request",
          route: "/my-tasks",
          body: [
            {
              kind: "paragraph",
              text: "On the other side stands the section **support requested**, with one row per epic and a **to the epic →** button. Who sees it is precisely governed:",
            },
            {
              kind: "list",
              items: [
                "whoever holds the **portfolio manager** role sees **every** open request in the tenant;",
                "everyone else sees only the epics of the value streams they are portfolio manager for.",
              ],
            },
            {
              kind: "aside",
              text: "Which shows why staffing matters when you build the structure: **a value stream with no named portfolio manager has no recipient for these requests** beyond the portfolio managers of the whole tenant.",
            },
          ],
        },
        {
          title: "When the business case is too big for the idea",
          body: [
            {
              kind: "paragraph",
              text: "The hardest case in this phase is not a missing owner but an idea whose **scope nobody yet knows**. I do not know how big it is, nor what belongs in it, and writing a business case that would hold up would mean inventing numbers.",
            },
            {
              kind: "quote",
              text: "The answer to that is not a smaller business case but a smaller endeavour.",
            },
            {
              kind: "paragraph",
              text: "An **R&D epic** in horizon H3. Each rung of the ladder wants something different and leaves something different behind:",
            },
            { kind: "figure", figure: "horizonLadder" },
            {
              kind: "paragraph",
              text: "**For an R&D epic the business case may stay rudimentary** — with sufficient agreement from the approvers. That is not laxity but the consequence of its purpose: it is not meant to deliver the product but **the knowledge that makes the next business case possible at all**.",
            },
          ],
        },
        {
          title: "Why new epics come out of it",
          body: [
            {
              kind: "paragraph",
              text: "After each step a **new epic** comes into being, not a relabelled old one. There is a reason of substance and a mechanical one.",
            },
            {
              kind: "list",
              items: [
                "**In substance** each rung is its own investment decision with its own business case, its own budget and its own approvers. A pilot is not the continuation of the discovery but its consequence.",
                "**Mechanically** an epic's horizon freezes with the business-case sign-off. Changing it afterwards is reserved to portfolio management.",
              ],
            },
            {
              kind: "quote",
              text: "If an epic travelled along, the history would be rewritten retroactively.",
            },
            {
              kind: "paragraph",
              text: "The measured portfolio balance of past half-years would then depend on where an endeavour stands **today**. Three epics in three horizons are three pieces of evidence; one epic that changes lane three times is none.",
            },
            {
              kind: "aside",
              text: "**An epic's horizon is free before L2.** Set it on the epic itself and it overrides the primary solution's — explicit beats derived. That is exactly what an R&D epic on a running solution needs: the solution sits in H1, the endeavour is discovery.",
            },
          ],
        },
        {
          title: "Putting forward is not requesting — but it is necessary",
          body: [
            {
              kind: "paragraph",
              text: "Two tick-boxes on the epic look alike and weigh very differently.",
            },
            {
              kind: "paragraph",
              text: "**Take up at the next steering meeting** is a pure marker: it is displayed and can be filtered on, nothing more. No service reads it.",
            },
            {
              kind: "paragraph",
              text: "**Put forward for the next budget meeting is a precondition.** A budget round's candidate list requires **both** — the tick **and** an approved business case. Without the tick my epic does not appear there at all, however ready it is.",
            },
            {
              kind: "paragraph",
              text: "What it does **not** do: put the epic on a running round's list. That remains an act of the portfolio manager.",
            },
            {
              kind: "quote",
              text: "Two steps, two people: I register my endeavour, the portfolio takes it to the vote.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Any employee can submit an epic.",
      why: "Only portfolio managers, epic owners and the value stream owner of their own stream hold that right.",
    },
    {
      claim: "In the dialogue I estimate the size.",
      why: "There is no figure — only the **side** of the line: portfolio epic or ART epic.",
    },
    {
      claim: "The expected classification settles the class.",
      why: "It is an expectation. The class arises from the costs in the approved business case.",
    },
    {
      claim: "First triage is a maturity step.",
      why: "It is a naming. The maturity level stays L0; only the kanban column changes.",
    },
    {
      claim: "Nothing moves on without an owner.",
      why: "“Epic owner is named” is **not** blocking at L1 and L2.",
    },
    {
      claim: "You drag the cards in the kanban.",
      why: "The kanban is **read-only**. Things move through the epic's maturity card.",
    },
    {
      claim: "I tick “I need help” for a colleague.",
      why: "The box appears only for the owner, and only when they are also the signed-in user.",
    },
    {
      claim: "The two markers are both mere filters.",
      why: "The steering marker yes. The budget marker is a **precondition**: without it the epic appears on no candidate list.",
    },
    {
      claim: "The R&D epic later becomes the pilot epic.",
      why: "**New** epics come into being. The horizon freezes with the business-case sign-off.",
    },
  ],

  who: [
    {
      step: "Create an epic",
      who: "Portfolio manager, epic owner; value stream owner within their stream",
      capability: "epic.create",
    },
    {
      step: "Correct the value stream / ART / solution",
      who: "the same",
      capability: "epic.update",
    },
    {
      step: "Name the epic owner",
      who: "Portfolio manager; value stream owner within their stream",
      capability: "epic.owner.assign",
    },
    {
      step: "Set the horizon on the epic (before L2)",
      who: "whoever may edit the epic",
      capability: "epic.update",
    },
    {
      step: "Change the horizon after business-case sign-off",
      who: "Portfolio management",
      capability: "epic.portfolio_override",
    },
    { step: "Set “I need help”", who: "**the owner alone**" },
    {
      step: "See the requests in “my tasks”",
      who: "Portfolio manager (all of them); otherwise the value stream's portfolio manager",
    },
    { step: "Delete an epic", who: "Portfolio manager / admin", capability: "epic.delete" },
  ],
};
