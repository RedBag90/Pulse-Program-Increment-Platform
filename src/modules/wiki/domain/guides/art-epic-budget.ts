import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein ART-Epic kommt an Geld“ — die versionierte Langfassung liegt unter
 * `docs/concepts/art-epic-budget-walkthrough.md`.
 *
 * Der zweite Finanzierungsweg. Er existiert erst, seit die **Groesse** eines
 * Vorhabens darueber entscheidet, wer es verantwortet.
 */
export const ART_EPIC_BUDGET: Guide = {
  slug: "ein-art-epic-kommt-an-geld",
  title: "Ein ART-Epic kommt an Geld",
  teaser: "Rahmen, Zuteilung, Deckel.",
  standfirst:
    "Ein ART-Epic wartet auf keine Budget-Runde. Es steht auf keiner Kandidatenliste — nicht abgelehnt, sondern woanders zuhause. Der zweite Weg zum Geld, dreimal erzählt: aus Sicht des Epic Owners, des Produkt-Managers und des Wertstrom-Owners, bei dem der Rahmen entsteht.",
  cadence: "je_halbjahr",
  module: "budgeting",
  seeAlso: ["ein-budget-zeitraum", "ein-epic-reift"],

  mechanics: [
    {
      kind: "paragraph",
      text: "Vier Dinge muss man wissen, und drei davon überraschen.",
    },
    { kind: "quote", text: "Der Rahmen ist kein Betriebsgeld." },
    {
      kind: "paragraph",
      text: "Der ART-Epic-Budget wird geführt wie eine Run-the-Business-Position, trägt aber eine **eigene Art** — ausdrücklich getrennt, damit Wachstums-Geld nicht als Betrieb ausgewiesen wird. **Betriebsgeld finanziert nie ein Epic.** Wer nach „dem übrigen Run-the-Business-Budget“ fragt, fragt nach der falschen Größe.",
    },
    {
      kind: "paragraph",
      text: "Wie jede andere Position geht der Rahmen über die Kandidatenliste einer Halbjahres-Kachel. Was dort am Ende festgeschrieben ist, **ist** der Topf. **Ohne geschlossene Kachel für dieses Halbjahr ist er null**, auch wenn der Rahmen gepflegt ist.",
    },
    { kind: "quote", text: "Der Rahmen gilt je Halbjahr und wandert nicht." },
    {
      kind: "paragraph",
      text: "Zugeteilt wird im **laufenden oder im nächsten** Halbjahr, nie rückwirkend. Vergangene sind gesperrt, und Pulse sagt auch warum: die Zuteilungshistorie bleibt unbeweglich.",
    },
    {
      kind: "aside",
      text: "Ein Rest aus dem letzten Zyklus ist **kein verfügbares Geld** — er verfällt nicht und wandert nicht, er wird ausgewiesen und ist die Grundlage für das Gespräch über den nächsten Rahmen.",
    },
    { kind: "quote", text: "Erst die Zuteilung, dann der Antrag." },
    {
      kind: "paragraph",
      text: "Der Schritt **L3.1 → L3.2** hat genau ein Kriterium, und es ist **blockierend**: die Summe der Zuteilung ist größer null. Der Antrag scheitert sonst schon beim Anlegen, nicht erst bei der Abnahme.",
    },
    {
      kind: "paragraph",
      text: "Das ist kein Versehen, sondern eine Festlegung: die Investitionsentscheidung soll ein **eigener, beantragter Schritt** sein und nicht die Nebenwirkung einer Budgetzuteilung. Die Abnahme genehmigt deshalb kein Geld — **sie stellt fest, dass welches da ist.**",
    },
    { kind: "quote", text: "Reserviert wird nichts." },
    {
      kind: "paragraph",
      text: "Einen Zwischenzustand „vorgemerkt, aber noch nicht wirksam“ kennt das Modell nicht. **Zugeteilt ist zugeteilt**: die Zeile am ART entsteht, der Rest des Rahmens sinkt sofort, und am Epic steht dieselbe Summe, die auch eine Kachel geschrieben hätte.",
    },
  ],

  perspectives: [
    {
      label: "Der Epic Owner",
      role: "epic_owner",
      question: "Wie komme ich an das Geld, das ich brauche?",
      stations: [
        {
          title: "Die Einordnung ist entstanden",
          body: [
            {
              kind: "paragraph",
              text: "Mein Business Case ist freigegeben, das Epic steht auf **L3.1**. Mit dieser Abnahme ist etwas passiert, das vorher nicht möglich war: Pulse hat die Kostenscheiben zusammengerechnet und dem Portfolio-Limit meines Wertstroms gegenübergestellt — meine liegen darunter, also ist mein Vorhaben ein **ART-Epic**.",
            },
            {
              kind: "paragraph",
              text: "Was das heißt, merke ich sofort: **in der Kandidatenliste der nächsten Budget-Kachel tauche ich gar nicht auf.** Ich warte auf keine Runde. Mein Geld liegt woanders.",
            },
          ],
        },
        {
          title: "Mein erster Schritt ist ein Haken",
          body: [
            {
              kind: "paragraph",
              text: "Im Overview setze ich **Fürs nächste Budget-Meeting vormerken**. Bei einem Portfolio-Epic meldet der Haken eine Runde an; **bei mir tut er etwas anderes** — er schaltet mein Epic auf der Verteilliste meines ARTs frei.",
            },
            {
              kind: "paragraph",
              text: "Ohne ihn steht dort keine Zeile, in die jemand einen Betrag eintragen könnte. Das ist die einzige Handlung dieses Abschnitts, die bei mir selbst liegt.",
            },
          ],
        },
        {
          title: "Dann muss ich fragen",
          body: [
            {
              kind: "paragraph",
              text: "Auf meiner Epic-Seite sehe ich, **ob** für meinen ART überhaupt ein Rahmen angelegt ist — ist keiner da, sagt Pulse mir das deutlich, statt es mich beim Warten herausfinden zu lassen. **Wie viel davon frei ist, sehe ich nicht.**",
            },
            {
              kind: "quote",
              text: "Geld gehört an den Knoten, nicht ans Epic.",
            },
            {
              kind: "paragraph",
              text: "Auskunft geben mir der **Wertstrom-Owner**, die **Finance-Partei**, der **RTE** — der den Topf seines ARTs sieht — oder das **Portfolio-Management**. Und der **Produkt-Manager** meiner Primär-Solution, der nicht nur Auskunft gibt, sondern selbst zuteilen darf.",
            },
          ],
        },
        {
          title: "L3.2 beantragen — jetzt erst",
          body: [
            {
              kind: "paragraph",
              text: "Ist der Betrag eingetragen, beantrage ich **Budget alloziert**. Vorher wäre der Antrag gar nicht herausgekommen; das Kriterium blockiert. Abgenommen wird von **zwei** Seiten — dem VMO meines Wertstroms und der Finance-Partei.",
            },
            {
              kind: "paragraph",
              text: "Der Rest ist derselbe Weg wie bei jedem anderen Epic: Features den PIs zuordnen — das ist eine Handlung im Cockpit, **keine Folge einer Abnahme** — und **L4.1** beantragen.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Produkt-Manager",
      question: "Was passiert mit meinem Produkt, und kann ich etwas dagegen tun?",
      stations: [
        {
          title: "Ein Feld, keine Rolle",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "Ich bin an einer Solution als Produkt-Manager eingetragen. **Das ist keine Rolle, sondern ein Personenfeld** — Produktverantwortung fällt nicht mit einer SAFe-Rolle zusammen, und wer sie trägt, ist eine Frage der Organisation, nicht der Berechtigung.",
            },
            {
              kind: "paragraph",
              text: "Daraus folgen drei Dinge: ich darf meine Solution bearbeiten, ich zeichne Freigaben mit — und **ich darf das Geld dafür zuteilen**.",
            },
          ],
        },
        {
          title: "Zuteilen, aber nur für meine Epics",
          body: [
            {
              kind: "paragraph",
              text: "Aus dem Rahmen des ARTs, aber **nur den Epics meiner Solution**. Der Rahmen gehört dem ART, die Verantwortung für das einzelne Vorhaben mir; deshalb hängt dieses Recht **am Epic, nicht am Topf**.",
            },
            {
              kind: "paragraph",
              text: "Stünde es am Topf, dürfte ich über fremde Vorhaben desselben ARTs mitentscheiden, nur weil sie zufällig danebenliegen.",
            },
            {
              kind: "paragraph",
              text: "Auf der Verteilfläche sehe ich deshalb **alle** Zeilen, bedienen kann ich meine eigenen. Bei den übrigen steht der Betrag als Text — **ein Eingabefeld, das beim Speichern ablehnt, wäre die schlechtere Auskunft.**",
            },
            {
              kind: "aside",
              text: "Der Reiter öffnet sich mir überhaupt nur an den ARTs, an denen mindestens ein vorgemerktes Epic meiner Solution auf Geld wartet. Wo ich nichts tun kann, sehe ich auch den Rahmen nicht.",
            },
            {
              kind: "quote",
              text: "Verantwortung ohne Handlungsmöglichkeit wäre eine leere Zuschreibung.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Wertstrom-Owner",
      role: "value_stream_owner",
      question: "Reicht das Geld, das ich habe, für das, was ansteht?",
      stations: [
        {
          title: "Der Rahmen entsteht bei mir",
          route: "/budgeting/value-streams",
          body: [
            {
              kind: "paragraph",
              text: "Im Reiter _Betrieb_ lege ich **je ART** eine Position mit der Art _ART-Epic-Budget_ an. Sie geht denselben Weg wie jede Run-the-Business-Position: sie wird Kandidat auf der Liste der Halbjahres-Kachel, und was dort festgeschrieben wird, ist der Topf.",
            },
            {
              kind: "note",
              text: "**Lege ich für einen ART keinen an, hat jedes ART-Epic dieses ARTs keinen Weg zu Geld**: es steht nicht auf der Kandidatenliste und hat keinen Topf. Der Ausweg ist entweder ein Rahmen — oder die bewusste Erklärung, dass dieses Vorhaben trotz seiner Größe Portfolio-Sache bleibt.",
            },
          ],
        },
        {
          title: "Verteilt wird am ART",
          route: "/budgeting/arts",
          body: [
            {
              kind: "paragraph",
              text: "Dort sehe ich drei Zahlen: **Topf, Verteiltes, Rest**. Darunter die vorgemerkten ART-Epics mit ihrem Richtwert — **der friert beim ersten Zuteilen ein**, sonst verschöbe sich die Liste zwischen zwei Besuchen dem Business Case hinterher, ohne dass jemand etwas getan hat.",
            },
            {
              kind: "paragraph",
              text: "Zwei Grenzen halten mich, und **beide prüft der Schreibpfad in derselben Transaktion**, nicht nur die Oberfläche:",
            },
            {
              kind: "list",
              items: [
                "**Der Rahmen ist der Deckel.** Was nicht mehr hineinpasst, bleibt sichtbar ungedeckt. Es gibt keine Quote und keinen Verteilschlüssel — wer leer ausgeht, geht leer aus, weil das Geld alle ist.",
                "**Das Halbjahr ist gesperrt oder offen.** Laufendes und nächstes ja, vergangene nein.",
              ],
            },
          ],
        },
        {
          title: "Wer sonst noch verteilt — und wer nicht",
          body: [
            {
              kind: "paragraph",
              text: "Neben mir die **Finance-Partei** meines Wertstroms — ohne dafür eine Rolle zu brauchen — und das **Portfolio-Management**. Dazu der **Produkt-Manager** einer Solution, aber nur für deren eigene Epics.",
            },
            {
              kind: "paragraph",
              text: "**Der RTE sieht seinen Topf, verteilt ihn aber nicht**: der Rahmen wird _für_ den ART verteilt, nicht _von_ ihm.",
            },
            {
              kind: "quote",
              text: "Und ich zeichne nicht mit.",
            },
            {
              kind: "paragraph",
              text: "An L3.2 stehen der VMO und die Finance-Partei; die Investitionsentscheidung ist die ihre, nicht meine. **Ich stelle das Geld bereit und teile es zu — über den Reifegrad entscheidet die Governance.**",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Ich beantrage L3.2, damit das Budget genehmigt wird.",
      why: "Umgekehrt. L3.2 **setzt** die Zuteilung voraus — sie ist das einzige, blockierende Kriterium des Schritts.",
    },
    {
      claim: "Ich frage den Solution Manager.",
      why: "Diese Rolle gibt es nicht. Der Nächstliegende ist der **Produkt-Manager** einer Solution — ein Feld, keine Rolle.",
    },
    {
      claim: "Ich frage, wie viel Run-the-Business-Budget übrig ist.",
      why: "Falsche Größe. Der ART-Epic-Budget ist eine eigene Art; Betriebsgeld finanziert nie ein Epic.",
    },
    {
      claim: "Das Geld kommt aus dem letzten Budget-Zyklus.",
      why: "Der Rahmen gilt je Halbjahr und wandert nicht. Vergangene Halbjahre sind gesperrt.",
    },
    {
      claim: "Das Budget wird reserviert.",
      why: "Einen Zwischenzustand gibt es nicht. Zugeteilt ist zugeteilt, der Rest sinkt sofort.",
    },
    {
      claim: "Mit L4.1 kommen die Features ins nächste PI.",
      why: "Keine Abnahme rührt die Features an. Ein Feature muss _schon_ in einem PI liegen, um gestartet werden zu können.",
    },
    {
      claim: "Der RTE verteilt den Rahmen seines ARTs.",
      why: "Er sieht ihn. Verteilt wird der Rahmen **für** den ART, nicht **von** ihm.",
    },
  ],

  who: [
    {
      step: "ART-Epic-Budget anlegen",
      who: "Wertstrom-Owner, Portfolio-Management; Finance-Partei über den Seam",
      capability: "rtb_item.manage",
    },
    {
      step: "Rahmen in der Kandidatenliste festschreiben",
      who: "Finance, beim Schließen der Kachel",
      capability: "budget.manage",
    },
    { step: "Epic vormerken", who: "Epic Owner", capability: "epic.update" },
    {
      step: "Freien Rahmen sehen",
      who: "Tenant-Admin, Portfolio Manager, Wertstrom-Owner; RTE auf seinem ART; Finance-Partei; Produkt-Manager auf seinen ARTs",
      capability: "budget.read",
    },
    {
      step: "Aus dem Rahmen zuteilen",
      who: "Wertstrom-Owner, Portfolio-Management, Finance-Partei; **Produkt-Manager** für die Epics seiner Solution",
      capability: "rtb_item.manage",
    },
    { step: "L3.2 und L4.1 beantragen", who: "Epic Owner", capability: "epic.gate.request" },
    { step: "L3.2 abnehmen", who: "VMO **und** Finance-Partei des Wertstroms" },
    { step: "L4.1 abnehmen", who: "VMO; bei ART-Epics zusätzlich der Produkt-Manager" },
  ],
};
