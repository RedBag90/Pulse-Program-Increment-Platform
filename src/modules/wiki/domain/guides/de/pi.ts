import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein PI von Anfang bis Ende“ — die versionierte Langfassung liegt unter
 * `docs/concepts/pi-walkthrough.md`.
 *
 * Die einzige Anleitung, die eine **bewusste Luecke** im Produkt beschreibt,
 * statt sie zu verschweigen: das Abschluss-Tor ist nur ueber die Schnittstelle
 * scharf, weil es fuer zwei seiner vier Bedingungen keine Flaeche gibt.
 */
export const PI: Guide = {
  slug: "ein-pi-von-anfang-bis-ende",
  title: "Ein PI von Anfang bis Ende",
  teaser: "Kadenz führen, liefern, fortschreiben.",
  standfirst:
    "Der Takt: wann ein Zeitraum beginnt, wie in ihm gearbeitet wird und was ihn beendet. Dreimal erzählt — aus Sicht des RTE, der die Kadenz führt, des Feature Owners, der liefert, und des Epic Owners, der zusieht, wie sein Vorhaben Gestalt annimmt.",
  cadence: "je_pi",
  module: "drumbeat",
  seeAlso: ["was-liefert-was-blockiert", "was-dazwischenkommt", "ein-epic-reift"],

  mechanics: [
    {
      kind: "paragraph",
      text: "Ein Program Increment durchläuft drei Zustände: **geplant → aktiv → abgeschlossen**. Strikt vorwärts, keine Rückwege, abgeschlossen ist endgültig. Zwei Regeln rahmen das ein:",
    },
    {
      kind: "list",
      items: [
        "**Ein aktives PI je Timeline.** Ein zweites zu starten scheitert mit dem Namen des Störenfrieds. **Die Kadenz ist eine Reihe, keine Wolke.**",
        "**Ein PI ohne Timeline lässt sich weder starten noch fortschreiben.** Die Timeline ist der Träger des Takts; ein PI daneben wäre ein Termin ohne Kalender.",
      ],
    },
    {
      kind: "paragraph",
      text: "Der Takt selbst wird **nicht am PI** gepflegt, sondern am **PI-Standard der Timeline**: Ankertag, Ankermonat, Kadenz in Wochen, Anzahl. Daraus entstehen die PIs. Ein ART **tritt einer Timeline bei** und übernimmt damit ihren Takt — er trägt keine eigene Kadenz.",
    },
    { kind: "quote", text: "Das Abschluss-Tor — und warum es zwei Wege gibt." },
    {
      kind: "paragraph",
      text: "Ein PI abzuschließen heißt zu behaupten, dass ein Zeitraum wirklich zu Ende ist. Pulse kennt dafür ein Tor mit vier Bedingungen:",
    },
    {
      kind: "table",
      head: ["Bedingung", "Warum"],
      rows: [
        [
          "keine offenen Issues **ohne ROAM**",
          "Ein Risiko, das niemand eingeordnet hat, wandert sonst unbemerkt ins nächste PI",
        ],
        ["System-Demo-Termin gesetzt", "Es gab eine Gelegenheit, das Ergebnis zu zeigen"],
        ["Inspect-&-Adapt-Termin gesetzt", "Es gab eine Gelegenheit, daraus zu lernen"],
        ["Retrospektive-Notizen vorhanden", "Das Gelernte steht irgendwo"],
      ],
    },
    {
      kind: "note",
      text: "**Dieses Tor ist heute nur über die Schnittstelle erreichbar.** In der Oberfläche gibt es genau einen Weg, ein PI zu beenden — _PI abschließen & nächstes öffnen_ —, und der prüft nur die offenen ROAM-Issues, und auch die nur als **Warnung**, die nicht blockiert. Die drei Zeremonien werden dort gar nicht geprüft.",
    },
    {
      kind: "paragraph",
      text: "Das ist kein Versehen, sondern eine bewusste Lücke mit einem Grund, der im Code steht: **es gibt keine Oberfläche, um die drei Termine zu setzen.** Ein Tor, das niemand öffnen kann, würde den Betrieb anhalten.",
    },
    {
      kind: "quote",
      text: "Wer das Tor scharf haben will, braucht zuerst die Fläche dafür.",
    },
  ],

  perspectives: [
    {
      label: "Der RTE",
      role: "rte",
      question: "Wie führe ich die Kadenz?",
      stations: [
        {
          title: "Die PIs stehen schon im Kalender",
          route: "/structure/timelines",
          body: [
            {
              kind: "paragraph",
              text: "Meine Timeline hat einen PI-Standard, und daraus stehen die nächsten PIs bereits. **Ich muss sie nicht anlegen; ich muss entscheiden, wann eines startet.**",
            },
          ],
        },
        {
          title: "Die PI-Planung",
          route: "/umsetzung",
          anchor: "cockpit-pi-strip",
          body: [
            {
              kind: "paragraph",
              text: "Sie hat **keine eigene Fläche mehr** — sie findet im Cockpit statt. Dort ordne ich Features den PIs zu und sehe die Last dagegen: unter jedem PI-Titel steht die eingeplante Job Size, und daneben das **Ziel** — überplant wird rot. Das Ziel tippe ich nicht ein, es errechnet sich: in der PI-Leiste trage ich die **Kapazität** meines ARTs ein (Personen, Personentage — Hauptsache, über die PIs gleich gezählt), und Pulse nimmt den Durchschnitt der gelieferten Job Size je Kapazität aus den letzten vier abgeschlossenen PIs, mal meine Kapazität, mal 0,8. Die Rechnung steht daneben, die Vorgänger mit ihrer Quote im Tooltip. Das Ziel folgt keinem Filter, die Last auch nicht.",
            },
            {
              kind: "quote",
              text: "Was hier zugeordnet wird, ist der Inhalt, über den ich gleich sage: das schaffen wir.",
            },
          ],
        },
        {
          title: "Starten",
          body: [
            {
              kind: "paragraph",
              text: "Pulse prüft zweierlei: dass das PI auf _geplant_ steht — ein abgeschlossenes lässt sich nicht erneut starten — und dass in derselben Timeline nicht schon eines aktiv ist.",
            },
            {
              kind: "paragraph",
              text: "Das zweite ist die Regel, die mich am häufigsten trifft, und **sie ist richtig so**: zwei aktive PIs nebeneinander hießen, dass niemand mehr sagen kann, in welchem Takt gearbeitet wird.",
            },
          ],
        },
        {
          title: "Im Cockpit leben",
          route: "/umsetzung",
          anchor: "cockpit-pi-context",
          body: [
            {
              kind: "paragraph",
              text: "Es zeigt die Matrix aus PIs und Features, den Delivery-Status jeder Zeile, und wo es klemmt. **Ein ART oder ein PI ist kein eigener Ort, sondern ein Ausschnitt derselben Fläche** — die früheren Routen leiten genau dorthin um.",
            },
          ],
        },
        {
          title: "Die Kadenz fortschreiben",
          body: [
            {
              kind: "paragraph",
              text: "**PI abschließen & nächstes öffnen** ist eine Transaktion: das laufende PI geht auf _abgeschlossen_, das nächste öffnet sich. Existiert kein nächstes, erzeugt Pulse es aus der Kadenz.",
            },
            {
              kind: "paragraph",
              text: "Gibt es offene Issues ohne ROAM, sagt Pulse mir das als **Warnung**; ich kann trotzdem fortschreiben — **aber ich weiß es dann.**",
            },
            {
              kind: "aside",
              text: "Was ich dabei **nicht** bekomme, ist der Anspruch, den das Abschluss-Tor formuliert: nach System-Demo, Inspect & Adapt und Retrospektive fragt mich hier niemand. Wer diese Disziplin will, muss sie heute außerhalb von Pulse führen.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Feature Owner",
      role: "feature_owner",
      question: "Was trage ich täglich bei?",
      stations: [
        {
          title: "Ein Status, der eine Zusage ist",
          route: "/umsetzung",
          anchor: "cockpit-table",
          body: [
            {
              kind: "paragraph",
              text: "Mein Feature ist einem PI zugeordnet — das hat die PI-Planung entschieden. Für mich beginnt die Arbeit mit dem Delivery-Status.",
            },
            { kind: "figure", figure: "deliveryChain" },
            {
              kind: "paragraph",
              text: "Diesen Status setze ich selbst. Er ist die einzige Stelle, an der ich täglich etwas beitrage — **und die Zahl, aus der alles andere abgeleitet wird**: die Fortschrittsanzeige meines Epics, die Auslastung meines ARTs, die Frage, ob das PI zu ist.",
            },
          ],
        },
        {
          title: "Das System Demo — im Konjunktiv",
          body: [
            {
              kind: "paragraph",
              text: "Zum System Demo trüge ich bei, was ich gebaut habe: die Demo eines PI **wäre** eine geordnete Liste von Punkten, jeder darf sich auf ein Feature beziehen. Es wäre die eine Gelegenheit, an der das Ergebnis eines PI **nicht als Status, sondern als Sache** gezeigt wird.",
            },
            {
              kind: "note",
              text: "**Im Konjunktiv, und das ist kein Stil.** Der Dienst dahinter ist vollständig gebaut, samt Integrationstest; eine Server-Action und eine Oberfläche gibt es nicht. Das Recht ist erteilbar, aber nicht auslösbar. Das ist dieselbe Lücke, die oben das Abschluss-Tor stumpf macht — **hier ist sie die Ursache, dort die Wirkung.**",
            },
          ],
        },
        {
          title: "Was mir auffällt",
          route: "/issues",
          body: [
            {
              kind: "paragraph",
              text: "Fällt mir etwas auf, das uns aufhält, melde ich es als **Issue**. Hier zählt nur: **ein gemeldetes, nicht eingeordnetes Issue taucht am PI-Abschluss wieder auf.**",
            },
          ],
        },
      ],
    },

    {
      label: "Der Epic Owner",
      role: "epic_owner",
      question: "Was habe ich mit dem Takt zu tun?",
      stations: [
        {
          title: "Ich liefere nichts",
          body: [
            {
              kind: "paragraph",
              text: "Mein Epic steht auf **L4.1 · Umsetzung läuft**, und was jetzt passiert, passiert an meinen Features. Was ich sehe, ist **Ableitung**: wie viele meiner Child-Features begonnen und wie viele abgeschlossen sind.",
            },
            {
              kind: "paragraph",
              text: "Das ist zugleich das Kriterium meines nächsten Schritts. **Beratend, nicht blockierend**: ich kann den Antrag auch früher stellen, dann steht die offene Zahl daneben und die Abnehmer entscheiden.",
            },
          ],
        },
        {
          title: "Was der Takt mir gibt",
          body: [
            {
              kind: "paragraph",
              text: "Etwas, das der Reifegrad allein nicht hätte: einen **Rhythmus**. Zwischen L4.1 und L4.2 liegen ein oder mehrere PIs, und jedes davon hat ein Ende, an dem gezeigt wird, was entstanden ist.",
            },
            {
              kind: "quote",
              text: "Mein Epic bewegt sich nicht, weil jemand es bewegt, sondern weil ein Zeitraum vergangen ist, in dem gearbeitet wurde.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Die Oberfläche prüft die vier Bedingungen des Abschlusses.",
      why: "Sie prüft eine davon, und die nur als Warnung. Das volle Tor gibt es nur über die Schnittstelle.",
    },
    {
      claim: "Ein ART hat seine eigene Kadenz.",
      why: "Er **tritt einer Timeline bei** und übernimmt deren Takt. Die Kadenz hängt am PI-Standard der Timeline.",
    },
    {
      claim: "Zwei PIs derselben Timeline können parallel laufen.",
      why: "Ein zweites zu starten scheitert — mit dem Namen des Störenfrieds.",
    },
    {
      claim: "Ein abgeschlossenes PI lässt sich wieder öffnen.",
      why: "Der Weg ist strikt vorwärts. Abgeschlossen ist endgültig.",
    },
    {
      claim: "Es gibt eine eigene PI-Planungs-Fläche.",
      why: "Sie findet im Cockpit statt; die alte Route leitet dorthin um.",
    },
    {
      claim: "Die System-Demo lässt sich in Pulse pflegen.",
      why: "Der Dienst ist gebaut, die Oberfläche nicht. Das Recht ist erteilbar, aber nicht auslösbar.",
    },
    {
      claim: "Mit dem PI-Abschluss bewegt sich mein Epic.",
      why: "Nichts rückt von selbst vor. Das Epic bewegt sich durch einen beantragten Schritt.",
    },
    {
      claim: "Der Takt und das Geld hängen zusammen.",
      why: "Geld wird je Halbjahr entschieden, geliefert wird je PI. Berührung gibt es nur mittelbar über die Job Size.",
    },
  ],

  who: [
    { step: "PI anlegen, ändern, löschen", who: "RTE", capability: "pi.create" },
    { step: "PI starten", who: "RTE, Wertstrom-Owner", capability: "pi.start" },
    {
      step: "Kadenz fortschreiben (der Weg in der Oberfläche)",
      who: "RTE, Wertstrom-Owner",
      capability: "pi.advance",
    },
    {
      step: "PI abschließen (volles Tor, nur über die Schnittstelle)",
      who: "RTE, Wertstrom-Owner",
      capability: "pi.complete",
    },
    {
      step: "PI-Standard einer Timeline pflegen",
      who: "Tenant-Admin, Portfolio Manager",
      capability: "pi_standard.manage",
    },
    {
      step: "Timeline anlegen, ART beitreten lassen",
      who: "Tenant-Admin, Portfolio Manager",
      capability: "timeline.manage",
    },
    {
      step: "Delivery-Status eines Features",
      who: "Feature Owner, RTE, Portfolio Manager",
      capability: "feature.delivery.set",
    },
    {
      step: "System-Demo pflegen — **ohne Oberfläche**",
      who: "RTE, Feature Owner",
      capability: "pi.demo.manage",
    },
  ],
};
