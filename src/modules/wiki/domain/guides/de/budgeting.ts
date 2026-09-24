import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Budget-Zeitraum“ — die versionierte Langfassung liegt unter
 * `docs/concepts/budgeting-walkthrough.md`.
 *
 * Sie beginnt dort, wo „Ein Halbjahr im Portfolio“ endet: beim Druck auf
 * „Runde starten“.
 */
export const BUDGETING: Guide = {
  slug: "ein-budget-zeitraum",
  title: "Ein Budget-Zeitraum",
  teaser: "Sieben Phasen, vier Status, Median.",
  standfirst:
    "Verteilen, schließen, finalisieren, festschreiben — der Weg einer Kachel vom Entwurf bis zum eingefrorenen Budget-Plan. Dreimal erzählt: aus Sicht des Portfolio Managers, des Gruppenmitglieds am Verteilblatt und der Finance, die die Zahlen setzt.",
  cadence: "je_halbjahr",
  module: "budgeting",
  seeAlso: ["ein-halbjahr-im-portfolio", "ein-art-epic-kommt-an-geld", "ein-epic-reift"],

  mechanics: [
    {
      kind: "paragraph",
      text: "Ein Budget-Zeitraum ist eine **Kachel**. Sie durchläuft sieben Phasen über vier Status: Entwurf → läuft → entschieden → abgeschlossen.",
    },
    { kind: "figure", figure: "periodPhases" },
    {
      kind: "paragraph",
      text: "**Die Phasen sind nirgends gespeichert.** Sie werden aus dem Zustand der Kachel abgeleitet und stehen als Leiste über den drei Reitern. Was gesperrt ist, sagt warum.",
    },
    {
      kind: "aside",
      text: "Mehrere Kacheln existieren nebeneinander — eine laufende, eine geplante, mehrere abgeschlossene. Es gibt **keinen mandantenweiten „aktiven Zyklus“**: aktiv ist die Kachel, die läuft.",
    },
    { kind: "quote", text: "Drei Übergänge tragen eine inhaltliche Aussage." },
    {
      kind: "list",
      items: [
        "**Runde starten** friert die Kandidatenliste ein und nimmt die aktiven Run-the-Business-Positionen dazu. Ab hier ist die Auswahl fix.",
        "**Verteilung schließen** beendet die Selbst-Verteilung der Gruppen.",
        "**Verteilung festschreiben** setzt je Kandidat den Endbetrag, schreibt die Budget-Zuteilung der finanzierten Epics fort, rechnet die Reserve und friert den Stand als Budget-Plan-Revision ein.",
      ],
    },
    {
      kind: "paragraph",
      text: "**Die Regeln, die man kennen sollte, um nicht überrascht zu werden:**",
    },
    {
      kind: "list",
      items: [
        "**Run the Business wird mitbudgetiert**, nicht vorweg abgezogen. Der Richtwert einer Position ist ihr Anteil an _dieser_ Kachel.",
        "**Das Verteil-Fenster** ist offen, solange die Runde läuft, die Gruppe noch nicht eingereicht hat und die Deadline nicht verstrichen ist. Fällt eines davon weg, ist Schluss — auch mitten in der Arbeit.",
        "**Der Median** der abgegebenen Gruppen ist die Vorbelegung der Endbeträge, **nicht das Ergebnis**. Finance setzt sie.",
        "**Die Reserve** ist der verteilbare Topf minus der Summe der Endbeträge. Sie lässt sich beim Anlegen der nächsten Kachel auf deren Topf addieren.",
        "**Zurücknehmen geht.** Eine abgeschlossene Kachel geht zurück auf „entschieden“; die Endbeträge bleiben als Vorbelegung stehen.",
      ],
    },
    {
      kind: "note",
      text: "**Eine Einschränkung, die man kennen muss.** Der Dienst hinter _Runde starten_ prüft nur, dass die Kachel im Entwurf ist. Dass eine Kandidatenliste und eine besetzte Gruppe vorliegen müssen, erzwingt **die Oberfläche** — über die Schnittstelle ließe sich eine Runde ohne Gruppen starten.",
    },
  ],

  perspectives: [
    {
      label: "Der Portfolio Manager",
      role: "portfolio_manager",
      question: "Wie bringe ich eine Runde zustande?",
      stations: [
        {
          title: "Die Gallery",
          route: "/budgeting/periods",
          body: [
            {
              kind: "paragraph",
              text: "Oben vier Zahlen zur laufenden Kachel — Zeitraum, Topf, Abgaben, letzter eingefrorener Stand —, darunter die Kacheln als Karten.",
            },
            {
              kind: "quote",
              text: "Jede zeigt ihre Phase, nicht nur ihren Status.",
            },
            {
              kind: "paragraph",
              text: "„Läuft“ sagt mir nicht, ob gerade verteilt oder schon finalisiert wird. Die Phase sagt es.",
            },
          ],
        },
        {
          title: "Rahmen und Kandidatenliste",
          body: [
            {
              kind: "paragraph",
              text: "**1 · Rahmen.** Topf und Deadline stehen schon aus dem Dialog; hier korrigiere ich sie, solange die Runde nicht läuft.",
            },
            {
              kind: "paragraph",
              text: "**2 · Kandidatenliste.** Ich wähle Epics aus dem budgeting-reifen Pool. Zu jedem zeigt Pulse den Richtwert, den es aus dem Business Case ableitet. Die Run-the-Business-Positionen stehen als eigener, eingeklappter Abschnitt darüber: **ich kann sie hier nicht ändern**, sie kommen beim Start automatisch dazu, und ihre Summe zählt trotzdem gegen den Topf.",
            },
            {
              kind: "quote",
              text: "In aller Regel liegt die Summe der Anfragen deutlich über dem Topf.",
            },
            {
              kind: "paragraph",
              text: "Das ist kein Fehler, **das ist der Grund für den ganzen Vorgang**.",
            },
          ],
        },
        {
          title: "Gruppen und Start",
          body: [
            {
              kind: "paragraph",
              text: "**3 · Beteiligte & Gruppen.** Der Wert des Verfahrens hängt an diesem Schnitt, deshalb prüft Pulse ihn und warnt: weniger als drei Gruppen — dann ist die Streuung nicht auswertbar —, Gruppen unter vier oder über sechs Personen, eine Gruppe ohne Sprecher, ungleich verteilte Einreicher. **Warnungen, keine Sperren.**",
            },
            {
              kind: "paragraph",
              text: "**4 · Runde starten.** Drücke ich ihn, friert die Kandidatenliste ein, die Run-Positionen kommen dazu, die Kachel geht auf _läuft_ — und die Gruppen bekommen ihren Hinweis.",
            },
            {
              kind: "paragraph",
              text: "Danach ist meine Arbeit **Beobachten**: wer abgegeben hat und wer nicht, und wie viel jede Gruppe verteilt hat. Wer lieber auf Papier arbeitet, bekommt die Verteilbögen.",
            },
          ],
        },
      ],
    },

    {
      label: "Das Gruppenmitglied",
      question: "Worüber soll ich entscheiden?",
      stations: [
        {
          title: "Der Hinweis",
          route: "/my-tasks",
          body: [
            {
              kind: "paragraph",
              text: "Meine Gruppe, der Zeitraum, die Deadline. **Der Hinweis verschwindet, sobald meine Gruppe eingereicht hat.** Ein Klick bringt mich auf das Arbeitsblatt.",
            },
          ],
        },
        {
          title: "Das Arbeitsblatt",
          body: [
            {
              kind: "paragraph",
              text: "Oben drei Zahlen: **Verteilbar · Verteilt · Rest**, darunter ein Balken. Der Rest wird rot, sobald ich zu viel verteilt habe.",
            },
            {
              kind: "paragraph",
              text: "Dann die Kandidaten — **nicht als lange Liste, sondern als Abschnitte**. _Run the Business_ steht vorn: der laufende Betrieb, den es weiter geben muss. Danach ein Abschnitt je Wertstrom, der größte zuerst, mit eigener Summe und einem Balken.",
            },
            {
              kind: "paragraph",
              text: "Zwei Spalten: **Anfrage** — was der Kandidat kostet — und **Mein Betrag**. **Nichts ist vorbelegt**: jede Zuteilung ist eine Entscheidung, nichts fließt aus Versehen.",
            },
            {
              kind: "aside",
              text: "Sortiert wird nach der Anfrage, nicht nach meiner Eingabe. Das ist Absicht: ich tippe, und nichts unter meinen Händen springt.",
            },
          ],
        },
        {
          title: "Speichern und einreichen",
          body: [
            {
              kind: "paragraph",
              text: "Übersteige ich den verteilbaren Topf, sagt Pulse es mir und lässt mich trotzdem **speichern** — einreichen aber nicht. **Speichern kann jedes Mitglied, einreichen nur der Sprecher.** Danach ist unser Vorschlag fest; das Fenster ist zu.",
            },
            {
              kind: "paragraph",
              text: "Genauso zu ist es, wenn die Deadline verstreicht, bevor wir eingereicht haben. Was wir bis dahin gespeichert haben, **zählt**: Finance sieht unsere Zahlen in der Übersicht — aber **der Median rechnet nur mit den Gruppen, die tatsächlich abgegeben haben**.",
            },
          ],
        },
      ],
    },

    {
      label: "Finance",
      question: "Wo geht das Geld hin?",
      stations: [
        {
          title: "Vor der Runde gehört mir der Betrieb",
          route: "/budgeting/run-the-business",
          body: [
            {
              kind: "paragraph",
              text: "Im Wertstrom pflege ich die **Run-the-Business-Positionen**: Name, Betrag und die Periode, für die der Betrag gilt. Jede Position kann ich einer Solution zurechnen; was wertstrom-übergreifend ist — Programm-Office, geteilte Lizenzen —, lasse ich ohne.",
            },
            {
              kind: "paragraph",
              text: "Die Kopfzeile nennt beide Summen: was das im Jahr kostet, und was davon in eine Budget-Kachel geht. **Aktive Positionen kommen beim Start jeder Runde automatisch auf die Kandidatenliste.**",
            },
          ],
        },
        {
          title: "Schließen und setzen",
          route: "/budgeting/board",
          body: [
            {
              kind: "paragraph",
              text: "Wenn alle abgegeben haben — oder die Deadline verstrichen ist — **schließe ich die Verteilung**. Die Kachel geht auf _entschieden_, die Gruppen können nichts mehr ändern.",
            },
            {
              kind: "paragraph",
              text: "Jetzt der Reiter _Ergebnis_: dieselben Abschnitte, aber andere Spalten — **Anfrage · Median · Final**. Der Median ist vorbelegt; **ich setze die Zahlen**.",
            },
            {
              kind: "paragraph",
              text: "Wird die Reserve negativ, komme ich nicht weiter: die Summe der finalen Beträge darf den verteilbaren Topf nicht überschreiten.",
            },
          ],
        },
        {
          title: "Festschreiben",
          body: [
            {
              kind: "paragraph",
              text: "**Verteilung festschreiben** schließt die Kachel. Damit passiert vieles auf einmal, und es lohnt zu wissen, was:",
            },
            {
              kind: "list",
              items: [
                "Jeder Kandidat bekommt seinen Endbetrag.",
                "Jedes finanzierte Epic bekommt seine **Budget-Zuteilung** für dieses Halbjahr.",
                "Die **Reserve** wird gerechnet und festgehalten.",
                "Der Stand wird als **Budget-Plan-Revision** eingefroren — ohne mein Zutun.",
              ],
            },
            {
              kind: "paragraph",
              text: "Darunter stehen die abgeleiteten Budgets: je Wertstrom, aufgeteilt in Run the Business und die Epics nach ART. **Diese Zahlen pflegt niemand** — sie sind die Verteilung, anders gruppiert.",
            },
            {
              kind: "aside",
              text: "Habe ich mich vertan, nehme ich die Finalisierung zurück: die Beträge bleiben als Vorbelegung stehen, und der eingefrorene Stand bleibt als **Beleg dessen, was damals galt**. Die nächste Finalisierung überschreibt ihn.",
            },
          ],
        },
        {
          title: "Die Naht zum Epic",
          body: [
            {
              kind: "paragraph",
              text: "Der Reifegrad-Schritt **L2 → L3** hat genau eine blockierende Bedingung: Budget ist alloziert. **Diese Summe entsteht auf zwei Wegen**, und welcher gilt, hängt allein an den Kosten gegen das Portfolio-Limit des Wertstroms.",
            },
            {
              kind: "table",
              head: ["", "Portfolio-Epic", "ART-Epic"],
              rows: [
                ["Kosten", "**über** dem Limit", "**unter** dem Limit"],
                [
                  "Wer entscheidet",
                  "das Portfolio, in einer Kachel",
                  "der Wertstrom, über den ART-Rahmen",
                ],
                ["Auf der Kandidatenliste", "ja", "**nein** — ausdrücklich ausgeschlossen"],
              ],
            },
            {
              kind: "paragraph",
              text: "Beide schreiben am Ende in **dieselbe** Zuteilung. Für das Epic ändert sich die Bedingung also nicht. **Nur der Weg dorthin ist zweigeteilt** — und mit ihm die Frage, wen man fragen muss.",
            },
            {
              kind: "note",
              text: "Wird ein Portfolio-Epic in der Runde nicht finanziert, bleibt es auf L2 stehen — **nicht abgelehnt, sondern unbezahlt**, und beim nächsten Zeitraum wieder dabei. Ein ART-Epic ohne Rahmen an seinem ART hat dagegen **keinen** Weg. Pulse weist das an der Epic-Seite aus, statt es zu verschweigen.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Der Median ist das Ergebnis der Runde.",
      why: "Er ist die **Vorbelegung** der Endbeträge. Gesetzt werden sie von Finance.",
    },
    {
      claim: "Wer nicht eingereicht hat, zählt gar nicht.",
      why: "Die gespeicherten Zahlen bleiben sichtbar. Nur der **Median** rechnet ausschließlich mit abgegebenen Gruppen.",
    },
    {
      claim: "Run the Business wird vorweg vom Topf abgezogen.",
      why: "Es wird **mitbudgetiert** — die Positionen stehen als Kandidaten auf derselben Liste.",
    },
    {
      claim: "Die Phasen einer Kachel sind gespeichert.",
      why: "Sie werden aus ihrem Zustand abgeleitet. Deshalb kann keine Phase mit der Wirklichkeit auseinanderlaufen.",
    },
    {
      claim: "Es gibt einen aktiven Zyklus im Mandanten.",
      why: "Aktiv ist die Kachel, die läuft. Mehrere existieren nebeneinander.",
    },
    {
      claim: "Eine abgeschlossene Kachel ist endgültig.",
      why: "Die Finalisierung lässt sich zurücknehmen; die Beträge bleiben als Vorbelegung stehen.",
    },
    {
      claim: "Der Start einer Runde ist gegen leere Gruppen abgesichert.",
      why: "Das erzwingt nur die Oberfläche. Der Dienst prüft allein, dass die Kachel im Entwurf ist.",
    },
    {
      claim: "Mein Betrag ist mit der Anfrage vorbelegt.",
      why: "Nichts ist vorbelegt. Jede Zuteilung ist eine Entscheidung — nichts fließt aus Versehen.",
    },
  ],

  who: [
    {
      step: "Kachel anlegen, Rahmen, Kandidatenliste, Gruppen, Starten",
      who: "Portfolio Manager / Admin",
      capability: "budget.round.manage",
    },
    {
      step: "Run-the-Business-Positionen pflegen",
      who: "Wertstrom-Owner, Finance-Partei des Wertstroms, Portfolio Manager / Admin",
      capability: "rtb_item.manage",
    },
    { step: "Beträge einer Gruppe setzen", who: "jedes Mitglied der Gruppe" },
    { step: "Verteilung einreichen", who: "Sprecher oder markierter Einreicher" },
    {
      step: "Verteilung schließen, festschreiben, zurücknehmen",
      who: "Finance / Portfolio Manager / Admin",
      capability: "budget.manage",
    },
    {
      step: "Budget-Plan erfassen",
      who: "dieselben — beim Festschreiben ohnehin automatisch",
      capability: "budget_plan.revision.capture",
    },
    {
      step: "Die Geld-Reiter eines Knotens überhaupt sehen",
      who: "Admin, Portfolio Manager, Wertstrom-Owner; RTE auf **seinem** ART; Finance-Partei",
      capability: "budget.read",
    },
  ],
};
