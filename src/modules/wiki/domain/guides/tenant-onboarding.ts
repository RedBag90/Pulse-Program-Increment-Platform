import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Der Mandant und seine Menschen“ — die versionierte Langfassung liegt unter
 * `docs/concepts/tenant-onboarding-walkthrough.md`, dort zusaetzlich mit den
 * Nachschlagepunkten im Code.
 *
 * **Die Plattform-Flaechen tragen keine Sprungziele.** `/platform/...` liegt
 * ausserhalb des Mandanten-Bereichs und damit ausserhalb von `(dashboard)`;
 * `moduleForPath` kennt das Segment nicht, der Route-Guard sperrt es
 * fail-closed. Ein „Hier entlang" dorthin waere fuer alle ausser dem Betreiber
 * eine Sackgasse — deshalb steht bei diesen Stationen der Pfad im Text und
 * kein Knopf daneben.
 */
export const TENANT_ONBOARDING: Guide = {
  slug: "der-mandant-und-seine-menschen",
  title: "Der Mandant und seine Menschen",
  teaser: "Anfrage, Module, Einladung, Rolle, Tour.",
  standfirst:
    "Wie aus einer Anfrage ein Arbeitsbereich wird und aus einer E-Mail-Adresse jemand, der etwas darf. Dies ist der Ablauf **vor** allen anderen: er hat als einziger eine echte Zustandsmaschine, und er ist der einzige, in dem entschieden wird, wer die übrigen überhaupt sehen kann.",
  cadence: "einmalig",
  seeAlso: ["ein-portfolio-entsteht"],

  mechanics: [
    {
      kind: "quote",
      text: "Drei Schranken, nicht eine.",
    },
    {
      kind: "paragraph",
      text: "Ob jemand eine Fläche sieht, entscheidet sich an **drei unabhängigen** Stellen — und sie werden regelmäßig verwechselt.",
    },
    {
      kind: "table",
      head: ["Schranke", "Was sie regelt", "Wer sie stellt"],
      rows: [
        [
          "**Entitlement** (Modul)",
          "ob der Mandant den Bereich gebucht hat",
          "der Plattform-Betreiber",
        ],
        ["**Practice**", "ob der Mandant so arbeiten will", "der Mandant selbst"],
        ["**Capability** (Recht)", "ob **diese Rolle** es darf", "der Mandanten-Administrator"],
      ],
    },
    {
      kind: "paragraph",
      text: "Die Regel ist ein **Und**: sichtbar ist, was alle drei zulassen. Und sie ist **fail-closed** — ein Pfad, den die Registry nicht kennt, ist gesperrt, nicht offen.",
    },
    { kind: "figure", figure: "moduleMap" },
    {
      kind: "aside",
      text: "Ein privater Bereich bekommt nur `core`, eine Organisation alle fünf. Wer ein Modul bucht, bekommt seine Voraussetzungen dazu — ohne Epics wäre nichts zu budgetieren.",
    },
    {
      kind: "quote",
      text: "Der Default gilt nur, solange nichts gespeichert ist.",
    },
    {
      kind: "paragraph",
      text: "Das ist die Aussage, die diesen ganzen Ablauf trägt, und sie überrascht jeden einmal. Die Rechte einer Rolle stehen **zweimal**: als Vorgabe im Code und als Zeilen in der Datenbank. Beim Anmelden werden die Zeilen geladen — und der Rückfall auf die Vorgabe ist **alles-oder-nichts**.",
    },
    {
      kind: "code",
      text: `hat der Mandant KEINE Zeile für die Rollen des Nutzers
    → die Code-Vorgabe gilt, vollständig

hat er auch nur EINE
    → sein gespeichertes Bündel gilt, vollständig,
      und die Code-Vorgabe wird gar nicht erst gelesen`,
    },
    {
      kind: "paragraph",
      text: "Das ist kein Fehler, sondern der Preis dafür, dass ein Mandant seine Rollen selbst schneiden darf. Die Folge muss man aber kennen: **eine neue Vorgabe im Code erreicht nur die Mandanten, die ihre Rollen nie angefasst haben.**",
    },
    {
      kind: "note",
      text: "**Gemessen, September 2026.** Als das Recht, ARTs anzulegen, vom Tenant-Admin zum Portfolio Manager wanderte, erbten **16 von 20** Mandanten es sofort — sie hatten keine Zeilen. Von den vier übrigen trug einer es zufällig schon; **drei bekamen es nicht** und mussten es unter _Rollen & Capabilities_ nachtragen.",
    },
    {
      kind: "aside",
      text: "**Die Plattform-Rechte laufen nicht über die Rechteprüfung.** Sie stehen zwar in der Action-Liste, haben aber eine **leere** Grant-Liste: keine Rolle, kein Admin-Pfad. Durchgesetzt werden sie allein durch den globalen Plattform-Wächter. Wer die Rollen-Matrix als vollständige Berechtigungs-Doku liest, wird hier in die Irre geführt.",
    },
  ],

  perspectives: [
    {
      label: "Der Plattform-Betreiber",
      role: "platform_admin",
      question: "Wer bekommt einen Bereich, und was ist darin drin?",
      stations: [
        {
          title: "Die Anfrage",
          body: [
            {
              kind: "paragraph",
              text: "Jemand füllt auf `/request-tenant` das Formular **Organisation anfragen** aus. Bei mir landet das unter **Tenant-Anfragen** (`/platform/provision-requests`).",
            },
            {
              kind: "paragraph",
              text: "Der Untertitel dort sagt schon, dass das **eine** Handlung ist und nicht drei: die Genehmigung erzeugt den Mandanten **und** die Einladung.",
            },
          ],
        },
        {
          title: "Der Mandant und seine Module",
          body: [
            {
              kind: "paragraph",
              text: "Auf der Detailseite eines Mandanten liegen drei Abschnitte: **Module**, **Mitglieder**, **Lifecycle**.",
            },
            {
              kind: "paragraph",
              text: "**Module** ist der Ort, an dem die erste der drei Schranken gesetzt wird. Was hier nicht freigeschaltet ist, existiert für diesen Mandanten nicht — die Route ist **gesperrt, nicht bloß leer**. Voraussetzungen werden dabei automatisch mit erfüllt.",
            },
            {
              kind: "paragraph",
              text: "**Lifecycle** trägt die Zustände. Ein gesperrter Mandant leitet seine Nutzer auf eine eigene Seite um; ein stillgelegter ist der Ersatz fürs Löschen, sobald etwas drinsteht.",
            },
          ],
        },
        {
          title: "Was ich ausdrücklich nicht tue",
          body: [
            {
              kind: "paragraph",
              text: "Die Beitritts-Anfragen aller Mandanten sehe ich unter `/platform/join-requests` — **read-only**, die Freigabe liegt beim jeweiligen Tenant-Admin.",
            },
            {
              kind: "quote",
              text: "Ich sehe, dass jemand anklopft; ich öffne die Tür nicht.",
            },
            {
              kind: "paragraph",
              text: "Das ist bewusst so: wer in einen Bereich gehört, weiß der Bereich — nicht die Plattform.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Mandanten-Administrator",
      role: "tenant_admin",
      question: "Wer arbeitet hier mit, und was darf er?",
      stations: [
        {
          title: "Zwei Wege herein",
          route: "/admin/users",
          anchor: "admin-user-list",
          body: [
            {
              kind: "paragraph",
              text: "**Der erste ist die Einladung.** Ich öffne **Neue:n Benutzer:in einladen** und trage E-Mail-Adresse und Rolle ein. Die Rolle steht damit von Anfang an fest — einen rollenlosen Zwischenstand gibt es nicht.",
            },
            {
              kind: "paragraph",
              text: "**Der zweite ist der Selbst-Beitritt.** Unter _Anfragen_ führe ich Einladungslink und Beitrittscode.",
            },
          ],
        },
        {
          title: "Link, Code und offene Anfragen",
          route: "/admin/anfragen",
          body: [
            {
              kind: "table",
              head: ["Sache", "Was ich damit tue"],
              rows: [
                ["**Einladungslink**", "erstellen, kopieren, **Neu generieren**, **Deaktivieren**"],
                ["**Beitrittscode**", "dieselbe Sache in kurz, zum Vorlesen"],
                ["**Beitritt automatisch bestätigen**", "ein Haken, der die Freigabe überspringt"],
                [
                  "**Offene Anfragen**",
                  "je Zeile E-Mail, ob via Link oder Code, **Freigeben** / **Ablehnen**",
                ],
              ],
            },
            {
              kind: "paragraph",
              text: "Wer den Link öffnet, landet auf einer Seite, die nur nach der E-Mail-Adresse fragt. Ist der Link tot, sagt sie **Link ungültig** statt ein leeres Formular zu zeigen.",
            },
            {
              kind: "note",
              text: "**Neu generieren ist kein Aufräumen, sondern ein Widerruf.** Der alte Link gilt danach nicht mehr. Wer ihn in einer Mail von letzter Woche stehen hat, kommt nicht mehr herein — das ist der Zweck.",
            },
          ],
        },
        {
          title: "Rollen zuweisen und entziehen",
          route: "/admin/users",
          body: [
            {
              kind: "paragraph",
              text: "Auf der Detailseite eines Nutzers vergebe und entziehe ich Rollen. **Das Rollenmodell kennt keine Vererbung** — eine höhere Rolle enthält die niedrigere nicht. Wer zwei Dinge tun soll, bekommt zwei Rollen.",
            },
            {
              kind: "paragraph",
              text: "Manche Rollen tragen einen **Scope**: der Wertstrom-Owner darf seine Epics nur in seinen Wertströmen ändern, der RTE nur auf seinen ARTs verteilen. **Der Scope wird beim Zuweisen gesetzt, nicht beim Recht.**",
            },
            { kind: "figure", figure: "roleList" },
            {
              kind: "aside",
              text: "Ältere Bezeichnungen — Transformation Lead, VMO, Team-Editor — sind darin aufgegangen. „VMO“ lebt nur noch als Feldname am Wertstrom und in Freigabe-Texten weiter.",
            },
          ],
        },
        {
          title: "Rechte nachjustieren",
          route: "/admin/roles",
          anchor: "admin-roles-nav",
          body: [
            {
              kind: "paragraph",
              text: "**Rollen & Capabilities**: pro Rolle einzelne Rechte zuweisen oder entziehen. Je Rolle steht der Unterschied zur Vorgabe ausgeschrieben.",
            },
            {
              kind: "code",
              text: "Δ vs. Default:  +2 hinzugefügt · −1 entzogen · 0 Scope",
            },
            {
              kind: "paragraph",
              text: "Daneben steht **Auf Default zurücksetzen**, mit Rückfrage. Genau hier trägt man nach, was eine neue Code-Vorgabe nicht mehr erreicht hat — siehe die gemeinsame Mechanik.",
            },
            {
              kind: "note",
              text: "**Funktionstrennung, absichtlich.** „Wer Menschen einlädt“ und „wer Berechtigungen vergibt“ sind zwei verschiedene Rechte. Sie liegen im Standard bei derselben Rolle, aber sie **müssen** es nicht.",
            },
          ],
        },
        {
          title: "Der Rest des Bereichs",
          route: "/admin/integrations",
          body: [
            {
              kind: "table",
              head: ["Fläche", "Wofür"],
              rows: [
                [
                  "**Custom Fields**",
                  "eigene Felder an Zielen **definieren** — gefüllt werden sie von den Ziel-Verantwortlichen",
                ],
                [
                  "**Integrationen**",
                  "Projekt-Zuordnung zu Jira und Azure DevOps; _Disconnect_ trennt sie samt Mapping",
                ],
                ["**Audit-Log**", "wer wann was geändert hat"],
              ],
            },
            {
              kind: "paragraph",
              text: "Dazu die **DSGVO-Löschung** eines Nutzers auf seiner Detailseite — kein Deaktivieren, sondern Löschen.",
            },
          ],
        },
        {
          title: "Der Setup-Leitfaden",
          route: "/setup",
          body: [
            {
              kind: "paragraph",
              text: "Der Leitfaden ist der einzige Eintrag der Gruppe _Administration_, der **kein Recht verlangt** — jeder sieht ihn. Acht Meilensteine, jeder mit Ergebnis, Zuständigem und den Flächen, auf denen er passiert.",
            },
            {
              kind: "paragraph",
              text: "Die Häkchen sind **tenantweit geteilt**, nicht persönlich: es ist der Stand des Programms, nicht meine To-do-Liste. Abhaken darf nur, wer Menschen verwalten darf; alle anderen lesen mit.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Neue",
      question: "Was soll ich hier eigentlich tun?",
      stations: [
        {
          title: "Ankommen",
          body: [
            {
              kind: "paragraph",
              text: "Ich klicke den Link oder gebe den Code ein, bestätige meine E-Mail — und je nachdem, wie der Bereich eingestellt ist, bin ich sofort drin oder warte auf die Freigabe.",
            },
            {
              kind: "paragraph",
              text: "Danach lande ich nicht auf einer Startseite für alle, sondern auf der, die zu **meinen** Modulen passt.",
            },
          ],
        },
        {
          title: "Das Fenster, das ich nicht wegklicken kann",
          body: [
            {
              kind: "paragraph",
              text: "Sobald mir eine Rolle zugewiesen ist, öffnet sich ein Fenster. Es zeigt, wofür die Rolle steht, und bietet zwei Knöpfe: **Rolle annehmen & Tour starten** oder **Annehmen, Tour später**.",
            },
            {
              kind: "quote",
              text: "Man kann die Tour verschieben, nicht aber die Kenntnisnahme.",
            },
            {
              kind: "paragraph",
              text: "Der Gedanke dahinter ist schlicht: eine Rolle ist eine Zuschreibung von Verantwortung, und die sollte man einmal gelesen haben.",
            },
            {
              kind: "aside",
              text: "Ein zweites, milderes Fenster erscheint, wenn sich mein **Zuschnitt** ändert — ein Modul kommt dazu, eine Practice wird eingeschaltet, ein Recht wird nachgetragen. Dann stehen genau die **neuen** Schritte darin, und der Knopf heißt **Ansehen**.",
            },
          ],
        },
        {
          title: "Die Tour",
          body: [
            {
              kind: "paragraph",
              text: "Die Tour ist kein Video und keine Pop-up-Kette. Sie **navigiert** in die Anwendung, hebt ein echtes Bedienelement hervor und sagt in zwei Sätzen, was es tut. Findet sie das Element nicht, zeigt sie die Erklärung mittig, statt abzubrechen.",
            },
            {
              kind: "paragraph",
              text: "Sie zeigt mir nur, was ich auch wirklich habe: Schritte zu abgeschalteten Modulen, ausgeschalteten Practices oder fehlenden Rechten fallen weg — und die Nummerierung bleibt trotzdem lückenlos. Ebenso fallen Schritte weg, für die es noch keinen Bestand gibt: ein Schritt über Epics wartet, bis es Epics gibt.",
            },
            {
              kind: "note",
              text: "**Gespeichert wird kein Fortschritt, sondern eine Menge.** Nicht „bei Schritt 4 stehengeblieben“, sondern „diese Schritte gesehen“. Deshalb ist der Wiedereinstieg der **erste offene** Schritt, nicht der nächste nach dem letzten — und deshalb kann ein später zugeschaltetes Modul genau seine Schritte nachreichen, ohne alles zu wiederholen.",
            },
          ],
        },
        {
          title: "Meine Rolle als Nachschlagewerk",
          route: "/meine-rolle",
          body: [
            {
              kind: "paragraph",
              text: "Die Seite steht in keinem Menü — der Weg führt über das Benutzer-Menü. Sie trägt je Rolle vier Abschnitte:",
            },
            {
              kind: "list",
              items: [
                "die **Mission** in einem Satz",
                "**Deine Verantwortung**",
                "**Zusammenspiel** — wovon ich übernehme, an wen ich übergebe",
                "**Deine Flächen** als abgehakte Liste mit Fortschrittspille",
              ],
            },
            {
              kind: "paragraph",
              text: "Darunter **Tour erneut starten**. Wer mehrere Rollen trägt, bekommt mehrere solche Tafeln — nicht eine zusammengemischte.",
            },
            {
              kind: "aside",
              text: "Das Recht dafür trägt **jede** Rolle, ausdrücklich auch der Nur-Leser — gerade der braucht eine Einführung. Und es ist reine Selbstbedienung: geschrieben wird nur die eigene Zeile.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Eine neue Rechte-Vorgabe im Code gilt für alle.",
      why: "Nur für Mandanten **ohne** gespeicherte Zeilen. Wer je eine Rolle angepasst hat, behält sein Bündel vollständig — auch die Lücke darin.",
    },
    {
      claim: "Die Rollen-Matrix zeigt alle Berechtigungen.",
      why: "Die Plattform-Rechte haben leere Grant-Listen und laufen an der Rechteprüfung vorbei; durchgesetzt werden sie vom globalen Wächter.",
    },
    {
      claim: "Der Plattform-Betreiber lässt Leute in einen Bereich.",
      why: "Er sieht die Anfragen, entscheidet aber nicht. Das tut der Tenant-Admin.",
    },
    {
      claim: "Eine höhere Rolle enthält die niedrigere.",
      why: "Das Rollenmodell kennt keine Vererbung. Zwei Aufgaben heißt zwei Rollen.",
    },
    {
      claim: "Der Setup-Leitfaden ist meine persönliche Liste.",
      why: "Die Häkchen sind tenantweit geteilt — es ist der Stand des Programms, nicht der meine.",
    },
    {
      claim: "Ein abgeschaltetes Modul macht die Seite leer.",
      why: "Es macht sie **gesperrt**. Nicht registrierte Pfade sind fail-closed, nicht offen.",
    },
    {
      claim: "Custom Fields anlegen und ausfüllen ist dasselbe Recht.",
      why: "Definieren ist Admin-Sache, Füllen Sache der Ziel-Verantwortlichen.",
    },
    {
      claim: "Die Tour merkt sich, wo ich war.",
      why: "Sie merkt sich, **was ich gesehen habe**. Der Wiedereinstieg ist der erste offene Schritt.",
    },
    {
      claim: "Das Willkommensfenster kann man wegklicken.",
      why: "Bei einer neuen Rolle nicht. Die Tour lässt sich verschieben, die Kenntnisnahme nicht.",
    },
  ],

  who: [
    {
      step: "Mandant anlegen, Module setzen, sperren, stilllegen",
      who: "Plattform-Betreiber",
    },
    { step: "Tenant-Anfrage entscheiden", who: "Plattform-Betreiber" },
    {
      step: "Einladen, Rollen zuweisen und entziehen, DSGVO-Löschung",
      who: "Tenant-Admin",
      capability: "tenant.users.manage",
    },
    {
      step: "Einladungslink erzeugen, neu generieren, deaktivieren; Anfragen freigeben",
      who: "Tenant-Admin",
      capability: "tenant.users.manage",
    },
    {
      step: "Capabilities je Rolle setzen, entziehen, zurücksetzen",
      who: "Tenant-Admin",
      capability: "role.capability.manage",
    },
    {
      step: "Custom-Field-Definitionen",
      who: "Tenant-Admin",
      capability: "goal.custom_field.manage",
    },
    {
      step: "Integrationen verbinden und trennen",
      who: "Tenant-Admin",
      capability: "integration.manage",
    },
    { step: "Audit-Log lesen", who: "Tenant-Admin", capability: "admin.audit-log.read" },
    {
      step: "Setup-Meilensteine abhaken",
      who: "Tenant-Admin",
      capability: "tenant.users.manage",
    },
    {
      step: "Rolle annehmen, Tour sehen und neu starten",
      who: "**jede** Rolle, auch der Nur-Leser",
      capability: "role.onboarding.manage",
    },
  ],
};
