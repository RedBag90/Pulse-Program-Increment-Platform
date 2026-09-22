import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Die Wirkung“ — die versionierte Langfassung liegt unter
 * `docs/concepts/benefit-walkthrough.md`.
 *
 * Die Anleitung, die am staerksten von der Trennung zweier Achsen lebt: **wer
 * verantwortet, was geliefert wurde, und wer, was es wert war.** Alles andere
 * hier folgt daraus.
 */
export const BENEFIT: Guide = {
  slug: "die-wirkung",
  title: "Die Wirkung",
  teaser: "KPI messen, bewerten, ins Ziel rollen.",
  standfirst:
    "Wie aus einem gemessenen Wert am Epic ein Beitrag zum Kopfziel wird — und wem welche Hälfte dieser Rechnung gehört. Dreimal erzählt: aus Sicht des Epic Owners, der misst, der Finance, die bewertet, und des Ziel-Owners, der es zusammenführt.",
  cadence: "je_idee",
  module: "work",
  seeAlso: ["ein-epic-reift", "ein-portfolio-entsteht"],

  mechanics: [
    { kind: "quote", text: "Zwei Achsen, und sie gehören verschiedenen Leuten." },
    {
      kind: "table",
      head: ["Achse", "Was sie sagt", "Wem sie gehört", "Wann sie feststeht"],
      rows: [
        [
          "**Menge**",
          "wie weit die KPI ihr Ziel erreicht hat",
          "dem Epic Owner",
          "friert mit **L4.2**",
        ],
        [
          "**Wert**",
          "mit welchem Faktor eine Einheit in Geld wird",
          "der Finance",
          "korrigierbar bis **L5**",
        ],
      ],
    },
    {
      kind: "paragraph",
      text: "Die Trennung ist der ganze Punkt. **Menge** friert mit der Abnahme „die Umsetzung ist fertig“: was gebaut ist, ist gebaut, und ein projizierter Rest wäre eine Behauptung ohne Grundlage. **Wert** bleibt offen, weil sich erst nach der Umsetzung zeigt, ob eine Einheit wirklich so viel wert war — und eine Korrektur wirkt **rückwirkend** auf die ganze Ist-Rechnung.",
    },
    {
      kind: "note",
      text: "**Ohne obere Deckelung.** Unter 100 % verfällt der Rest, über 100 % zählt er voll. Wer mehr liefert als versprochen, bekommt es angerechnet.",
    },
    { kind: "quote", text: "Der Plan entsteht mit der Business-Case-Freigabe." },
    {
      kind: "paragraph",
      text: "Vor **L2** gibt es keinen Plan-Bezug: jede Änderung am Faktor ist zugleich der Plan. Mit der Freigabe wird er festgehalten, und ab da ist „Plan gegen Ist“ eine Aussage statt einer Tautologie. Die Fläche sagt das an, solange es fehlt.",
    },
    { kind: "quote", text: "Die Richtung steckt im Vorzeichen." },
    {
      kind: "paragraph",
      text: "Es gibt **kein Richtungs-Feld**. Ob eine KPI steigen oder fallen soll, ergibt sich aus dem Vorzeichen von `Ziel − Baseline`: Durchlaufzeit 10 → 6 und NPS 40 → 80 funktionieren beide, weil der Nenner das Vorzeichen trägt. Wer eine KPI anlegt, trägt „heute“ und „das Ziel“ ein — mehr braucht es nicht.",
    },
    {
      kind: "note",
      text: "**Ein Befund, der hierher gehört.** Check-in **und** Kommentar hängen beide am selben Recht wie das Pflegen der Ziele. Ein Epic Owner, RTE oder Feature Owner kann auf einem Ziel also weder einchecken noch kommentieren — **auch nicht auf einem Ziel, zu dem sein eigenes Epic beiträgt.** Ob das so gewollt ist, steht nirgends; im Code gibt es dazu keinen Kommentar.",
    },
  ],

  perspectives: [
    {
      label: "Der Epic Owner",
      role: "epic_owner",
      question: "Woran misst man, ob mein Vorhaben etwas bewirkt hat?",
      stations: [
        {
          title: "Die KPI",
          anchor: "entity-tab-rail",
          body: [
            {
              kind: "paragraph",
              text: "Im Reiter **KPIs** meines Epics lege ich an, woran der Erfolg hängt: ein Name, eine **Baseline** („heute“), ein **Ziel**, eine Einheit. Ein Gewicht kann ich setzen — leer heißt „auto“, dann teilen sich die KPIs gleichmäßig auf.",
            },
            {
              kind: "paragraph",
              text: "Die Karte zeigt danach den Ist-Wert groß, darunter `Baseline … → Ziel …` und den Anteil am Gesamtnutzen.",
            },
            {
              kind: "aside",
              text: "**Das alles hängt am Bearbeiten-Recht des Epics, nicht am Binde-Recht.** Die KPI zu führen ist Autorenarbeit am eigenen Epic.",
            },
          ],
        },
        {
          title: "Die Verknüpfung zum Ziel",
          body: [
            {
              kind: "paragraph",
              text: "Erst die Verbindung macht aus der KPI einen Beitrag. Sie trägt **zwei verschiedene Handlungen in einer Aktion**, und Pulse unterscheidet sie seit September 2026:",
            },
            {
              kind: "table",
              head: ["Handlung", "Was sie bedeutet"],
              rows: [
                [
                  "**Blankes Anhängen**",
                  "„dieses Vorhaben zahlt auf jenes Ziel ein“ — Teil des Vorschlags, den der VMO bei L0 → L1 bestätigt",
                ],
                [
                  "**Bezifferten Beitrag binden**",
                  "eine KPI, ein Umrechnungsfaktor, eine Wirkungsart — diese Zahl rollt in den Ziel-Baum und ist eine **Zusage**",
                ],
              ],
            },
            {
              kind: "note",
              text: "**Warum die Trennung nötig war.** Vorher verlangten beide dasselbe Recht, und das hat nur der Portfolio Manager. Ein Epic Owner konnte sein Epic anlegen, aber nicht sagen, worauf es einzahlt: die Fläche bot ihm das Feld an, und die Aktion antwortete mit einer Rechteverletzung — **nachdem das Epic bereits stand.**",
            },
          ],
        },
        {
          title: "Messen",
          body: [
            {
              kind: "paragraph",
              text: "**Messwert erfassen** — ein Wert, ein Datum. Die Messreihe hängt als chronologische Liste an der KPI, und die Karte zeichnet daraus eine Mini-Trendlinie mit markiertem letztem Punkt.",
            },
            {
              kind: "paragraph",
              text: "Was danach in der Zeile steht, ist die Zerlegung aus der gemeinsamen Mechanik:",
            },
            {
              kind: "code",
              text: `Plan (bei Freigabe)     120.000 € /Jahr
Ist  (festgeschrieben)  138.000 € /Jahr · 115 %
Menge (Zielerreichung)  +18.000 € /Jahr
Wert  (Umrechnungsfaktor)        0 € /Jahr`,
            },
            {
              kind: "paragraph",
              text: "„(festgeschrieben)“ erscheint, sobald L4.2 abgenommen ist. Solange nichts gemessen ist, steht dort **„noch nicht gemessen“**. Das ist eine Auskunft, keine Null.",
            },
          ],
        },
      ],
    },

    {
      label: "Finance",
      question: "Was ist eine Einheit wert, und wann glaube ich es?",
      stations: [
        {
          title: "Der Wert je Einheit",
          body: [
            {
              kind: "paragraph",
              text: "Ich hinterlege am Ziel-Link einen **Wert je Einheit** in der natürlichen Einheit der KPI — Euro je eingespartem Tag, Euro je gewonnenem NPS-Punkt. Daraus rechnet Pulse beides: den Euro-Wert der aktuellen Bewegung und, fürs Anzeigen, den äquivalenten „Euro je Prozentpunkt der Ziel-Lücke“. Mathematisch dieselbe Zahl, zwei Lesarten.",
            },
            {
              kind: "paragraph",
              text: "Dazu die **Nutzenart** — und bei wiederkehrendem Nutzen ein Intervall, monatlich oder jährlich.",
            },
            { kind: "figure", figure: "benefitKinds" },
            {
              kind: "aside",
              text: "Die Vorgabe bewahrt das Altverhalten: wer nichts angibt, bekommt genau das, was Bestands-KPIs schon immer gerechnet haben.",
            },
          ],
        },
        {
          title: "Die Abnahme des Impacts",
          body: [
            {
              kind: "paragraph",
              text: "Der letzte Reifegrad-Schritt ist meiner allein. Bis dahin darf ich den Faktor korrigieren — und die Korrektur wirkt **rückwirkend** auf die ganze Ist-Rechnung. Die **Menge** kann ich nicht mehr bewegen; die steht seit L4.2.",
            },
            {
              kind: "quote",
              text: "Der Epic Owner verantwortet, was geliefert wurde; ich verantworte, was es wert war.",
            },
          ],
        },
        {
          title: "Das Dashboard",
          route: "/portfolio/dashboard",
          body: [
            {
              kind: "paragraph",
              text: "Sieben Tafeln auf einer gemeinsamen Monatsachse — Benefit Velocity, Cost Distribution, ROI, Break Even, Gained Value, Cost Analysis und der Cash-Flow-Saldo.",
            },
            {
              kind: "paragraph",
              text: "**Drei Rechenregeln muss man kennen, um die Kurven zu lesen:**",
            },
            {
              kind: "list",
              items: [
                "Die **geschätzten Kosten** fallen tageweise gewichtet im Umsetzungsfenster **L4.1 → L4.2** an. Eine Zuteilung übersteuert sie.",
                "**Go-live** = Kostenstart + (Anzahl Kostenscheiben × 6 Monate). Dort landet der einmalige Nutzen.",
                "Der **wiederkehrende Nutzen** läuft ab Go-live bis zum Horizont-Ende, ein Zwölftel des Jahreswerts je Monat.",
              ],
            },
          ],
        },
        {
          title: "Der Benefit-Wasserfall",
          body: [
            {
              kind: "paragraph",
              text: "Die zweite Sicht auf dasselbe Geld, aber gegen den **Zielwert** eines Ziels: wie viel Value steckt heute in jeder Spalte — und wie viel fehlt bis zum aufgestellten Zielwert? Bewertet wird **reifegradabhängig**, in drei Bändern:",
            },
            {
              kind: "table",
              head: ["Band", "Welche Epics", "Womit sie zählen"],
              rows: [
                ["_Schätzung_", "frühe", "mit ihrem geschätzten Zielbeitrag"],
                [
                  "_Erreicht + Lücke_",
                  "in laufender Umsetzung",
                  "mit dem gemessenen Anteil, plus gestricheltem Rest",
                ],
                ["_Ist_", "fertige", "mit dem tatsächlichen Wert"],
              ],
            },
            {
              kind: "paragraph",
              text: "Die **Dimension** ist frei wählbar — Reifegrad, Wertstrom, ART, Epic. Sie bestimmt nur, in welcher Spalte ein Epic landet; die Ist-/Forecast-Semantik bleibt dieselbe. Alle Beträge stehen bereits **in der Einheit des Ziels**.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Ziel-Owner",
      question: "Wo stehen wir, und was sage ich den anderen?",
      stations: [
        {
          title: "Der Check-in",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "Ein Check-in ist **eine** Handlung, die mehreres auf einmal festhält: Status (On track · At risk · Off track — oder ein Abschluss), Fortschritt, bei manuellen Key Results den Ist-Wert, eine Notiz, strukturierte Sektionen und ein **Datum**.",
            },
            {
              kind: "paragraph",
              text: "Daneben gibt es die **schmale Variante**: nur Zahl und Datum, ohne Statusaussage. Sie erzeugt einen neutralen Punkt im Graphen. Und den **Kommentar**. Alle drei laufen in denselben Aktivitäts-Feed.",
            },
            {
              kind: "note",
              text: "Dass ich das Datum wählen kann, ist wichtiger, als es klingt: ein Check-in, der eine Woche zu spät geschrieben wird, gehört trotzdem an die Stelle, an der er gemeint war. **Sonst verzerrt sich jede Verlaufskurve nach rechts.**",
            },
          ],
        },
        {
          title: "Woher der Fortschritt kommt",
          body: [
            {
              kind: "paragraph",
              text: "Das ist beim Anlegen entschieden worden. Hier zählt, was die drei Quellen im Betrieb bedeuten:",
            },
            {
              kind: "list",
              items: [
                "**Manuell** — ich pflege den Wert. Der Check-in ist die Pflege.",
                "**Aus Unterzielen** — gewichteter Durchschnitt der Kinder. Meine eigene Metrik wird ignoriert; mein Check-in trägt dann nur Status und Notiz.",
                "**KPI-Baum** — als Blatt zieht das Ziel seinen Ist aus den verknüpften Epic-KPIs; als Ast kaskadiert es die Werte seiner Unterziele hoch.",
                "**Confidence Vote** — die Faust-zu-Fünf. Statt einer Metrik trage ich eine Stufe von 1 bis 5 ein; unter 3 wird nachgeplant. Für Ziele, die sich nicht in einer Zahl messen lassen — dort stand vorher ein ausgedachter Prozentwert.",
              ],
            },
            {
              kind: "paragraph",
              text: "Ein Unterziel kann ich vom automatischen Rollup **ausnehmen** — es bleibt sichtbar, zählt aber nicht in den Durchschnitt.",
            },
          ],
        },
        {
          title: "Die Kaskade",
          body: [
            {
              kind: "paragraph",
              text: "Der Umrechnungsfaktor zwischen Unterziel und Kopfziel ist die **Einheiten-Brücke**: „1 Transaktion/s = 8.000 €“. Er ist **nicht** derselbe wie der Faktor am Ziel-Link zum Epic — die Verwechslung ist eingebaut.",
            },
            {
              kind: "code",
              text: `Messwert am Epic-KPI
   × Umrechnungsfaktor (am Ziel-Link)  → Beitrag in Ziel-Einheiten
   × Faktor Unterziel → Kopfziel       → Beitrag in Eltern-Einheiten
   × Gewicht im Rollup                 → Anteil am Fortschritt des Elternziels`,
            },
            {
              kind: "paragraph",
              text: "**Verknüpfte Features und PIs am Ziel sind ausdrücklich kein Wertbeitrag**, sondern nur ein Deeplink. Wer dort etwas verknüpft, bewegt keine Zahl.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Über 100 % Zielerreichung wird gekappt.",
      why: "Es gibt keine obere Deckelung. Unter 100 % verfällt der Rest, über 100 % zählt er voll.",
    },
    {
      claim: "Nach L4.2 ist die Rechnung fertig.",
      why: "Nur die **Menge**. Der **Wert** bleibt bis L5 korrigierbar — und wirkt rückwirkend.",
    },
    {
      claim: "Eine KPI braucht eine Richtungsangabe.",
      why: "Die Richtung steckt im Vorzeichen von `Ziel − Baseline`.",
    },
    {
      claim: "KPIs pflegen verlangt das Binde-Recht.",
      why: "Nein — das Bearbeiten-Recht des Epics. Das Binde-Recht regelt nur die Brücke KPI → Key Result.",
    },
    {
      claim: "Wer ein Epic anlegen darf, darf es auch an ein Ziel binden.",
      why: "Anhängen ja, **beziffern** nein. Das ist seit September 2026 getrennt.",
    },
    {
      claim: "Plan gegen Ist gilt von Anfang an.",
      why: "Der Plan-Bezug entsteht mit L2. Davor ist jede Faktor-Änderung zugleich der Plan.",
    },
    {
      claim: "Wiederkehrender Nutzen ist immer jährlich.",
      why: "Das ist die Vorgabe, aber monatlich gibt es — dann zählt der Periodenwert direkt je Monat.",
    },
    {
      claim: "Ein Check-in trägt immer das heutige Datum.",
      why: "Das Datum ist wählbar und setzt den Punkt im Verlaufsgraphen.",
    },
    {
      claim: "Verknüpfte Arbeit am Ziel zählt in den Fortschritt.",
      why: "Es ist ein Deeplink, kein Wertbeitrag.",
    },
    {
      claim: "Der Epic Owner kann auf seinem Ziel einchecken.",
      why: "Check-in und Kommentar hängen am Recht, Ziele zu pflegen — das er nicht trägt.",
    },
  ],

  who: [
    {
      step: "KPI anlegen, gewichten, löschen",
      who: "Epic Owner, Portfolio Manager, Wertstrom-Owner (auf seinen Strom beschränkt)",
      capability: "epic.update",
    },
    { step: "Messwert erfassen", who: "dieselben", capability: "epic.update" },
    { step: "Epic an ein Ziel **anhängen**", who: "dieselben", capability: "epic.update" },
    {
      step: "Einen **bezifferten** Beitrag binden (Faktor, Art, Intervall)",
      who: "Portfolio Manager / Admin",
      capability: "kpi.bind",
    },
    { step: "Impact abnehmen (L5)", who: "Finance", capability: "epic.gate.decide" },
    {
      step: "Check-in, Fortschritt, Kommentar",
      who: "Portfolio Manager / Admin; Wertstrom-Owner in seinem Wertstrom",
      capability: "target.manage",
    },
    {
      step: "Unterziel aus dem Rollup nehmen, Team setzen",
      who: "dieselben",
      capability: "target.manage",
    },
    { step: "Custom-Field-**Werte** setzen", who: "dieselben", capability: "target.manage" },
    {
      step: "Custom-Field-**Definitionen**",
      who: "Tenant-Admin",
      capability: "goal.custom_field.manage",
    },
  ],
};
