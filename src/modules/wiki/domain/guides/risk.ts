import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Was dazwischenkommt“ — die versionierte Langfassung liegt unter
 * `docs/concepts/risk-walkthrough.md`.
 *
 * Der einzige Ablauf, der **jederzeit** stattfindet statt in einem Takt —
 * deshalb steht er im Bogen unter „Querschnitt“.
 */
export const RISK: Guide = {
  slug: "was-dazwischenkommt",
  title: "Was dazwischenkommt",
  teaser: "Melden, aufnehmen, ROAMen.",
  standfirst:
    "Ein Register für Risiken und Blockaden, zwei unabhängige Achsen und eine Handlung mit unmittelbarer Wirkung auf den Takt. Dreimal erzählt: aus Sicht dessen, der meldet, dessen, der aufnimmt, und dessen, der einordnet.",
  cadence: "querschnitt",
  module: "risks",
  seeAlso: ["ein-pi-von-anfang-bis-ende", "was-liefert-was-blockiert"],

  mechanics: [
    {
      kind: "paragraph",
      text: "Pulse führt **ein** mandantenweites Register. Risiken und Impediments waren einmal zwei Tabellen; sie sind zusammengelegt, weil in der Praxis niemand vorab sagen kann, ob eine Beobachtung das eine oder das andere ist.",
    },
    { kind: "quote", text: "Was zählt, ist, was mit ihr geschieht." },
    {
      kind: "paragraph",
      text: "Und das läuft auf **zwei voneinander unabhängigen Achsen** — das ist die eine Sache, die man verstanden haben muss.",
    },
    {
      kind: "paragraph",
      text: "**Achse 1 · Die Prüfung: kommt es ins Register?** Ein Vorschlag ist noch kein Eintrag. Nur ein Vorschlag lässt sich prüfen; die Entscheidung führt entweder **ins** Register oder **daran vorbei**. Ein einmal geprüfter Eintrag lässt sich nicht erneut prüfen — die Achse läuft in eine Richtung.",
    },
    {
      kind: "aside",
      text: "Der Standard eines **neu angelegten** Issues ist „dokumentiert“: wer das Recht hat, direkt zu dokumentieren, geht nicht durch die Vorschlagsschleife.",
    },
    { kind: "paragraph", text: "**Achse 2 · ROAM: was tun wir damit?**" },
    { kind: "figure", figure: "roamAxes" },
    {
      kind: "note",
      text: "**Die beiden Achsen greifen nicht ineinander.** Ein Eintrag kann dokumentiert und trotzdem offen sein — das ist sogar der häufigste Zustand kurz nach dem Anlegen, **und genau er ist es, der am PI-Abschluss auftaucht.** ROAM und Exposure gelten nur für dokumentierte Einträge; einen Vorschlag einzuordnen hieße, über etwas zu entscheiden, das noch niemand angenommen hat.",
    },
    { kind: "quote", text: "Die Exposure: eine Bewertung, zwei Angaben." },
    {
      kind: "paragraph",
      text: "**Eintrittswahrscheinlichkeit × Auswirkung**, je fünfstufig. Ihr Produkt ist der Score von 1 bis 25, und der fällt in ein Band.",
    },
    { kind: "figure", figure: "exposureMatrix" },
    {
      kind: "paragraph",
      text: "**Dieselbe Funktion färbt die Zeile in der Liste und die Zelle in der Matrix** — deshalb können die beiden nicht auseinanderlaufen. Eine Bewertung ist **optional**: ein Eintrag ohne sie ist ungescored und sortiert ans Ende, statt eine Null zu behaupten.",
    },
    {
      kind: "paragraph",
      text: "Dazu kommen eine optionale **Kategorie**, eine **laufende Nummer** je Mandant als Handhabe im Gespräch, die Verknüpfung zu einem **Epic oder Feature**, und die Möglichkeit, Einträge unter einem Kopf-Issue zu bündeln.",
    },
    {
      kind: "aside",
      text: "Die Bewertungen werden **historisiert**: jede Neubewertung ist eine eigene Zeile mit Datum und Notiz. Man sieht also nicht nur, wie riskant etwas ist, sondern **wie sich diese Einschätzung entwickelt hat**.",
    },
  ],

  perspectives: [
    {
      label: "Wer meldet",
      question: "Wie werde ich eine Beobachtung los?",
      stations: [
        {
          title: "Melden darf ich in jedem Fall",
          route: "/issues",
          anchor: "issue-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Ich sehe etwas, das uns aufhalten wird. Vielleicht bin ich Feature Owner und merke, dass eine Schnittstelle nicht rechtzeitig steht; vielleicht bin ich Nur-Leser und kenne einen Vertrag, der ausläuft.",
            },
            {
              kind: "paragraph",
              text: "Das Melde-Recht liegt bei **allen** Rollen, bis zum Nur-Leser hinunter — und das ist Absicht:",
            },
            {
              kind: "quote",
              text: "Beobachtungen sind wertlos, wenn der Weg, sie loszuwerden, an einer Berechtigung hängt.",
            },
            {
              kind: "paragraph",
              text: "Was ich hinschreibe, ist ein Titel und, wenn ich kann, eine Beschreibung. **Bewerten muss ich nicht** — Wahrscheinlichkeit und Auswirkung darf einschätzen, wer mehr Überblick hat. Was ich beitrage, ist die Beobachtung.",
            },
          ],
        },
        {
          title: "Was danach mit meinem Eintrag ist",
          body: [
            {
              kind: "paragraph",
              text: "Er steht auf **Vorschlag**. Er ist im System, aber noch nicht im Register: er trägt keine Exposure, taucht in der Matrix nicht auf, und **er blockiert auch keinen PI-Abschluss**. Er wartet darauf, dass jemand ihn ansieht.",
            },
          ],
        },
      ],
    },

    {
      label: "Wer aufnimmt",
      role: "rte",
      question: "Ist das eine Sache?",
      stations: [
        {
          title: "Eine binäre, einmalige Entscheidung",
          route: "/issues",
          anchor: "issues-funnel-bar",
          body: [
            {
              kind: "paragraph",
              text: "**Annehmen** oder **ablehnen**. Ein bereits Geprüftes kann ich nicht noch einmal prüfen — die Achse läuft vorwärts.",
            },
            {
              kind: "paragraph",
              text: "Nehme ich an, ist der Eintrag im Register. Jetzt gehört ihm eine **Bewertung**, und erst damit hat er ein Gewicht, mit dem sich arbeiten lässt. Ich kann ihn außerdem **verknüpfen**: mit dem Epic oder Feature, an dem er hängt, und mit einem Kopf-Issue, wenn mehrere Einträge dasselbe Thema haben.",
            },
          ],
        },
        {
          title: "Ablehnen heißt nicht löschen",
          body: [
            {
              kind: "paragraph",
              text: "Lehne ich ab, **verschwindet nichts**. Der Eintrag bleibt stehen — nachvollziehbar, dass jemand ihn gesehen und entschieden hat.",
            },
            {
              kind: "quote",
              text: "Ein Vorschlag, der spurlos verschwindet, ist ein Grund, beim nächsten Mal nichts mehr zu melden.",
            },
            {
              kind: "paragraph",
              text: "Meine Reichweite hängt daran, wo ich stehe: als Portfolio Manager oder RTE gilt sie mandantenweit, als Epic Owner **nur in meinem Wertstrom**. Das ist dieselbe Eingrenzung, die auch sonst im Produkt trägt — **man entscheidet dort, wo man die Folgen mitträgt.**",
            },
          ],
        },
      ],
    },

    {
      label: "Wer ROAMt",
      role: "portfolio_manager",
      question: "Wie gebe ich den Takt wieder frei?",
      stations: [
        {
          title: "Der Zustand, der zurückkommt",
          route: "/issues?matrix=1",
          anchor: "risk-matrix",
          body: [
            {
              kind: "paragraph",
              text: "Ein dokumentierter Eintrag steht zunächst auf **offen**: er ist da, er ist bewertet, aber niemand hat gesagt, was daraus wird. Meine Aufgabe ist die Einordnung — vier Möglichkeiten, und **keine davon heißt „ignorieren“**.",
            },
          ],
        },
        {
          title: "Die Handlung mit der unmittelbarsten Wirkung",
          body: [
            {
              kind: "quote",
              text: "Ein offenes, nicht eingeordnetes Issue meldet sich beim PI-Abschluss zurück.",
            },
            {
              kind: "paragraph",
              text: "Im vollen Tor der Schnittstelle **blockiert** es, in der Oberfläche **warnt** es. In beiden Fällen ist es genau ein Satz — und der verschwindet nur, wenn jemand entscheidet.",
            },
            {
              kind: "paragraph",
              text: "Bemerkenswert ist, was das **nicht** ist: keine Aufforderung, das Risiko zu lösen. _Accepted_ genügt.",
            },
            {
              kind: "quote",
              text: "Verlangt wird nicht die Beseitigung, sondern die Entscheidung.",
            },
            {
              kind: "paragraph",
              text: "Dass ein Zeitraum nicht endet, ohne dass jemand zu jedem offenen Punkt Stellung genommen hat — das ist der ganze Zweck.",
            },
          ],
        },
        {
          title: "Wo Risiken in die Steuerung treten",
          route: "/portfolio",
          body: [
            {
              kind: "paragraph",
              text: "Die Portfolio-Übersicht zeigt die dokumentierten Einträge als **ROAM-Board**: je eine Kachel für Offen, Owned, Resolved, Accepted und Mitigated, innerhalb nach Kritikalität geordnet. „Offen\u201c steht allein in der ersten Spalte — das ist die Menge, über die noch zu entscheiden ist. Es ist **die einzige Stelle, an der Risiken aus dem Register in die Steuerungssicht treten**.",
            },
            {
              kind: "aside",
              text: "Auf der Epic-Seite werden die Risiken des ganzen Feature-Teilbaums aufgerollt: man sieht am Epic, was unter ihm liegt, ohne es einzeln zu suchen.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Ein dokumentiertes Issue ist eingeordnet.",
      why: "Die beiden Achsen sind unabhängig. Dokumentiert **und** offen ist der häufigste Zustand — und genau der, der am PI-Abschluss auftaucht.",
    },
    {
      claim: "ROAM heißt, das Risiko zu beseitigen.",
      why: "_Accepted_ genügt. Verlangt wird die **Entscheidung**, nicht die Beseitigung.",
    },
    {
      claim: "Melden darf nur, wer auch bewerten darf.",
      why: "Das Melde-Recht liegt bei allen Rollen, bis zum Nur-Leser hinunter.",
    },
    {
      claim: "Ein abgelehnter Vorschlag verschwindet.",
      why: "Er bleibt als abgelehnt stehen — nachvollziehbar, dass jemand ihn gesehen und entschieden hat.",
    },
    {
      claim: "Ein Vorschlag blockiert den PI-Abschluss.",
      why: "Er trägt keine Exposure und ist nicht im Register. Nur dokumentierte, nicht eingeordnete Einträge kommen zurück.",
    },
    {
      claim: "Eine geprüfte Entscheidung lässt sich revidieren.",
      why: "Die Prüfachse läuft in **eine** Richtung. Ein einmal geprüfter Eintrag lässt sich nicht erneut prüfen.",
    },
    {
      claim: "Ein Eintrag ohne Bewertung zählt als niedriges Risiko.",
      why: "Er ist ungescored und sortiert ans Ende — statt eine Null zu behaupten.",
    },
    {
      claim: "Risiken und Blockaden sind zwei Register.",
      why: "Es ist eines. Niemand kann vorab sagen, ob eine Beobachtung das eine oder das andere ist.",
    },
  ],

  who: [
    {
      step: "Eine Beobachtung melden",
      who: "**jede** Rolle, auch der Nur-Leser",
      capability: "risk.suggest",
    },
    {
      step: "Einen Vorschlag prüfen — annehmen oder ablehnen",
      who: "Portfolio Manager, RTE; Epic Owner **wertstrom-eingegrenzt**",
      capability: "risk.review",
    },
    {
      step: "Direkt dokumentieren, bewerten, verknüpfen",
      who: "dieselben",
      capability: "risk.document",
    },
    { step: "ROAM setzen", who: "dieselben", capability: "risk.roam" },
    { step: "Einen Eintrag löschen", who: "Portfolio Manager / Admin", capability: "risk.delete" },
  ],
};
