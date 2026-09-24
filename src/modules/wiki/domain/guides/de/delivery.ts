import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Was liefert, was blockiert“ — die versionierte Langfassung liegt unter
 * `docs/concepts/delivery-walkthrough.md`.
 *
 * Der Ablauf haengt am Modul **drumbeat**: Cockpit, Feature-Uebersicht und
 * Abhaengigkeiten sind seine Flaechen. Ohne das Modul gibt es sie nicht — und
 * dann auch keine Anleitung dazu.
 */
export const DELIVERY: Guide = {
  slug: "was-liefert-was-blockiert",
  title: "Was liefert, was blockiert",
  teaser: "Delivery-Status, WSJF, Abhängigkeiten.",
  standfirst:
    "Der Alltag im Cockpit: die Reihenfolge, der Status und das, was dazwischenkommt. Der Takt gibt den Rahmen — hier steht, was **innerhalb** davon täglich passiert, und die drei Flächen, die es dafür gibt.",
  cadence: "je_pi",
  module: "drumbeat",
  seeAlso: ["ein-pi-von-anfang-bis-ende", "was-dazwischenkommt", "ein-epic-reift"],

  mechanics: [
    { kind: "quote", text: "Die Schreibmaschine eines Features." },
    { kind: "figure", figure: "deliveryChain" },
    {
      kind: "paragraph",
      text: "**Der Weg von _Blockiert_ zurück ist die Pointe.** Blockiert zu sein ist kein Makel und keine Sackgasse. Und es gibt **zwei** Enden: _Abgebrochen_ ist eine Entscheidung, keine Niederlage.",
    },
    {
      kind: "paragraph",
      text: "Diesen Status setzt der Feature Owner selbst. Er ist die **einzige Stelle, an der täglich etwas beigetragen wird** — und die Zahl, aus der alles andere abgeleitet wird: der Fortschritt des Epics, die Auslastung des ARTs, die Frage, ob das PI zu ist.",
    },
    { kind: "quote", text: "Drei Flächen für dieselben Features." },
    {
      kind: "table",
      head: ["Fläche", "Wofür sie gebaut ist"],
      rows: [
        [
          "**Delivery-Cockpit**",
          "Board, Tabelle, Fahrplan und Netzwerk in einer Fläche. Der Arbeitsplatz. ART und PI sind **Ausschnitte**, keine eigenen Orte.",
        ],
        [
          "**Features-Übersicht**",
          "Alle Features im Zugriff — über Wertströme, ARTs und PIs hinweg. Die Suche, wenn man nicht weiß, wo etwas hängt.",
        ],
        [
          "**Abhängigkeiten**",
          "Alle Abhängigkeiten über PIs hinweg; Cross-ART und Critical Path sind direkt sichtbar.",
        ],
      ],
    },
    {
      kind: "aside",
      text: "Die ersten beiden zeigen dasselbe von zwei Seiten: das Cockpit **innerhalb** eines Zuges, die Übersicht **quer** über alle.",
    },
    {
      kind: "note",
      text: "**Die drei Beteiligten tragen fast identische Rechte.** Der Unterschied ist nicht die Reichweite, sondern die Blickrichtung: der Feature Owner sein Backlog, der RTE sein ART, der Portfolio Manager das Portfolio.",
    },
  ],

  perspectives: [
    {
      label: "Der Feature Owner",
      role: "feature_owner",
      question: "Was baue ich als Nächstes, und woher weiß ich das?",
      stations: [
        {
          title: "Die Reihenfolge ist meine Aussage",
          route: "/umsetzung",
          anchor: "cockpit-table",
          body: [
            {
              kind: "paragraph",
              text: "WSJF — **Weighted Shortest Job First**. Vier Zahlen, eine Division:",
            },
            {
              kind: "code",
              text: `        Business Value + Time Criticality + Risk Reduction
WSJF =  ─────────────────────────────────────────────────
                          Job Size`,
            },
            {
              kind: "paragraph",
              text: "Der Dialog trägt genau diese vier Felder; gerechnet wird auf zwei Nachkommastellen. **Ist eine der vier Zahlen leer, gibt es keinen Score** — die Pille zeigt dann „Score“ statt einer Zahl.",
            },
            {
              kind: "note",
              text: "**Dasselbe Ergebnis, zwei Bänder.** Der berechnete Wert wird in hoch/mittel/niedrig einsortiert — aber mit **verschiedenen Schwellen**, je nachdem, wo man hinschaut: das Cockpit nutzt ≥ 8 / ≥ 4, die ART-Feature-Listen ≥ 5 / ≥ 2. Das ist bewusst so und als **Datenunterschied** angelegt, nicht als zwei Implementierungen. Wer die Bänder über zwei Flächen vergleicht, vergleicht trotzdem Verschiedenes.",
            },
            {
              kind: "aside",
              text: "WSJF ist eine eigene **Practice**. Ist sie aus, verschwinden die Spalten — die Zahlen bleiben stehen, nur niemand schaut mehr hin.",
            },
          ],
        },
        {
          title: "Liefern",
          route: "/umsetzung",
          anchor: "cockpit-view-tabs",
          body: [
            {
              kind: "paragraph",
              text: "Den Status setze ich selbst, einzeln oder **im Stapel**. Jeder Wechsel wird protokolliert.",
            },
            {
              kind: "table",
              head: ["Status", "Was ich damit sage"],
              rows: [
                ["_Freigegeben_", "geplant, noch nicht angefangen"],
                ["_In Umsetzung_", "jetzt wird daran gearbeitet"],
                ["_Blockiert_", "es geht gerade nicht weiter — **kein Makel, ein Signal**"],
                ["_Abgeschlossen_", "fertig"],
                ["_Abgebrochen_", "wir machen es nicht"],
              ],
            },
          ],
        },
        {
          title: "Was mir auffällt, melde ich",
          route: "/issues",
          anchor: "issue-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Was uns aufhält, geht als **Issue** ins gemeinsame Register — Risiken und Blockaden liegen dort zusammen. **Melden darf jede Rolle**, bis hinunter zum Nur-Leser.",
            },
            {
              kind: "paragraph",
              text: "Was daraus wird, entscheidet ein anderer; hier zählt nur: **ein gemeldetes, nicht eingeordnetes Issue taucht am PI-Abschluss wieder auf.**",
            },
          ],
        },
      ],
    },

    {
      label: "Der RTE",
      role: "rte",
      question: "Wer wartet auf wen?",
      stations: [
        {
          title: "Abhängigkeiten sind eine eigene Praxis",
          route: "/dependencies",
          anchor: "dependencies-funnel",
          body: [
            {
              kind: "paragraph",
              text: "Hier liegen sie über alle PIs hinweg, mit **Cross-ART** und **Critical Path** direkt sichtbar. Vier Handlungen, und sie sind bewusst nicht dasselbe:",
            },
            {
              kind: "table",
              head: ["Handlung", "Was sie tut"],
              rows: [
                ["**Anlegen**", "eine neue Abhängigkeit als eigenes Objekt"],
                ["**Verknüpfen**", "eine bestehende an ein Arbeitspaket hängen"],
                ["**Typ ändern**", "blockiert · hängt ab von · bezieht sich auf"],
                ["**Lösen**", "einzeln oder im Stapel — **ein eigenes Recht**"],
              ],
            },
            {
              kind: "note",
              text: "**Warum Lösen ein eigenes Recht ist.** Eine Abhängigkeit zu knüpfen fügt Wissen hinzu; sie zu lösen **kippt fremde Planungsannahmen**. Wer sie gesetzt hat, hat sich darauf verlassen. Deshalb steht das Lösen unter einer eigenen Capability — auch wenn im Standard dieselben drei Rollen sie tragen.",
            },
            {
              kind: "aside",
              text: "Auch Abhängigkeiten sind eine eigene Practice. Ist sie aus, verschwindet die Fläche.",
            },
          ],
        },
        {
          title: "Verantwortung zuweisen, ohne den Inhalt zu ändern",
          body: [
            {
              kind: "paragraph",
              text: "Das Zuweisen eines Feature-Verantwortlichen ist **eine eigene Action** statt einer Nutzung des Bearbeiten-Rechts — und der Grund steht im Code: Epic Owner und Wertstrom-Verantwortliche dürfen den **Inhalt** eines Features nicht ändern, sollen aber die **Verantwortung** zuweisen können.",
            },
            {
              kind: "paragraph",
              text: "Das Rollenmodell kennt keine Vererbung, deshalb steht „ab Epic Owner aufwärts“ ausgeschrieben: Portfolio Manager, RTE, Feature Owner und Epic Owner unskopiert, der Wertstrom-Owner auf seinen Wertstrom beschränkt — dieselbe Konstruktion wie beim Epic.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Portfolio Manager",
      role: "portfolio_manager",
      question: "Wo steckt es, und was heißt das für die Epics?",
      stations: [
        {
          title: "Die Übersicht quer",
          route: "/implementation/features",
          body: [
            {
              kind: "paragraph",
              text: "Alle Features über Wertströme, ARTs und PIs hinweg — mit WSJF-Spalten, solange die Practice an ist. Das ist die Fläche für die Frage „wo hängt eigentlich X?“, wenn man den Zug nicht kennt.",
            },
          ],
        },
        {
          title: "Was der Status nach oben bewegt",
          body: [
            {
              kind: "paragraph",
              text: "Ich setze hier selten selbst etwas. Was mich interessiert, ist die **Ableitung**:",
            },
            {
              kind: "list",
              items: [
                "Der Reifegrad-Schritt **L4 → L4.2** eines Epics hat als **beratendes** Kriterium: alle Child-Features sind abgeschlossen. Beratend, nicht blockierend — der Antrag geht auch früher, dann steht die offene Zahl daneben und die Abnehmer entscheiden.",
                "Die **Auslastung eines ARTs** entsteht aus der Job Size seiner eingeplanten Features. Das ist die einzige Stelle, an der WSJF-Zahlen etwas anderes tun als sortieren.",
                "Ein **offenes Issue ohne ROAM** hält am Ende den PI-Abschluss auf — als Warnung in der Oberfläche, als Sperre über die Schnittstelle.",
              ],
            },
          ],
        },
        {
          title: "Löschen",
          body: [
            {
              kind: "paragraph",
              text: "Das Löschrecht tragen Portfolio Manager, RTE und Tenant-Admin — **nicht** der Feature Owner.",
            },
            {
              kind: "quote",
              text: "Wer etwas anlegt und pflegt, entscheidet nicht allein, dass es verschwindet.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "„Blockiert“ ist eine Sackgasse.",
      why: "Der Weg zurück in die Umsetzung steht offen — der Doppelpfeil ist Absicht.",
    },
    {
      claim: "„Abgebrochen“ heißt gescheitert.",
      why: "Es ist eine Entscheidung. Zwei Enden, nicht eines.",
    },
    {
      claim: "Ein WSJF-Band bedeutet überall dasselbe.",
      why: "Cockpit ≥ 8 / ≥ 4, ART-Listen ≥ 5 / ≥ 2. Derselbe Score, zwei Einordnungen.",
    },
    {
      claim: "Die ART-Ansicht des Cockpits ist eine eigene Seite.",
      why: "Es ist ein **Ausschnitt** derselben Fläche. Die alten Routen leiten dorthin um.",
    },
    {
      claim: "Es gibt eine Feature-QS.",
      why: "Der Freigabelauf wurde im Juni 2026 entfernt; „Acceptance“ ist heute ein Textfeld.",
    },
    {
      claim: "Als Feature Owner kann ich jedes Feature löschen.",
      why: "Nur in **deinen** ARTs. Das Löschrecht ist art-scoped — wie Anlegen und Bearbeiten.",
    },
    {
      claim: "Verantwortung zuweisen ist Teil des Bearbeiten-Rechts.",
      why: "Eigene Action — Zuweisen **ohne** Inhaltsänderung ist der ganze Zweck.",
    },
    {
      claim: "Eine Abhängigkeit zu lösen ist so harmlos wie sie zu setzen.",
      why: "Es kippt fremde Planungsannahmen. Deshalb ein eigenes Recht.",
    },
    {
      claim: "Ohne WSJF-Practice sind die Zahlen weg.",
      why: "Sie bleiben gespeichert. Nur die Spalten verschwinden.",
    },
  ],

  who: [
    {
      step: "Feature anlegen, schärfen, Acceptance Criteria",
      who: "Portfolio Manager, RTE, Feature Owner",
      capability: "feature.create",
    },
    { step: "WSJF bewerten", who: "dieselben", capability: "feature.wsjf.set" },
    { step: "PI zuordnen", who: "dieselben", capability: "feature.update" },
    {
      step: "Lieferstatus setzen, einzeln und im Stapel",
      who: "dieselben",
      capability: "feature.delivery.set",
    },
    {
      step: "Verantwortung zuweisen",
      who: "dieselben **plus Epic Owner**; Wertstrom-Owner auf seinen Strom beschränkt",
      capability: "feature.owner.assign",
    },
    {
      step: "Feature löschen",
      who: "Portfolio Manager, Tenant-Admin; **RTE** und **Feature Owner** auf ihren eigenen ARTs",
      capability: "feature.delete",
    },
    {
      step: "Abhängigkeit anlegen, verknüpfen, Typ ändern",
      who: "Portfolio Manager, RTE, Feature Owner",
      capability: "dependency.link",
    },
    { step: "Abhängigkeit lösen", who: "dieselben", capability: "dependency.unlink" },
  ],
};
