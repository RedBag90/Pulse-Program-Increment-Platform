import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Der Mandant und seine Menschen“ — the English reading. The versioned long
 * form lives at `docs/concepts/tenant-onboarding-walkthrough.md` and stays
 * German, with the code look-up points alongside.
 *
 * As in the German file, the platform stations carry **no jump targets**:
 * `/platform/...` sits outside the tenant area and so outside `(dashboard)`,
 * `moduleForPath` does not know the segment, and the route guard locks it
 * fail-closed. A “this way” link there would be a dead end for everyone but
 * the operator — so those stations name the path in the text and carry no
 * button.
 *
 * Structure, slug, cadence, module and the `capability` entries in `who` are
 * the same as in `../de/tenant-onboarding.ts`; `guides-parity.test.ts` holds
 * them together. What differs here is only the prose.
 */
export const TENANT_ONBOARDING_EN: Guide = {
  slug: "der-mandant-und-seine-menschen",
  title: "The tenant and its people",
  teaser: "Request, modules, invitation, role, tour.",
  standfirst:
    "How a request becomes a workspace and an email address becomes somebody who is allowed to do something. This is the procedure that comes **before** all the others: it alone has a real state machine, and it is the only one in which it is decided who can see the rest at all.",
  cadence: "einmalig",
  seeAlso: ["ein-portfolio-entsteht"],

  mechanics: [
    {
      kind: "quote",
      text: "Three barriers, not one.",
    },
    {
      kind: "paragraph",
      text: "Whether somebody sees a surface is settled in **three independent** places — and they get confused with one another regularly.",
    },
    {
      kind: "table",
      head: ["Barrier", "What it governs", "Who sets it"],
      rows: [
        [
          "**Entitlement** (module)",
          "whether the tenant has bought the area",
          "the platform operator",
        ],
        ["**Practice**", "whether the tenant wants to work that way", "the tenant itself"],
        ["**Capability** (right)", "whether **this role** may do it", "the tenant administrator"],
      ],
    },
    {
      kind: "paragraph",
      text: "The rule is an **and**: what is visible is what all three permit. And it is **fail-closed** — a path the registry does not know is locked, not open.",
    },
    { kind: "figure", figure: "moduleMap" },
    {
      kind: "aside",
      text: "A private area gets only `core`, an organisation all five. Buy a module and you get its prerequisites with it — without epics there would be nothing to budget.",
    },
    {
      kind: "quote",
      text: "The default holds only as long as nothing is stored.",
    },
    {
      kind: "paragraph",
      text: "That is the statement this whole procedure rests on, and it catches everybody out once. A role's rights stand **twice over**: as a default in the code and as rows in the database. On sign-in the rows are loaded — and the fall back to the default is **all or nothing**.",
    },
    {
      kind: "code",
      text: `the tenant has NO row for the user's roles
    → the code default applies, in full

it has even ONE
    → its stored bundle applies, in full,
      and the code default is never read at all`,
    },
    {
      kind: "paragraph",
      text: "That is not a fault but the price of letting a tenant cut its own roles. But the consequence has to be understood: **a new default in the code reaches only those tenants that never touched their roles.**",
    },
    {
      kind: "note",
      text: "**Measured, September 2026.** When the right to create ARTs moved from the tenant admin to the portfolio manager, **16 of 20** tenants inherited it immediately — they had no rows. Of the remaining four, one happened to carry it already; **three did not get it** and had to add it under _roles & capabilities_.",
    },
    {
      kind: "aside",
      text: "**The platform rights do not run through the permission check.** They appear in the action list but have an **empty** grant list: no role, no admin path. They are enforced solely by the global platform guard. Anyone reading the role matrix as complete permission documentation is led astray here.",
    },
  ],

  perspectives: [
    {
      label: "The platform operator",
      role: "platform_admin",
      question: "Who gets an area, and what is in it?",
      stations: [
        {
          title: "The request",
          body: [
            {
              kind: "paragraph",
              text: "Somebody fills in the **request an organisation** form at `/request-tenant`. It reaches me under **tenant requests** (`/platform/provision-requests`).",
            },
            {
              kind: "paragraph",
              text: "The subtitle there already says this is **one** act and not three: approval creates the tenant **and** the invitation.",
            },
          ],
        },
        {
          title: "The tenant and its modules",
          body: [
            {
              kind: "paragraph",
              text: "A tenant's detail page carries three sections: **modules**, **members**, **lifecycle**.",
            },
            {
              kind: "paragraph",
              text: "**Modules** is where the first of the three barriers is set. Whatever is not enabled here does not exist for this tenant — the route is **locked, not merely empty**. Prerequisites are satisfied automatically along the way.",
            },
            {
              kind: "paragraph",
              text: "**Lifecycle** carries the states. A suspended tenant redirects its users to a page of its own; a decommissioned one is the substitute for deletion once there is anything inside.",
            },
          ],
        },
        {
          title: "What I expressly do not do",
          body: [
            {
              kind: "paragraph",
              text: "I see every tenant's join requests at `/platform/join-requests` — **read-only**; the approval rests with the tenant admin in question.",
            },
            {
              kind: "quote",
              text: "I see that somebody is knocking; I do not open the door.",
            },
            {
              kind: "paragraph",
              text: "That is deliberate: who belongs in an area is known by the area — not by the platform.",
            },
          ],
        },
      ],
    },

    {
      label: "The tenant administrator",
      role: "tenant_admin",
      question: "Who works here, and what may they do?",
      stations: [
        {
          title: "Two ways in",
          route: "/admin/users",
          anchor: "admin-user-list",
          body: [
            {
              kind: "paragraph",
              text: "**The first is the invitation.** I open **invite a new user** and enter an email address and a role. The role is settled from the outset — there is no role-less intermediate state.",
            },
            {
              kind: "paragraph",
              text: "**The second is self-service joining.** Under _requests_ I keep an invitation link and a join code.",
            },
          ],
        },
        {
          title: "Link, code and open requests",
          route: "/admin/anfragen",
          body: [
            {
              kind: "table",
              head: ["Thing", "What I do with it"],
              rows: [
                ["**Invitation link**", "create, copy, **regenerate**, **deactivate**"],
                ["**Join code**", "the same thing in short, for reading aloud"],
                ["**Confirm joins automatically**", "a tick-box that skips the approval"],
                [
                  "**Open requests**",
                  "per row the email, whether via link or code, **approve** / **reject**",
                ],
              ],
            },
            {
              kind: "paragraph",
              text: "Whoever opens the link lands on a page that asks only for their email address. If the link is dead it says **link invalid** rather than showing an empty form.",
            },
            {
              kind: "note",
              text: "**Regenerating is not tidying up but revoking.** The old link no longer works afterwards. Anyone holding it in an email from last week cannot get in — that is the point.",
            },
          ],
        },
        {
          title: "Granting and withdrawing roles",
          route: "/admin/users",
          body: [
            {
              kind: "paragraph",
              text: "On a user's detail page I grant and withdraw roles. **The role model has no inheritance** — a higher role does not contain the lower one. Whoever is to do two things gets two roles.",
            },
            {
              kind: "paragraph",
              text: "Some roles carry a **scope**: the value stream owner may change their epics only within their own value streams, the RTE may distribute only on their own ARTs. **The scope is set when granting, not on the right.**",
            },
            { kind: "figure", figure: "roleList" },
            {
              kind: "aside",
              text: "Older names — transformation lead, VMO, team editor — have been absorbed into these. “VMO” lives on only as a field name on the value stream and in sign-off texts.",
            },
          ],
        },
        {
          title: "Adjusting rights",
          route: "/admin/roles",
          anchor: "admin-roles-nav",
          body: [
            {
              kind: "paragraph",
              text: "**Roles & capabilities**: grant or withdraw individual rights per role. For each role the difference from the default is written out.",
            },
            {
              kind: "code",
              text: "Δ vs. default:  +2 added · −1 withdrawn · 0 scope",
            },
            {
              kind: "paragraph",
              text: "Beside it stands **reset to default**, with a confirmation. This is exactly where you add what a new code default no longer reached — see the shared mechanics.",
            },
            {
              kind: "note",
              text: "**Separation of duties, on purpose.** “Who invites people” and “who grants permissions” are two different rights. By default they sit with the same role, but they **need not**.",
            },
          ],
        },
        {
          title: "The rest of the area",
          route: "/admin/integrations",
          body: [
            {
              kind: "table",
              head: ["Surface", "What for"],
              rows: [
                [
                  "**Custom fields**",
                  "**define** your own fields on goals — they are filled in by the goal owners",
                ],
                [
                  "**Integrations**",
                  "project mapping to Jira and Azure DevOps; _disconnect_ removes them along with the mapping",
                ],
                ["**Audit log**", "who changed what, and when"],
              ],
            },
            {
              kind: "paragraph",
              text: "Plus the **GDPR deletion** of a user on their detail page — not deactivation but deletion.",
            },
          ],
        },
        {
          title: "The setup guide",
          route: "/setup",
          body: [
            {
              kind: "paragraph",
              text: "The guide is the one entry in the _administration_ group that **requires no right** — everybody sees it. Eight milestones, each with an outcome, an owner, and the surfaces it happens on.",
            },
            {
              kind: "paragraph",
              text: "The ticks are **shared across the tenant**, not personal: it is the state of the programme, not my to-do list. Only somebody who may manage people can tick them off; everybody else reads along.",
            },
          ],
        },
      ],
    },

    {
      label: "The newcomer",
      question: "What am I actually meant to do here?",
      stations: [
        {
          title: "Arriving",
          body: [
            {
              kind: "paragraph",
              text: "I click the link or enter the code, confirm my email — and depending on how the area is configured I am straight in or waiting for approval.",
            },
            {
              kind: "paragraph",
              text: "After that I do not land on a home page for everyone, but on the one that matches **my** modules.",
            },
          ],
        },
        {
          title: "The window I cannot dismiss",
          body: [
            {
              kind: "paragraph",
              text: "As soon as a role is granted to me a window opens. It shows what the role stands for and offers two buttons: **accept the role & start the tour** or **accept, tour later**.",
            },
            {
              kind: "quote",
              text: "You can postpone the tour, but not the acknowledgement.",
            },
            {
              kind: "paragraph",
              text: "The thought behind it is plain: a role is an assignment of responsibility, and you should have read it once.",
            },
            {
              kind: "aside",
              text: "A second, gentler window appears when **my cut** changes — a module is added, a practice is switched on, a right is granted. Then it carries exactly the **new** steps, and the button reads **take a look**.",
            },
          ],
        },
        {
          title: "The tour",
          body: [
            {
              kind: "paragraph",
              text: "The tour is neither a video nor a chain of pop-ups. It **navigates** into the application, highlights a real control, and says in two sentences what it does. If it cannot find the element it shows the explanation centred rather than giving up.",
            },
            {
              kind: "paragraph",
              text: "It shows me only what I actually have: steps for disabled modules, switched-off practices or missing rights drop out — and the numbering still runs without gaps. Steps also drop out when there is nothing yet to show: a step about epics waits until there are epics.",
            },
            {
              kind: "note",
              text: "**What is stored is not progress but a set.** Not “stopped at step 4” but “saw these steps”. Which is why resuming lands on the **first outstanding** step, not the one after the last — and why a module switched on later can add exactly its own steps without repeating everything.",
            },
          ],
        },
        {
          title: "My role as a reference",
          route: "/meine-rolle",
          body: [
            {
              kind: "paragraph",
              text: "The page is in no menu — the way there is through the user menu. It carries four sections per role:",
            },
            {
              kind: "list",
              items: [
                "the **mission** in one sentence",
                "**your responsibility**",
                "**how it fits together** — whom I take over from, whom I hand on to",
                "**your surfaces** as a checked-off list with a progress pill",
              ],
            },
            {
              kind: "paragraph",
              text: "Beneath that, **start the tour again**. Anyone holding several roles gets several such panels — not one blended together.",
            },
            {
              kind: "aside",
              text: "**Every** role carries the right to this, expressly including the read-only one — that role needs an introduction most of all. And it is pure self-service: only your own row is written.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "A new rights default in the code applies to everyone.",
      why: "Only to tenants **without** stored rows. Anyone who ever adjusted a role keeps their bundle in full — including the gap in it.",
    },
    {
      claim: "The role matrix shows every permission.",
      why: "The platform rights have empty grant lists and bypass the permission check; they are enforced by the global guard.",
    },
    {
      claim: "The platform operator lets people into an area.",
      why: "They see the requests but do not decide. The tenant admin does.",
    },
    {
      claim: "A higher role contains the lower one.",
      why: "The role model has no inheritance. Two jobs means two roles.",
    },
    {
      claim: "The setup guide is my personal list.",
      why: "The ticks are shared across the tenant — it is the state of the programme, not mine.",
    },
    {
      claim: "A disabled module makes the page empty.",
      why: "It makes it **locked**. Unregistered paths are fail-closed, not open.",
    },
    {
      claim: "Creating and filling custom fields is the same right.",
      why: "Defining is the admin's job, filling is the goal owners'.",
    },
    {
      claim: "The tour remembers where I was.",
      why: "It remembers **what I have seen**. Resuming lands on the first outstanding step.",
    },
    {
      claim: "The welcome window can be dismissed.",
      why: "Not for a new role. The tour can be postponed, the acknowledgement cannot.",
    },
  ],

  who: [
    {
      step: "Create a tenant, set modules, suspend, decommission",
      who: "Platform operator",
    },
    { step: "Decide a tenant request", who: "Platform operator" },
    {
      step: "Invite, grant and withdraw roles, GDPR deletion",
      who: "Tenant admin",
      capability: "tenant.users.manage",
    },
    {
      step: "Create, regenerate and deactivate the invitation link; approve requests",
      who: "Tenant admin",
      capability: "tenant.users.manage",
    },
    {
      step: "Set, withdraw and reset capabilities per role",
      who: "Tenant admin",
      capability: "role.capability.manage",
    },
    {
      step: "Custom-field definitions",
      who: "Tenant admin",
      capability: "goal.custom_field.manage",
    },
    {
      step: "Connect and disconnect integrations",
      who: "Tenant admin",
      capability: "integration.manage",
    },
    { step: "Read the audit log", who: "Tenant admin", capability: "admin.audit-log.read" },
    {
      step: "Tick off setup milestones",
      who: "Tenant admin",
      capability: "tenant.users.manage",
    },
    {
      step: "Accept a role, see and restart the tour",
      who: "**every** role, the read-only one included",
      capability: "role.onboarding.manage",
    },
  ],
};
