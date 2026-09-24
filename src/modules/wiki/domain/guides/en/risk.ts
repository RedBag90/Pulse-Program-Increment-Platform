import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Was dazwischenkommt“ — the English reading.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/risk.ts`; `guides-parity.test.ts` holds them together.
 * What differs here is only the prose.
 */
export const RISK_EN: Guide = {
  slug: "was-dazwischenkommt",
  title: "What gets in the way",
  teaser: "Report, accept, ROAM.",
  standfirst:
    "One register for risks and blockers, two independent axes, and one act with an immediate effect on the rhythm. Told three times over: from the view of the person who reports, the person who accepts, and the person who classifies.",
  cadence: "querschnitt",
  module: "risks",
  seeAlso: ["ein-pi-von-anfang-bis-ende", "was-liefert-was-blockiert"],

  mechanics: [
    {
      kind: "paragraph",
      text: "Pulse keeps **one** tenant-wide register. Risks and impediments used to be two tables; they were merged, because in practice nobody can say up front whether an observation is the one or the other.",
    },
    { kind: "quote", text: "What counts is what happens to it." },
    {
      kind: "paragraph",
      text: "And that runs on **two independent axes** — the one thing you have to have understood.",
    },
    {
      kind: "paragraph",
      text: "**Axis 1 · The review: does it enter the register?** A proposal is not yet an entry. Only a proposal can be reviewed; the decision leads either **into** the register or **past** it. An entry once reviewed cannot be reviewed again — the axis runs one way.",
    },
    {
      kind: "aside",
      text: "The default of a **newly created** issue is “documented”: whoever has the right to document directly does not go through the proposal loop.",
    },
    { kind: "paragraph", text: "**Axis 2 · ROAM: what do we do about it?**" },
    { kind: "figure", figure: "roamAxes" },
    {
      kind: "note",
      text: "**The two axes do not interlock.** An entry can be documented and still open — that is in fact the most common state shortly after creation, **and it is precisely that state which surfaces at the PI closing.** ROAM and exposure apply only to documented entries; classifying a proposal would mean deciding about something nobody has accepted yet.",
    },
    { kind: "quote", text: "The exposure: one assessment, two figures." },
    {
      kind: "paragraph",
      text: "**Likelihood × impact**, each on a five-point scale. Their product is the score from 1 to 25, and that falls into a band.",
    },
    { kind: "figure", figure: "exposureMatrix" },
    {
      kind: "paragraph",
      text: "**The same function colours the row in the list and the cell in the matrix** — which is why the two cannot drift apart. An assessment is **optional**: an entry without one is unscored and sorts to the end, rather than claiming a zero.",
    },
    {
      kind: "paragraph",
      text: "On top of that come an optional **category**, a **running number** per tenant as a handle in conversation, the link to an **epic or feature**, and the option to bundle entries under a head issue.",
    },
    {
      kind: "aside",
      text: "The assessments are **kept as history**: every re-assessment is its own row with a date and a note. So you see not only how risky something is, but **how that judgement has developed**.",
    },
  ],

  perspectives: [
    {
      label: "Reporting",
      question: "How do I get an observation off my hands?",
      stations: [
        {
          title: "Reporting is always open to me",
          route: "/issues",
          anchor: "issue-create-button",
          body: [
            {
              kind: "paragraph",
              text: "I see something that is going to hold us up. Perhaps I am a feature owner and notice that an interface will not be ready in time; perhaps I am a read-only user and know of a contract that is running out.",
            },
            {
              kind: "paragraph",
              text: "The right to report sits with **every** role, down to the read-only user — and that is deliberate:",
            },
            {
              kind: "quote",
              text: "Observations are worthless if the way to get rid of them hangs off a permission.",
            },
            {
              kind: "paragraph",
              text: "What I write down is a title and, if I can, a description. **I do not have to assess it** — likelihood and impact may be judged by whoever has more of an overview. What I contribute is the observation.",
            },
          ],
        },
        {
          title: "What happens to my entry afterwards",
          body: [
            {
              kind: "paragraph",
              text: "It sits at **proposed**. It is in the system, but not yet in the register: it carries no exposure, does not appear in the matrix, and **it blocks no PI closing either**. It waits for somebody to look at it.",
            },
          ],
        },
      ],
    },

    {
      label: "Accepting",
      role: "rte",
      question: "Is this a thing?",
      stations: [
        {
          title: "A binary, one-time decision",
          route: "/issues",
          anchor: "issues-funnel-bar",
          body: [
            {
              kind: "paragraph",
              text: "**Accept** or **reject**. Something already reviewed I cannot review again — the axis runs forward.",
            },
            {
              kind: "paragraph",
              text: "If I accept, the entry is in the register. Now it deserves an **assessment**, and only with that does it carry a weight you can work with. I can also **link** it: to the epic or feature it hangs off, and to a head issue when several entries share a theme.",
            },
          ],
        },
        {
          title: "Rejecting is not deleting",
          body: [
            {
              kind: "paragraph",
              text: "If I reject, **nothing disappears**. The entry stays — traceable that somebody saw it and decided.",
            },
            {
              kind: "quote",
              text: "A proposal that vanishes without a trace is a reason to report nothing next time.",
            },
            {
              kind: "paragraph",
              text: "My reach depends on where I stand: as a portfolio manager or RTE it is tenant-wide, as an epic owner **only within my value stream**. That is the same boundary that holds elsewhere in the product — **you decide where you carry the consequences.**",
            },
          ],
        },
      ],
    },

    {
      label: "ROAMing",
      role: "portfolio_manager",
      question: "How do I release the rhythm again?",
      stations: [
        {
          title: "The state that comes back",
          route: "/issues?matrix=1",
          anchor: "risk-matrix",
          body: [
            {
              kind: "paragraph",
              text: "A documented entry starts at **open**: it is there, it is assessed, but nobody has said what becomes of it. My job is the classification — four options, and **none of them means “ignore”**.",
            },
          ],
        },
        {
          title: "The act with the most immediate effect",
          body: [
            {
              kind: "quote",
              text: "An open, unclassified issue reports back at the PI closing.",
            },
            {
              kind: "paragraph",
              text: "At the full gate of the interface it **blocks**; in the interface it **warns**. In both cases it is exactly one sentence — and it only goes away when somebody decides.",
            },
            {
              kind: "paragraph",
              text: "What is remarkable is what this is **not**: it is no demand to solve the risk. _Accepted_ is enough.",
            },
            {
              kind: "quote",
              text: "What is required is not the removal, but the decision.",
            },
            {
              kind: "paragraph",
              text: "That a period does not end without somebody having taken a position on every open point — that is the whole purpose.",
            },
          ],
        },
        {
          title: "Where risks enter the steering",
          route: "/portfolio",
          body: [
            {
              kind: "paragraph",
              text: "The portfolio overview shows the documented entries as a **ROAM board**: one tile each for open, owned, resolved, accepted and mitigated, ordered inside by criticality. “Open” stands alone in the first column — that is the set still to be decided. It is **the only place where risks step out of the register into the steering view**.",
            },
            {
              kind: "aside",
              text: "On the epic page the risks of the whole feature subtree are rolled up: you see at the epic what lies beneath it, without searching for it one by one.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "A documented issue is classified.",
      why: "The two axes are independent. Documented **and** open is the most common state — and exactly the one that surfaces at the PI closing.",
    },
    {
      claim: "ROAM means removing the risk.",
      why: "_Accepted_ is enough. What is required is the **decision**, not the removal.",
    },
    {
      claim: "Only those who may assess may report.",
      why: "The right to report sits with every role, down to the read-only user.",
    },
    {
      claim: "A rejected proposal disappears.",
      why: "It stays on record as rejected — traceable that somebody saw it and decided.",
    },
    {
      claim: "A proposal blocks the PI closing.",
      why: "It carries no exposure and is not in the register. Only documented, unclassified entries come back.",
    },
    {
      claim: "A completed review can be revised.",
      why: "The review axis runs **one** way. An entry once reviewed cannot be reviewed again.",
    },
    {
      claim: "An entry without an assessment counts as a low risk.",
      why: "It is unscored and sorts to the end — rather than claiming a zero.",
    },
    {
      claim: "Risks and blockers are two registers.",
      why: "It is one. Nobody can say up front whether an observation is the one or the other.",
    },
  ],

  who: [
    {
      step: "Report an observation",
      who: "**every** role, the read-only user included",
      capability: "risk.suggest",
    },
    {
      step: "Review a proposal — accept or reject",
      who: "portfolio manager, RTE; epic owner **limited to their value stream**",
      capability: "risk.review",
    },
    {
      step: "Document, assess and link directly",
      who: "the same",
      capability: "risk.document",
    },
    { step: "Set ROAM", who: "the same", capability: "risk.roam" },
    { step: "Delete an entry", who: "portfolio manager / admin", capability: "risk.delete" },
  ],
};
