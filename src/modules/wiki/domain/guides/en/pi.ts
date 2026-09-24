import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein PI von Anfang bis Ende“ — the English reading. The versioned long form
 * lives at `docs/concepts/pi-walkthrough.md` and stays German.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/pi.ts`; `guides-parity.test.ts` holds them together.
 * What differs here is only the prose.
 */
export const PI_EN: Guide = {
  slug: "ein-pi-von-anfang-bis-ende",
  title: "A PI from start to finish",
  teaser: "Run the cadence, deliver, roll forward.",
  standfirst:
    "The beat: when a period begins, how the work runs inside it, and what ends it. Told three times over — from the view of the RTE who runs the cadence, the feature owner who delivers, and the epic owner who watches their endeavour take shape.",
  cadence: "je_pi",
  module: "drumbeat",
  seeAlso: ["was-liefert-was-blockiert", "was-dazwischenkommt", "ein-epic-reift"],

  mechanics: [
    {
      kind: "paragraph",
      text: "A program increment passes through three states: **planned → active → completed**. Strictly forward, no way back, and completed is final. Two rules frame that:",
    },
    {
      kind: "list",
      items: [
        "**One active PI per timeline.** Starting a second one fails, naming the PI that is in the way. **A cadence is a sequence, not a cloud.**",
        "**A PI without a timeline can neither be started nor rolled forward.** The timeline carries the beat; a PI beside it would be an appointment without a calendar.",
      ],
    },
    {
      kind: "paragraph",
      text: "The beat itself is **not** maintained on the PI but on the **timeline's PI standard**: anchor day, anchor month, cadence in weeks, count. The PIs follow from it. An ART **joins a timeline** and takes on its beat — it carries no cadence of its own.",
    },
    { kind: "quote", text: "The closing gate — and why there are two ways through it." },
    {
      kind: "paragraph",
      text: "Closing a PI means claiming that a period is genuinely over. Pulse has a gate for that, with four conditions:",
    },
    {
      kind: "table",
      head: ["Condition", "Why"],
      rows: [
        [
          "no open concerns **without ROAM**",
          "A risk nobody has classified would otherwise drift unnoticed into the next PI",
        ],
        ["system demo date set", "There was an occasion to show the result"],
        ["inspect & adapt date set", "There was an occasion to learn from it"],
        ["retrospective notes present", "What was learned is written down somewhere"],
      ],
    },
    {
      kind: "note",
      text: "**Today that gate is reachable only through the API.** The interface offers exactly one way to end a PI — _close the PI and open the next_ — and it checks only the open ROAM concerns, and those only as a **warning** that does not block. The three ceremonies are not checked there at all.",
    },
    {
      kind: "paragraph",
      text: "That is not an oversight but a deliberate gap, and the reason is written in the code: **there is no surface for setting the three dates.** A gate nobody can open would bring the work to a halt.",
    },
    {
      kind: "quote",
      text: "Anyone who wants the gate to bite needs the surface for it first.",
    },
  ],

  perspectives: [
    {
      label: "The RTE",
      role: "rte",
      question: "How do I run the cadence?",
      stations: [
        {
          title: "The PIs are already in the calendar",
          route: "/structure/timelines",
          body: [
            {
              kind: "paragraph",
              text: "My timeline has a PI standard, and the coming PIs already stand there because of it. **I do not have to create them; I have to decide when one starts.**",
            },
          ],
        },
        {
          title: "PI planning",
          route: "/umsetzung",
          anchor: "cockpit-pi-strip",
          body: [
            {
              kind: "paragraph",
              text: "It **no longer has a surface of its own** — it happens in the cockpit. There I assign features to PIs and see the capacity against them: job size and € budget per PI, both **overridable per PI** when the derived figure does not fit.",
            },
            {
              kind: "quote",
              text: "What gets assigned here is the content I am about to say we can manage.",
            },
          ],
        },
        {
          title: "Starting",
          body: [
            {
              kind: "paragraph",
              text: "Pulse checks two things: that the PI is _planned_ — a completed one cannot be started again — and that no other PI on the same timeline is already active.",
            },
            {
              kind: "paragraph",
              text: "The second is the rule that catches me most often, and **it is right that it does**: two active PIs side by side would mean nobody can say which beat the work is running on.",
            },
          ],
        },
        {
          title: "Living in the cockpit",
          route: "/umsetzung",
          anchor: "cockpit-pi-context",
          body: [
            {
              kind: "paragraph",
              text: "It shows the matrix of PIs and features, the delivery status of every row, and where things are stuck. **An ART or a PI is not a place of its own but a cut through the same surface** — the former routes redirect exactly there.",
            },
          ],
        },
        {
          title: "Rolling the cadence forward",
          body: [
            {
              kind: "paragraph",
              text: "**Close the PI and open the next** is one transaction: the running PI moves to _completed_, the next one opens. If there is no next one, Pulse creates it from the cadence.",
            },
            {
              kind: "paragraph",
              text: "If there are open concerns without ROAM, Pulse tells me so as a **warning**; I can roll forward anyway — **but then I know.**",
            },
            {
              kind: "aside",
              text: "What I do **not** get along the way is the standard the closing gate sets out: nobody here asks me about the system demo, inspect & adapt, or the retrospective. Anyone who wants that discipline has to keep it outside Pulse for now.",
            },
          ],
        },
      ],
    },

    {
      label: "The feature owner",
      role: "feature_owner",
      question: "What do I contribute day to day?",
      stations: [
        {
          title: "A status that is a commitment",
          route: "/umsetzung",
          anchor: "cockpit-table",
          body: [
            {
              kind: "paragraph",
              text: "My feature is assigned to a PI — PI planning decided that. For me the work begins with the delivery status.",
            },
            { kind: "figure", figure: "deliveryChain" },
            {
              kind: "paragraph",
              text: "I set that status myself. It is the one place where I contribute something daily — **and the figure everything else is derived from**: the progress shown on my epic, my ART's load, the question of whether the PI can close.",
            },
          ],
        },
        {
          title: "The system demo — in the conditional",
          body: [
            {
              kind: "paragraph",
              text: "At the system demo I would contribute what I have built: a PI's demo **would be** an ordered list of items, each free to point at a feature. It would be the one occasion on which a PI's result is shown **not as a status but as a thing**.",
            },
            {
              kind: "note",
              text: "**In the conditional, and that is not a turn of phrase.** The service behind it is fully built, integration test included; a server action and a surface do not exist. The right can be granted but not exercised. This is the same gap that blunts the closing gate above — **here it is the cause, there the effect.**",
            },
          ],
        },
        {
          title: "What I notice",
          route: "/issues",
          body: [
            {
              kind: "paragraph",
              text: "If I notice something that is holding us up, I report it as a **concern**. All that counts here: **a reported concern that nobody has classified turns up again at the PI close.**",
            },
          ],
        },
      ],
    },

    {
      label: "The epic owner",
      role: "epic_owner",
      question: "What have I got to do with the beat?",
      stations: [
        {
          title: "I deliver nothing",
          body: [
            {
              kind: "paragraph",
              text: "My epic sits at **L4.1 · delivery under way**, and what happens now happens to my features. What I see is **derivation**: how many of my child features have started and how many are done.",
            },
            {
              kind: "paragraph",
              text: "That is at the same time the criterion for my next step. **Advisory, not blocking**: I can file the request earlier, and then the outstanding number stands beside it and the approvers decide.",
            },
          ],
        },
        {
          title: "What the beat gives me",
          body: [
            {
              kind: "paragraph",
              text: "Something the maturity ladder alone would not: a **rhythm**. Between L4.1 and L4.2 lie one or more PIs, and each of them has an end at which what has been built gets shown.",
            },
            {
              kind: "quote",
              text: "My epic moves not because somebody moved it, but because a period has passed in which work was done.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "The interface checks the four closing conditions.",
      why: "It checks one of them, and that only as a warning. The full gate exists only through the API.",
    },
    {
      claim: "An ART has a cadence of its own.",
      why: "It **joins a timeline** and takes on its beat. The cadence hangs on the timeline's PI standard.",
    },
    {
      claim: "Two PIs on the same timeline can run in parallel.",
      why: "Starting a second one fails — naming the PI that is in the way.",
    },
    {
      claim: "A completed PI can be reopened.",
      why: "The path runs strictly forward. Completed is final.",
    },
    {
      claim: "There is a dedicated PI planning surface.",
      why: "It happens in the cockpit; the old route redirects there.",
    },
    {
      claim: "The system demo can be maintained in Pulse.",
      why: "The service is built, the surface is not. The right can be granted but not exercised.",
    },
    {
      claim: "Closing the PI moves my epic on.",
      why: "Nothing advances by itself. An epic moves through a requested step.",
    },
    {
      claim: "The beat and the money are connected.",
      why: "Money is decided per half-year, delivery happens per PI. They touch only indirectly, through the job size.",
    },
  ],

  who: [
    { step: "Create, change, delete a PI", who: "RTE", capability: "pi.create" },
    { step: "Start a PI", who: "RTE, value stream owner", capability: "pi.start" },
    {
      step: "Roll the cadence forward (the way through the interface)",
      who: "RTE, value stream owner",
      capability: "pi.advance",
    },
    {
      step: "Close a PI (full gate, API only)",
      who: "RTE, value stream owner",
      capability: "pi.complete",
    },
    {
      step: "Maintain a timeline's PI standard",
      who: "Tenant admin, portfolio manager",
      capability: "pi_standard.manage",
    },
    {
      step: "Create a timeline, let an ART join it",
      who: "Tenant admin, portfolio manager",
      capability: "timeline.manage",
    },
    {
      step: "Delivery status of a feature",
      who: "Feature owner, RTE, portfolio manager",
      capability: "feature.delivery.set",
    },
    {
      step: "Maintain the system demo — **no surface**",
      who: "RTE, feature owner",
      capability: "pi.demo.manage",
    },
  ],
};
