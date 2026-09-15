import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Eine Idee wird ein Vorhaben“ — die versionierte Langfassung liegt unter
 * `docs/concepts/epic-intake-walkthrough.md`.
 *
 * Diese Anleitung endet dort, wo „Ein Epic reift“ beginnt: bei einem Epic mit
 * Owner, das auf L1 zulaeuft. Sie wiederholt den Reifegrad-Lauf nicht, sondern
 * fuehrt zu ihm hin.
 */
export const EPIC_INTAKE: Guide = {
  slug: "eine-idee-wird-ein-vorhaben",
  title: "Eine Idee wird ein Vorhaben",
  teaser: "Einreichen, sichten, Owner benennen.",
  standfirst:
    "Der Weg vom Einfall bis zum Epic mit benanntem Owner — mit den Namen, die Pulse tatsächlich verwendet: Funnel, Erstsichtung, Erwartete Einordnung, Benefit-Hypothese. Die Phase, in der eine Entscheidung fällt, ohne dass ein Tor sie festhält.",
  cadence: "je_idee",
  module: "work",
  seeAlso: ["ein-portfolio-entsteht", "der-mandant-und-seine-menschen"],

  mechanics: [
    { kind: "quote", text: "Zwei Spalten, ein Reifegrad." },
    {
      kind: "paragraph",
      text: "Das Portfolio-Kanban hat sechs Spalten. Die ersten beiden sind der Gegenstand dieser Anleitung — und sie sind eine Besonderheit.",
    },
    { kind: "figure", figure: "kanbanColumns" },
    {
      kind: "paragraph",
      text: "Der Wechsel zwischen _Funnel_ und _Hypothese_ ist **kein Tor**: er passiert, sobald zum ersten Mal ein Epic Owner benannt wird. Ein Epic auf L0 **mit** diesem Stempel erscheint in der Spalte Hypothese, obwohl sein Reifegrad L0 bleibt.",
    },
    {
      kind: "quote",
      text: "Die Erstsichtung ist eine Entscheidung ohne Freigabelauf.",
    },
    {
      kind: "paragraph",
      text: "Es gibt keinen Antrag, keine Abnehmer, keinen Stempel L0,5 — es gibt eine **Benennung**, und mit ihr bewegt sich die Karte. Das ist die wichtigste Aussage über diese Phase.",
    },
    { kind: "quote", text: "Die Klasse steht hier noch nicht fest." },
    {
      kind: "paragraph",
      text: "Der Anlege-Dialog fragt nach der **Erwarteten Einordnung** — Portfolio-Epic oder ART-Epic. Sein Hilfstext sagt in zwei Sätzen, was das ist und was nicht: „Eine Erwartung, keine Entscheidung. Die Klasse entsteht aus den Kosten des freigegebenen Business Case — weicht sie ab, fragt die Fläche vor dem Antrag nach.“",
    },
    {
      kind: "paragraph",
      text: "Vor L3.1 hat ein Epic **gar keine Klasse**; das Abzeichen sagt „Noch nicht eingeordnet“. Erst der freigegebene Business Case liefert Kosten, und die werden mit dem Portfolio-Limit **des Wertstroms** verglichen: darüber Portfolio-Epic, darunter oder gleich ART-Epic.",
    },
    {
      kind: "note",
      text: "**„Ein Mitarbeiter mit einer Idee“ ist im Rechtemodell nicht vorgesehen.** Ein Epic anlegen dürfen nur Portfolio Manager, Epic Owner und — auf seinen eigenen Wertstrom beschränkt — der Wertstrom-Owner. Ein Feature Owner, ein RTE oder ein Nur-Leser kann **kein** Epic anlegen. Wer Ideen aus der Breite der Organisation einsammeln will, braucht dafür heute einen Weg außerhalb von Pulse — oder gibt den Einreichern die Rolle Epic Owner.",
    },
  ],

  perspectives: [
    {
      label: "Der Einreicher",
      question: "Wie bringe ich meine Idee ins Portfolio?",
      stations: [
        {
          title: "Das Epic anlegen",
          route: "/portfolio/epics",
          anchor: "epic-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Über das globale **+** wähle ich in der Gruppe _Initiative_ den Eintrag **Epic**; auf der Epic-Liste heißt derselbe Weg **Neues Epic**.",
            },
            {
              kind: "table",
              head: ["Feld", "Pflicht", "Anmerkung"],
              rows: [
                ["**Titel**", "ja", "—"],
                ["**Wertstrom**", "ja", "„Wertstrom wählen…“"],
                ["**ART**", "ja", "kaskadiert — erst der Wertstrom, dann der ART"],
                ["**Primär-Solution**", "nein", "„— später zuordnen —“"],
                [
                  "**Erwartete Einordnung**",
                  "ja",
                  "„Portfolio-Epic — über X €“ / „ART-Epic — bis X €“",
                ],
                [
                  "**Unterstütztes Ziel**",
                  "nein",
                  "der Ziel-Baum; hier hängt die Idee an der Strategie",
                ],
                ["**Beschreibung**", "nein", "ein Textfeld — es heißt nicht „Kurzbeschreibung“"],
              ],
            },
          ],
        },
        {
          title: "Zwei Dinge, die man beim ersten Mal falsch erwartet",
          body: [
            {
              kind: "paragraph",
              text: "**Es gibt kein Feld für eine geschätzte Größe.** Was danach aussieht, ist die _Erwartete Einordnung_ — und die fragt nicht nach einer Zahl, sondern nach einer **Seite der Grenze**. Der Grenzwert im Optionstext ist das Portfolio-Limit des gewählten Wertstroms; er ändert sich, wenn ich den Wertstrom wechsle.",
            },
            {
              kind: "paragraph",
              text: "**Der ART ist Pflicht, die Solution nicht.** Wer noch nicht weiß, zu welchem Produkt die Idee gehört, lässt das Feld auf „— später zuordnen —“ stehen.",
            },
            {
              kind: "aside",
              text: "Ein Epic ohne Primär-Solution erbt **keinen Horizont** — der käme aus der Solution. Setze ich ihn am Epic selbst, zählt es ganz normal in seine Quote; lasse ich beides leer, landet es im Trichter in der Bahn „Ohne“. Das ist kein Fehler, sondern die Auskunft.",
            },
            {
              kind: "paragraph",
              text: "Mit **Anlegen** ist die Idee eingereicht. Sie steht jetzt im **Funnel**, auf Reifegrad **L0**, ohne Owner — und wartet.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Portfolio Manager",
      role: "portfolio_manager",
      question: "Ist das eine Sache, und wer treibt sie?",
      stations: [
        {
          title: "Die Erstsichtung",
          route: "/portfolio/epics",
          anchor: "epics-funnel-bar",
          body: [
            {
              kind: "paragraph",
              text: "Meine Aufgabe ist es sicherzustellen, dass die Epics auf dem Board nachvollziehbar sind und eine angemessene Qualität haben. Ich gehe die eingereichten durch und frage in dieser Reihenfolge:",
            },
            {
              kind: "list",
              ordered: true,
              items: [
                "**Ergibt die Idee Sinn?**",
                "**Stimmen Wertstrom, ART und Solution?** Sie zu korrigieren ist billig, solange nichts daran hängt — später hängt daran das Geld: der Wertstrom bestimmt das Portfolio-Limit und damit die Klasse, und er bestimmt, wer die Reifegrad-Tore zeichnet.",
                "**Wer arbeitet die Hypothese aus?**",
              ],
            },
            {
              kind: "paragraph",
              text: "Die dritte Frage ist der eigentliche Akt.",
            },
          ],
        },
        {
          title: "Den Epic Owner benennen",
          anchor: "epic-lifecycle-stepper",
          body: [
            {
              kind: "paragraph",
              text: "Die Steuerung sitzt im Reiter **Reifegrad-Timeline**, aufklappbar am Meilenstein _Erstsichtung_, unter der Überschrift **Epic Owner**: ein Personen-Picker und die Schaltfläche **Owner zuweisen**. Ist niemand benannt, steht dort „Nicht zugewiesen“.",
            },
            {
              kind: "note",
              text: "**Der Hilfetext zeigt an die falsche Stelle.** Das Kriterium „Epic Owner ist benannt“ rät, ihn im Overview über das Owner-Feld zu benennen. Im Overview wird der Owner aber nur **angezeigt** — die einzige Stelle, an der man ihn setzt, ist der Reifegrad-Reiter.",
            },
            {
              kind: "paragraph",
              text: "**Mit der ersten Benennung wandert die Karte** von _Funnel_ nach _Hypothese_. Der Reifegrad bleibt L0; was sich ändert, ist der Stempel. Ab hier läuft der normale Prozess.",
            },
          ],
        },
        {
          title: "Was die Benennung sonst noch tut",
          body: [
            {
              kind: "paragraph",
              text: "Der Epic Owner ist Kriterium in **zwei** Toren: für L1 und für L2 steht „Epic Owner ist benannt“ in der Liste — beide Male **nicht blockierend**. Ein Epic kommt also auch ohne Owner durch, wenn die Abnehmer es so wollen. Die Fläche sagt es an, statt es zu erzwingen.",
            },
            {
              kind: "paragraph",
              text: "Blockierend ist an dieser Stelle etwas anderes: **die ausgearbeitete Benefit-Hypothese**. Und deren Freigabe ist kein eigener Lauf — sie geschieht mit der Abnahme des Schritts auf L1.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Epic Owner",
      role: "epic_owner",
      question: "Wie komme ich von der Idee zu etwas Tragfähigem?",
      stations: [
        {
          title: "Wenn ich nicht weiterkomme",
          body: [
            {
              kind: "paragraph",
              text: "Manchmal brauche ich Unterstützung bei der Vorbereitung. Dafür gibt es einen Haken auf der Reifegrad-Karte — mit einem Rettungsring und dem Text **I need help**. Der einzige englische Text auf dieser Fläche.",
            },
            {
              kind: "paragraph",
              text: "Kreuze ich ihn an, bestätigt die Fläche in einem Satz, was passiert: VMO und Portfolio-Management sehen dieses Epic jetzt in _Meine Tasks_.",
            },
            {
              kind: "note",
              text: "**Ankreuzen darf nur ich selbst.** Die Steuerung erscheint ausschließlich, wenn ich als Owner eingetragen **und** zugleich der angemeldete Nutzer bin — ein Dritter kann für mich nicht um Hilfe bitten.",
            },
          ],
        },
        {
          title: "Wer die Bitte sieht",
          route: "/my-tasks",
          body: [
            {
              kind: "paragraph",
              text: "Auf der anderen Seite steht dann der Abschnitt **Unterstützung angefragt** mit einer Zeile je Epic und der Schaltfläche **Zum Epic →**. Wer ihn sieht, ist genau geregelt:",
            },
            {
              kind: "list",
              items: [
                "wer die Rolle **Portfolio Manager** trägt, sieht **alle** offenen Bitten des Mandanten;",
                "alle anderen sehen nur die Epics der Wertströme, deren Portfolio Manager sie sind.",
              ],
            },
            {
              kind: "aside",
              text: "Womit sich zeigt, warum die Besetzung beim Aufbau zählt: **ein Wertstrom ohne benannten Portfolio Manager hat für diese Bitten keinen Empfänger** außer den Portfolio Managern des ganzen Mandanten.",
            },
          ],
        },
        {
          title: "Wenn der Business Case zu groß für die Idee ist",
          body: [
            {
              kind: "paragraph",
              text: "Der schwierigste Fall in dieser Phase ist nicht ein fehlender Owner, sondern eine Idee, deren **Umfang noch niemand kennt**. Ich weiß nicht, wie groß sie ist, nicht, was hineingehört, und einen belastbaren Business Case zu schreiben hieße, Zahlen zu erfinden.",
            },
            {
              kind: "quote",
              text: "Die Antwort darauf ist kein kleinerer Business Case, sondern ein kleineres Vorhaben.",
            },
            {
              kind: "paragraph",
              text: "Ein **R&D-Epic** im Horizont H3. Jede Stufe der Leiter will etwas anderes und hinterlässt etwas anderes:",
            },
            { kind: "figure", figure: "horizonLadder" },
            {
              kind: "paragraph",
              text: "**Für ein R&D-Epic darf der Business Case rudimentär bleiben** — mit ausreichender Zustimmung der Abnehmer. Das ist keine Nachlässigkeit, sondern die Konsequenz aus seinem Ziel: es soll nicht das Produkt liefern, sondern **das Wissen, das den nächsten Business Case erst möglich macht**.",
            },
          ],
        },
        {
          title: "Warum daraus neue Epics werden",
          body: [
            {
              kind: "paragraph",
              text: "Nach jedem Schritt entsteht ein **neues Epic**, kein umetikettiertes altes. Das hat einen fachlichen und einen mechanischen Grund.",
            },
            {
              kind: "list",
              items: [
                "**Fachlich** ist jede Stufe eine eigene Investitionsentscheidung mit eigenem Business Case, eigenem Budget und eigenen Abnehmern. Ein Pilot ist nicht die Fortsetzung der Discovery, sondern ihre Folge.",
                "**Mechanisch** friert der Horizont eines Epics mit der Business-Case-Freigabe ein. Ihn danach zu ändern ist dem Portfolio-Management vorbehalten.",
              ],
            },
            {
              kind: "quote",
              text: "Wanderte ein Epic mit, würde die Geschichte rückwirkend umgeschrieben.",
            },
            {
              kind: "paragraph",
              text: "Die gemessene Portfolio-Balance vergangener Halbjahre hinge dann davon ab, wo ein Vorhaben **heute** steht. Drei Epics in drei Horizonten sind drei Belege; ein Epic, das dreimal die Bahn wechselt, ist keiner.",
            },
            {
              kind: "aside",
              text: "**Der Horizont eines Epics ist vor L3.1 frei.** Wer ihn am Epic selbst setzt, übersteuert den der Primär-Solution — explizit schlägt abgeleitet. Genau das braucht ein R&D-Epic an einer laufenden Solution: die Solution steht in H1, das Vorhaben ist Discovery.",
            },
          ],
        },
        {
          title: "Vormerken ist nicht beantragen — aber notwendig",
          body: [
            {
              kind: "paragraph",
              text: "Zwei Häkchen am Epic sehen gleich aus und wiegen sehr verschieden.",
            },
            {
              kind: "paragraph",
              text: "**Im nächsten Steering-Meeting behandeln** ist ein reiner Merker: er wird angezeigt und lässt sich filtern, sonst nichts. Kein Dienst liest ihn.",
            },
            {
              kind: "paragraph",
              text: "**Fürs nächste Budget-Meeting vormerken ist eine Voraussetzung.** Die Kandidatenliste einer Budget-Runde verlangt **beides** — den Haken **und** einen freigegebenen Business Case. Ohne den Haken taucht mein Epic dort gar nicht erst auf, egal wie reif es ist.",
            },
            {
              kind: "paragraph",
              text: "Was er **nicht** tut: das Epic auf die Liste einer laufenden Kachel setzen. Das bleibt ein Akt des Portfolio Managers.",
            },
            {
              kind: "quote",
              text: "Zwei Schritte, zwei Personen: ich melde mein Vorhaben an, das Portfolio nimmt es zur Wahl.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Jeder Mitarbeiter kann ein Epic einreichen.",
      why: "Das Recht tragen nur Portfolio Manager, Epic Owner und der Wertstrom-Owner seines Stroms.",
    },
    {
      claim: "Im Dialog schätze ich die Größe.",
      why: "Es gibt keine Zahl — nur die **Seite** der Grenze: Portfolio-Epic oder ART-Epic.",
    },
    {
      claim: "Die Erwartete Einordnung legt die Klasse fest.",
      why: "Sie ist eine Erwartung. Die Klasse entsteht aus den Kosten des freigegebenen Business Case.",
    },
    {
      claim: "Die Erstsichtung ist ein Reifegrad-Schritt.",
      why: "Sie ist eine Benennung. Der Reifegrad bleibt L0, nur die Kanban-Spalte wechselt.",
    },
    {
      claim: "Ohne Owner geht es nicht weiter.",
      why: "„Epic Owner ist benannt“ ist in L1 und L2 **nicht** blockierend.",
    },
    {
      claim: "Die Karten zieht man im Kanban.",
      why: "Das Kanban ist **lesend**. Bewegt wird über die Reifegrad-Karte des Epics.",
    },
    {
      claim: "Ich hake „I need help“ für meinen Kollegen an.",
      why: "Der Haken erscheint nur beim Owner selbst, und nur wenn er auch der angemeldete Nutzer ist.",
    },
    {
      claim: "Die zwei Merker sind beide bloße Filter.",
      why: "Der Steering-Merker ja. Der Budget-Merker ist **Voraussetzung**: ohne ihn erscheint das Epic in keiner Kandidatenliste.",
    },
    {
      claim: "Aus dem R&D-Epic wird später das Pilot-Epic.",
      why: "Es entstehen **neue** Epics. Der Horizont friert mit der Business-Case-Freigabe ein.",
    },
  ],

  who: [
    {
      step: "Epic anlegen",
      who: "Portfolio Manager, Epic Owner; Wertstrom-Owner in seinem Strom",
      capability: "epic.create",
    },
    {
      step: "Wertstrom / ART / Solution korrigieren",
      who: "dieselben",
      capability: "epic.update",
    },
    {
      step: "Epic Owner benennen",
      who: "Portfolio Manager; Wertstrom-Owner in seinem Strom",
      capability: "epic.owner.assign",
    },
    {
      step: "Horizont am Epic setzen (vor L3.1)",
      who: "wer das Epic bearbeiten darf",
      capability: "epic.update",
    },
    {
      step: "Horizont nach der BC-Freigabe ändern",
      who: "Portfolio-Management",
      capability: "epic.portfolio_override",
    },
    { step: "„I need help“ setzen", who: "**nur der Owner selbst**" },
    {
      step: "Die Bitten in „Meine Tasks“ sehen",
      who: "Portfolio Manager (alle); sonst der Portfolio Manager des Wertstroms",
    },
    { step: "Epic löschen", who: "Portfolio Manager / Admin", capability: "epic.delete" },
  ],
};
