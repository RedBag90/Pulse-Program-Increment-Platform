import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Halbjahr im Portfolio“ — die versionierte Langfassung liegt unter
 * `docs/concepts/portfolio-cycle-walkthrough.md`.
 *
 * Die Anleitung endet beim Druck auf „Runde starten“; alles danach steht in
 * „Ein Budget-Zeitraum“.
 */
export const PORTFOLIO_CYCLE: Guide = {
  slug: "ein-halbjahr-im-portfolio",
  title: "Ein Halbjahr im Portfolio",
  teaser: "Runde organisieren, Bedarf melden, Status pflegen.",
  standfirst:
    "Wie eine Budget-Runde zustande kommt, die etwas taugt — und was in den Wochen davor passiert, die im Werkzeug nicht stattfinden. Die Kachel ist in zwei Minuten angelegt; die Vorbereitung dauert Wochen.",
  cadence: "je_halbjahr",
  module: "budgeting",
  seeAlso: ["ein-portfolio-entsteht", "eine-idee-wird-ein-vorhaben"],

  mechanics: [
    { kind: "quote", text: "Die Regel, die Kanban und Budget zusammenhält." },
    {
      kind: "paragraph",
      text: "Das Kanban managt die Epics; bei der Vergabe haben **laufende Epics Vorrang**. Daraus folgen zwei Richtungen, und beide sind eine Aussage über den laufenden Zyklus.",
    },
    { kind: "figure", figure: "allocationRule" },
    {
      kind: "list",
      items: [
        "**Wer Geld trägt, steht mindestens auf L3.1.** Vorher gibt es nichts zu finanzieren: im Funnel ist es eine Idee, in der Hypothese eine Vermutung, in der Analyse-Einplanung eine Absicht, im Business Case eine Rechnung, die noch niemand freigegeben hat.",
        "**Wer in Umsetzung ist, hat Geld.** Ein Epic auf L4.1, das im laufenden Zyklus nichts bekommen hat, ist eine Lücke — entweder in der Vergabe oder in den Daten.",
      ],
    },
    {
      kind: "note",
      text: "**Wo die Regel greift — und wo nicht.** Die erste Richtung ist **durchgesetzt**: auf die Kandidatenliste kommt nur, was einen freigegebenen Business Case hat, und der Dienst weist alles andere ab. Die zweite Richtung — „wer umsetzt, hat Geld“ — wird **nur beim Erzeugen von Testdaten geprüft**. In der laufenden Anwendung gibt es keinen Wächter dafür; sie zu halten ist Sache des Portfolio Managers.",
    },
    { kind: "quote", text: "Welche Kachel heute gilt." },
    {
      kind: "paragraph",
      text: "Der Status einer Runde beschreibt ihre **Vorbereitung**, nicht ihre Geltung. Die Geltung wird **abgeleitet**:",
    },
    {
      kind: "table",
      head: ["Geltung", "Wann"],
      rows: [
        ["**In Ausarbeitung**", "nicht abgeschlossen, oder der Zeitraum hat noch nicht begonnen"],
        ["**Angewandtes Budget**", "abgeschlossen **und** der heutige Tag liegt im Zeitraum"],
        ["**Abgelaufener Budget-Zeitraum**", "abgeschlossen, Zeitraum vorbei"],
      ],
    },
    {
      kind: "paragraph",
      text: "Fällt der heutige Tag in **keine** Kachel, gilt die zuletzt abgelaufene weiter — zwischen zwei Kacheln klaffen gemessen 3–10 Tage, und ohne diese Regel verschwänden mehrmals im Jahr für ein paar Tage sämtliche Zahlen.",
    },
    {
      kind: "aside",
      text: "Eine Kachel deckt ein **Halbjahr** ab. Ihr Zyklus-Schlüssel ist **kein Eingabefeld** — er wird aus dem Startdatum abgeleitet, und **zwei Kacheln dürfen nicht im selben Halbjahr beginnen**.",
    },
  ],

  perspectives: [
    {
      label: "Der Portfolio Manager",
      role: "portfolio_manager",
      question: "Wie bringe ich eine Runde zustande, die etwas taugt?",
      stations: [
        {
          title: "Die Kachel aufsetzen",
          route: "/budgeting/periods",
          body: [
            {
              kind: "paragraph",
              text: "Ich bin dafür verantwortlich, dass der Budget-Prozess sauber durchgeführt wird. Über **Neue Kachel** lege ich den Zeitraum an.",
            },
            {
              kind: "table",
              head: ["Feld", "Anmerkung"],
              rows: [
                [
                  "**Geltungszeitraum des Budgets**",
                  "„Von wann bis wann dieses Budget gilt — nicht die Dauer der Vorbereitung.“",
                ],
                ["**Topf (€)**", "—"],
                ["**Abgabe-Deadline**", "optional; Vorgabe ist das Ende des Zeitraums"],
                ["☑ **Reserve übernehmen**", "die Reserve der letzten abgeschlossenen Kachel"],
                [
                  "☑ **Vom vorherigen Zeitraum übernehmen**",
                  "Beteiligte, Gruppen samt Sprechern und die Kandidatenliste",
                ],
              ],
            },
            {
              kind: "paragraph",
              text: "Beide Übernahmen sind vorausgewählt — **wer zum zweiten Mal budgetiert, ist damit fast fertig**; der Rest des Setups ist Korrektur, nicht Aufbau.",
            },
            {
              kind: "note",
              text: "**Es gibt nur eine Deadline, und sie meint etwas anderes als erwartet.** Die Abgabe-Deadline ist die Frist, bis zu der die **Gruppen ihre Verteilung einreichen** — nicht die Frist für Bedarfsmeldungen aus den Wertströmen. Ein Feld für Letztere gibt es nicht; diese Frist muss außerhalb von Pulse gesetzt und nachgehalten werden.",
            },
          ],
        },
        {
          title: "Dann beginnt die eigentliche Arbeit",
          body: [
            {
              kind: "paragraph",
              text: "Die Kachel ist in zwei Minuten angelegt. Was Wochen dauert, steht daneben:",
            },
            {
              kind: "list",
              items: [
                "**Epics müssen vorbereitet werden.** Wer bis zur Frist nicht durch L3.1 ist, ist in dieser Runde nicht dabei.",
                "**Wertströme, ARTs und Solutions müssen ihren Bedarf definieren und einreichen.**",
                "**Bis zur Frist kommen Kollegen mit Rückfragen.** Das ist kein Störfall, sondern der Grund, warum die Frist vor dem Termin liegt.",
              ],
            },
          ],
        },
        {
          title: "Die Kandidatenliste kuratieren",
          route: "/budgeting/periods",
          body: [
            {
              kind: "paragraph",
              text: "Im Reiter **Setup**, Schritt 2: was zur Abstimmung steht — vorgemerkte Epics plus die aktiven Run-the-Business-Positionen, die beim Start dazukommen.",
            },
            {
              kind: "paragraph",
              text: "Angeboten wird mir nur, was **beides** erfüllt: den Merker _Fürs nächste Budget-Meeting vormerken_ **und** einen freigegebenen Business Case.",
            },
            {
              kind: "quote",
              text: "Der Merker ist die Anmeldung durch den Epic Owner, die Aufnahme meine Entscheidung.",
            },
            {
              kind: "paragraph",
              text: "Zwei Dinge stehen dort, die ich **nicht** ändern kann:",
            },
            {
              kind: "list",
              items: [
                "Die **Run-the-Business-Positionen** kommen beim Start automatisch dazu. Ihre Summe zählt trotzdem schon gegen den Topf — sonst täuschte mich die Zahl unten.",
                "**ART-Epics stehen gar nicht erst zur Wahl.** Liegen die Kosten unter dem Portfolio-Limit, bedient der ART das Epic aus seinem Rahmen. Die Fläche sagt an, wie viele das sind.",
              ],
            },
          ],
        },
        {
          title: "Die Gruppen bilden",
          body: [
            {
              kind: "paragraph",
              text: "Schritt 3: ich trage die Personen ein und schneide sie in Gruppen. Jeder Gruppe weise ich eine Person zu, die für das Einreichen verantwortlich ist.",
            },
            {
              kind: "aside",
              text: "Diese Person heißt in Pulse **Sprecher**, nicht „Gruppenleiter“. Nur sie — oder ein ausdrücklich als Einreicher markiertes Mitglied — kann die Verteilung abgeben; **speichern** darf jedes Mitglied.",
            },
            {
              kind: "paragraph",
              text: "Pulse prüft den Schnitt und warnt: weniger als drei Gruppen, Gruppen unter vier oder über sechs Personen, eine Gruppe ohne Sprecher. **Warnungen, keine Sperren.**",
            },
          ],
        },
        {
          title: "Den Termin vorbereiten und starten",
          body: [
            {
              kind: "paragraph",
              text: "Das Meiste daran steht nicht im Werkzeug. Zwei Dinge aber gehören dazu: **die Epic Owner müssen wissen, dass sie ihr Epic pitchen** — Pulse hat dafür keine Fläche, es ist eine Absprache. Und für Gruppen, die auf Papier arbeiten, gibt es die **Verteilbögen**, einen je Gruppe.",
            },
            {
              kind: "paragraph",
              text: "Am Tag des Termins drücke ich **Runde starten**. Das friert die Kandidatenliste ein, nimmt die aktiven Run-the-Business-Positionen dazu und schaltet die Gruppen-Verteilung frei.",
            },
            {
              kind: "aside",
              text: "Der Knopf sagt an, wenn er noch nicht darf — die Kandidatenliste ist leer, oder keine Gruppe hat ein Mitglied.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Wertstrom-Owner",
      role: "value_stream_owner",
      question: "Was braucht mein Wertstrom, und wo trage ich es ein?",
      stations: [
        {
          title: "Den Bedarf einsammeln",
          body: [
            {
              kind: "paragraph",
              text: "Der Portfolio Manager hat gesagt, dass das Budgeting vorbereitet werden muss. Das ist mein Stichwort. Ich gehe auf meine Solutions zu und frage zwei Dinge ab:",
            },
            {
              kind: "list",
              ordered: true,
              items: [
                "**Was braucht es, um die Solution am Laufen zu halten?**",
                "**Was ist für ihre Weiterentwicklung eingeplant?**",
              ],
            },
            {
              kind: "paragraph",
              text: "Beides dokumentiere ich selbst — die Solutions liefern die Zahlen, eingetragen wird es an **einer** Stelle.",
            },
          ],
        },
        {
          title: "Wo es eingetragen wird",
          route: "/budgeting/value-streams",
          body: [
            {
              kind: "paragraph",
              text: "An meinem Wertstrom liegen zwei Reiter, und man erwischt leicht den falschen: **Budget** ist **lesend** — der Plan, der Verlauf, die ART-Sicht. **Run the Business** ist die Fläche, auf der gepflegt wird, was beantragt werden soll.",
            },
            {
              kind: "paragraph",
              text: "Je Zeile: Position · Periode · Betrag · p. a. Die Periode ist monatlich, halbjährlich oder jährlich; Pulse rechnet daraus beides aus — was es im Jahr kostet und was davon in eine Kachel geht.",
            },
          ],
        },
        {
          title: "Die Unterteilung ist der Punkt",
          body: [
            {
              kind: "table",
              head: ["Art", "Was hineingehört"],
              rows: [
                ["**Betrieb**", "Lizenzen, Wartung — alles, was den Bestand hält"],
                [
                  "**ART-Epic-Budget**",
                  "der Rahmen für die Weiterentwicklung, den der ART später verteilt",
                ],
              ],
            },
            {
              kind: "paragraph",
              text: "Sie zu vermischen wäre kein Formfehler: **dann würde Veränderungsarbeit aus dem Betriebstopf bezahlt**, und vier Flächen sagten die Unwahrheit — die Grow-/Run-Kacheln der Solution, der Run-Anteil am Wertstrom, die Gliederung der Kandidatenliste und die Capacity-Guardrail.",
            },
            {
              kind: "quote",
              text: "Der Wertstrom entscheidet in der Kachel, wie groß der Rahmen ist, der ART danach, wofür.",
            },
          ],
        },
        {
          title: "Die Portfolio-Epics auf den Weg bringen",
          body: [
            {
              kind: "paragraph",
              text: "Was mir jetzt noch fehlt: die Epics meines Wertstroms, die in dieser Runde Geld brauchen. **Sie kommen nicht von selbst auf die Liste.** Ich stelle sicher, dass die reifen Epics den Merker gesetzt haben — ohne ihn erscheinen sie in der Kandidatenliste gar nicht.",
            },
            {
              kind: "note",
              text: "**Ohne abgeschlossene Kachel ist der Rahmen null.** Was ich hier eintrage, ist die **Anfrage**, nicht das Geld. Der Veränderungsrahmen eines ARTs trägt erst dann etwas, wenn eine Kachel für dieses Halbjahr geschlossen und festgeschrieben ist.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Produkt-Manager",
      question: "Steht mein Produkt noch da, wo es im System steht?",
      stations: [
        {
          title: "Der Portfolio Review",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "Ich bin regelmäßig im Portfolio Review. Dort wird über die Solutions gesprochen — und dazu gehört die Frage, ob sich die **Einordnung** verschoben hat. Hat sie sich bewegt, setze ich das über die Lebenszyklus-Leiste nach.",
            },
            {
              kind: "paragraph",
              text: "**Warum das im Takt zählt und nicht nebenbei:** die Guardrail _Investment by Horizon_ misst die Horizonte der **Epics** — und die erben ihn von ihrer Solution, solange sie keinen eigenen tragen. Wird der Horizont einer Solution nicht gepflegt, misst die Guardrail eine Verteilung, die es nicht mehr gibt, und die nächste Budget-Runde entscheidet gegen ein falsches Bild.",
            },
            {
              kind: "aside",
              text: "Wandert eine Solution, wandern **nicht** ihre bereits freigegebenen Epics mit: deren Horizont ist mit der Business-Case-Freigabe eingefroren. Sonst schriebe ein einziger Solution-Wechsel die gemessene Balance der Vergangenheit um.",
            },
          ],
        },
        {
          title: "Die Run-Baseline aktuell halten",
          body: [
            {
              kind: "paragraph",
              text: "Vor jeder Runde melde ich meinem Wertstrom-Owner, was der Betrieb im kommenden Halbjahr kostet, und was ich für die Weiterentwicklung einplane.",
            },
            {
              kind: "paragraph",
              text: "In den Kacheln meiner Solution sehe ich beides gegeneinander: **Grow** aus den aktiven Primär-Epics, **Run** als Betrieb pro Jahr — und das Verhältnis der beiden.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Die Deadline ist die Frist für die Bedarfsmeldungen.",
      why: "Die Abgabe-Deadline ist die Frist für die Gruppen-Verteilung. Für Bedarfe gibt es kein Feld.",
    },
    {
      claim: "Ein Epic im Business Case kann Budget bekommen.",
      why: "Budget gibt es erst ab **L3.1** — mit freigegebenem Business Case.",
    },
    {
      claim: "Pulse warnt, wenn ein laufendes Epic kein Geld hat.",
      why: "Diese Richtung wird nur beim Erzeugen von Testdaten geprüft, nicht in der laufenden Anwendung.",
    },
    {
      claim: "Der Gruppenleiter reicht ein.",
      why: "Er heißt **Sprecher**. Speichern darf jedes Mitglied, einreichen nur er.",
    },
    {
      claim: "Den Zyklus-Schlüssel gebe ich ein.",
      why: "Er wird aus dem Startdatum abgeleitet. Zwei Kacheln dürfen nicht im selben Halbjahr beginnen.",
    },
    {
      claim: "Die laufende Kachel ist die mit Status „läuft“.",
      why: "Geltung ist abgeleitet: **abgeschlossen** und der heutige Tag im Zeitraum.",
    },
    {
      claim: "Betriebskosten und Weiterentwicklung trage ich zusammen ein.",
      why: "Zwei Arten: **Betrieb** und **ART-Epic-Budget**. Vermischt zahlt der Betrieb die Veränderung.",
    },
    {
      claim: "Der Rahmen im Run-the-Business-Reiter ist das Geld des ARTs.",
      why: "Er ist die **Anfrage**. Ohne abgeschlossene Kachel für das Halbjahr ist der Topf null.",
    },
    {
      claim: "ART-Epics stehen auch auf der Kandidatenliste.",
      why: "Sie werden ausdrücklich ausgenommen — der ART finanziert sie aus seinem Rahmen.",
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
      who: "Wertstrom-Owner, Finance-Partei, Portfolio Manager / Admin",
      capability: "rtb_item.manage",
    },
    {
      step: "Den Budget-Merker am Epic setzen",
      who: "wer das Epic bearbeiten darf",
      capability: "epic.update",
    },
    { step: "Beträge einer Gruppe setzen", who: "jedes Mitglied der Gruppe" },
    {
      step: "Die Verteilung einer Gruppe einreichen",
      who: "**nur** der Sprecher oder ein markierter Einreicher",
    },
    {
      step: "Den Horizont einer Solution nachziehen",
      who: "Produkt-Manager, Portfolio Manager",
      capability: "solution.manage",
    },
  ],
};
