import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Epic reift“ — die versionierte Langfassung liegt unter
 * `docs/concepts/epic-lifecycle-walkthrough.md`.
 *
 * Der laengste Ablauf im Wiki, und der einzige, der dieselbe Strecke dreimal
 * vollstaendig durchlaeuft. Genau deshalb steht er hier als **eine** Anleitung
 * mit drei Perspektiven und nicht als drei: die Uebergaben sind die Sache.
 */
export const EPIC_LIFECYCLE: Guide = {
  slug: "ein-epic-reift",
  title: "Ein Epic reift",
  teaser: "Acht Schritte, acht Tore, fünf Parteien.",
  standfirst:
    "Derselbe Durchlauf, dreimal erzählt: aus Sicht des Epic Owners, der ihn vorantreibt, des Portfolio Managers, der ihn steuert und abnimmt, und der Finance, die das Geld und den Nutzen gegenzeichnet. Mit den Namen, die Pulse tatsächlich verwendet.",
  cadence: "je_idee",
  module: "work",
  seeAlso: ["eine-idee-wird-ein-vorhaben", "die-wirkung", "ein-art-epic-kommt-an-geld"],

  mechanics: [
    {
      kind: "paragraph",
      text: "Ein Epic durchläuft **acht Schritte**. Jeder einzelne bewegt sich dadurch, dass jemand ihn **beantragt** und benannte Personen ihn **abnehmen** — je Wertstrom und Tor konfigurierbar.",
    },
    { kind: "figure", figure: "gateLadder" },
    {
      kind: "paragraph",
      text: "Vor dem Antrag zeigt Pulse eine Checkliste: welche Kriterien erfüllt sind und welche fehlen. Beim Antrag wird diese Checkliste **eingefroren** und an der Antragszeile mitgeführt — damit später nachvollziehbar bleibt, worauf hin freigegeben wurde.",
    },
    {
      kind: "paragraph",
      text: "Zwei dieser Schritte tragen zugleich eine **inhaltliche Aussage**:",
    },
    {
      kind: "list",
      items: [
        "Die Abnahme von **L0 → L1** ist die Freigabe der **Benefit-Hypothese**.",
        "Die Abnahme von **Analyse → L2** ist die Freigabe des **Lean Business Case**.",
      ],
    },
    {
      kind: "paragraph",
      text: "Dieselbe Abnahme entscheidet noch etwas Drittes: **mit ihr entsteht die Einordnung** des Epics als Portfolio- oder ART-Epic. Vorher gibt es sie nicht — und deshalb kann sie vorher auch nichts steuern.",
    },
    {
      kind: "quote",
      text: "Freigeben und Weiterrücken sind ein Vorgang: ein Antrag, eine Abnahme, eine Aussage.",
    },
    {
      kind: "paragraph",
      text: "Solange ein Antrag offen ist, ist der Text **gesperrt**, über den entschieden wird — die Abnehmer sollen nicht auf etwas schauen, das sich unter ihnen ändert.",
    },
    {
      kind: "aside",
      text: "Sieben der acht Stufen werden so beantragt. Eine wird rein **abgeleitet**: _L4.1 Umsetzung läuft_ heißt „in Umsetzung, aber noch nicht bestätigt fertig“. Und zwei Schritte tragen gar keine Nummer am Epic: _Zur Analyse ausgewählt_ bleibt auf L1 stehen, _L4.2 Umsetzung fertig_ auf L4 — sie werden beantragt und abgenommen wie jeder andere, hinterlassen aber einen Stempel statt eines Reifegrads.",
    },
    { kind: "quote", text: "Wer die drei sind." },
    {
      kind: "table",
      head: ["Wer", "Woher die Reichweite kommt"],
      rows: [
        ["**Epic Owner**", "die Rolle, plus die Eintragung als Owner am Epic."],
        [
          "**Portfolio Manager / VMO**",
          "die Rolle — der konsolidierte Portfolio-Lead. Der **VMO-Sitz** in der Tor-Policy ist davon getrennt: der Wertstrom benennt je Strom die Person, die die Abnahme-Zeilen bekommt.",
        ],
        [
          "**Finance**",
          "**Keine Rolle.** Der Wertstrom benennt die Person; daraus folgen ihre Abnahme-Sitze und das Recht, die Run-the-Business-Positionen dieses Stroms zu pflegen.",
        ],
      ],
    },
  ],

  perspectives: [
    {
      label: "Der Epic Owner",
      role: "epic_owner",
      question: "Wie bringe ich mein Vorhaben durch?",
      stations: [
        {
          title: "Vom Ziel zur Idee",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "Ich sehe ein Kopf-Ziel und erkenne ein Vorhaben, das darauf einzahlt. Ich lege es als Epic an und verknüpfe es mit dem Ziel — über die KPI-Kette rechnet Pulse später aus, wie viel mein Epic zu diesem Ziel beiträgt.",
            },
            {
              kind: "paragraph",
              text: "Das Epic steht damit auf **L0 · Idee** im Funnel. Der Zeitstrahl im Reiter _Reifegrad-Timeline_ bekommt seinen ersten Eintrag.",
            },
          ],
        },
        {
          title: "Die Hypothese ausarbeiten",
          anchor: "entity-tab-rail",
          body: [
            {
              kind: "paragraph",
              text: "Ich werde als Owner eingetragen — damit gehört mir die Konkretisierung. Im Reiter _Hypothese_ schreibe ich die Benefit-Hypothese: erwarteter Nutzen, die Annahme dahinter, Leading Indicators, Risiken. Im _Overview_ ordne ich das Epic ein: Business oder Enabler, dazu der Horizont.",
            },
            {
              kind: "paragraph",
              text: "Nebenher trage ich im Timeline-Reiter einen ersten Wurf ein, je Phase ein Schätzdatum. Das ist grob — aber **zwei dieser Schätzungen sind mehr als eine Notiz**: aus „Umsetzung gestartet“ und „Umsetzung fertig“ leitet Pulse das geplante Zeitfenster ab.",
            },
          ],
        },
        {
          title: "L0 → L1 · Die Hypothese wird freigegeben",
          anchor: "epic-lifecycle-stepper",
          body: [
            {
              kind: "paragraph",
              text: "Ist die Hypothese ausgearbeitet, beantrage ich den Schritt. **Ab dem gestellten Antrag ist der Text gesperrt.** Der VMO stimmt zu — und mit diesem einen Akt ist die Hypothese freigegeben **und** das Epic steht auf L1.",
            },
            {
              kind: "paragraph",
              text: "Lehnt er begründet ab, bleibt das Epic auf L0 und der Text ist wieder frei. Habe ich es mir anders überlegt, ziehe ich meinen Antrag selbst zurück.",
            },
          ],
        },
        {
          title: "Geld für die Konkretisierung",
          body: [
            {
              kind: "paragraph",
              text: "Für die Konkretisierung brauche ich Geld, und es kommt aus derselben Budgetrunde wie alles andere — **eine je Halbjahr**. Mein Epic kommt schon mit der freigegebenen Hypothese auf die Kandidatenliste: Pulse setzt dann einen mandantenweit konfigurierten Default-Aufwand als Richtwert an, grob das, was das Erarbeiten des Business Case kostet.",
            },
            {
              kind: "paragraph",
              text: "Ich setze im Overview den Haken **Fürs nächste Budget-Meeting vormerken**. Die Runde entscheidet, ich bekomme das Geld, und ich beantrage **L1 → Analyse**.",
            },
            {
              kind: "aside",
              text: "Auf L2 zu stehen _ist_ „Business Case in Arbeit“ — eine Unterteilung gibt es hier nicht.",
            },
          ],
        },
        {
          title: "Der Business Case",
          body: [
            {
              kind: "paragraph",
              text: "Jetzt die eigentliche Arbeit, verteilt über vier Reiter:",
            },
            {
              kind: "list",
              items: [
                "_Deliverables_ — ich schneide die Endprodukte als Features.",
                "_Dependencies_ — ich hänge die Abhängigkeiten dran.",
                "_KPI & Nutzen_ — Baseline, Ziel, Einheit; zusammen mit Finance der Wert je Einheit und die Nutzenart, einmalig oder laufend.",
                "_Issues_ — was mir gefährlich werden kann, bewertet über Eintritt × Auswirkung.",
              ],
            },
            {
              kind: "paragraph",
              text: "**Die Baseline ist ein Feld, das ich hier setze**, kein Akt zu einem späteren Zeitpunkt. Komme ich nicht weiter, setze ich auf der Gate-Karte den Haken _I need help_ — die einzige Stelle im Ablauf, an der ich um Unterstützung bitte, statt etwas zu beantragen.",
            },
          ],
        },
        {
          title: "Analyse → L2 · Fünf Parteien zeichnen",
          body: [
            {
              kind: "paragraph",
              text: "Beim Antrag besetze ich die fünf Parteien: **Architect Lead, Business Owner, Finance, IRT-Owner und LACE/VMO**. Vier davon sind aus der Wertstrom-Governance vorbelegt — nur den IRT-Owner benenne ich selbst. Vorbelegt heisst vorbelegt: ich kann jede davon überschreiben.",
            },
            {
              kind: "paragraph",
              text: "Hat die Primär-Solution meines Epics einen benannten **Produkt-Manager**, zeichnet er als sechster mit: das Vorhaben verändert sein Produkt. Ist keiner benannt, fällt er **still** weg — der Antrag läuft wie zuvor.",
            },
            {
              kind: "note",
              text: "**Vor dem Absenden kann ein Dialog dazwischentreten.** Beim Anlegen habe ich hinterlegt, womit ich rechne. Weicht die aus den Kosten abgeleitete Einordnung davon ab, sagt Pulse mir das, bevor der Antrag rausgeht: „angelegt als …, die Kosten machen es zum …“.",
            },
            {
              kind: "paragraph",
              text: "Jede Freigabe zieht einen **Schnappschuss** des freigegebenen Textes. Brauche ich einen zweiten Anlauf, wird das Epic mit Begründung zurückgestuft — das kann nur das Portfolio-Management —, ich überarbeite und beantrage neu. Die Abnehmer sehen diesmal eine **Gegenüberstellung**: was stand da zuletzt, was steht da jetzt.",
            },
          ],
        },
        {
          title: "Mit der Freigabe entsteht die Einordnung",
          body: [
            {
              kind: "paragraph",
              text: "Vorher stand an meinem Epic „noch nicht eingeordnet“ — und das war keine Lücke, sondern die Wahrheit: ohne freigegebenen Business Case liegt keine belastbare Kostenschätzung vor, und ohne die ist nicht entschieden, wie groß das Vorhaben ist.",
            },
            {
              kind: "list",
              items: [
                "**darüber** → Portfolio-Epic. Es geht den bekannten Weg über die Kandidatenliste einer Budget-Kachel.",
                "**darunter** → ART-Epic. Es steht **nicht** auf der Kandidatenliste, sondern wird aus dem ART-Rahmen meines ARTs bedient.",
              ],
            },
            {
              kind: "paragraph",
              text: "Die Ausnahme heißt **Override**: wer sie trägt, kann erklären, dass ein Epic Portfolio-Sache bleibt, obwohl seine Kosten darunter liegen — mit Begründung. **Umgekehrt geht es nicht.** Was über dem Limit liegt, braucht eine Portfolio-Entscheidung, und der Rahmen eines ARTs könnte es ohnehin nicht tragen.",
            },
          ],
        },
        {
          title: "Der Weg zum Geld",
          body: [
            {
              kind: "paragraph",
              text: "**Ist mein Epic ein Portfolio-Epic**, steht es mit freigegebenem Business Case auf der Kandidatenliste, und der Richtwert ist jetzt die Summe der Kostenscheiben aus dem BC statt des Defaults. Die Runde diskutiert, entscheidet, teilt zu.",
            },
            {
              kind: "paragraph",
              text: "**Ist es ein ART-Epic**, warte ich auf keine Runde. Es taucht in der Kandidatenliste gar nicht auf; stattdessen steht es im Budget-Reiter meines ARTs zur Verteilung. Verteilt wird im laufenden oder im nächsten Halbjahr, **nicht rückwirkend**.",
            },
            {
              kind: "note",
              text: "Hat mein ART keinen Rahmen, hat mein Epic **keinen** Weg zu Geld. Pulse sagt das an der Epic-Seite, statt es mich beim Warten herausfinden zu lassen.",
            },
            {
              kind: "paragraph",
              text: "**Den freien Betrag sehe ich nicht:** die Geld-Reiter tragen ein eigenes Recht, und das liegt oberhalb des Epic Owners. Was ich sehe, ist, **ob** überhaupt ein Rahmen da ist. Der Rest ist ein Gespräch, und das ist Absicht.",
            },
          ],
        },
        {
          title: "L2 → L3 · Die Investitionsentscheidung",
          body: [
            {
              kind: "quote",
              text: "Erst die Zuteilung, dann der Antrag.",
            },
            {
              kind: "paragraph",
              text: "Die Reihenfolge ist die, die man leicht andersherum erwartet. **Die Freigabe von L3 genehmigt kein Geld, sie stellt fest, dass welches da ist.** Ein blockierendes Kriterium: die Summe der Zuteilung ist größer null.",
            },
            {
              kind: "paragraph",
              text: "Beide Wege — Kachel wie ART-Rahmen — schreiben in dieselbe Summe; für diesen Schritt ist also gleichgültig, woher das Geld kam. Mit der Abnahme stempelt Pulse Genehmiger und Datum ans Epic.",
            },
          ],
        },
        {
          title: "L3 → L4.1 · Umsetzung starten",
          body: [
            {
              kind: "paragraph",
              text: "Ich ordne meine Features den PIs zu und beantrage den Start. Ein Kriterium gibt es — mindestens ein Feature ist gestartet —, aber es blockiert nicht: **der Antrag selbst _ist_ der bewusste Start**.",
            },
            {
              kind: "aside",
              text: "**Zur Benennung:** die Leiter kennt **L4.1** und **L4.2** — nirgends ein blosses „L4“. Das Haupt-Tor, das beide Unterstufen umfasst, heisst in der Trichter-Leiste und im Kanban weiterhin L4; dort ist es aber eine **Spalte**, kein Schritt.",
            },
            {
              kind: "paragraph",
              text: "Die PI-Zuordnung ist keine Folge dieser Abnahme, sondern ihre **Voraussetzung**: ein Feature lässt sich erst starten, wenn es in einem PI liegt. Zum Umsetzungsstart erfasse ich den ersten Messwert je KPI — damit beginnt die Messreihe.",
            },
          ],
        },
        {
          title: "L4 → L4.2 · Umsetzung fertig",
          body: [
            {
              kind: "paragraph",
              text: "Ein Kriterium erinnert daran, dass alle Child-Features abgeschlossen sein sollten — es hält den Antrag aber nicht auf: **dass die Umsetzung fertig ist, stellt die Abnahme fest, nicht der Zähler.**",
            },
            {
              kind: "quote",
              text: "Mit ihr steht auch die gelieferte Menge fest.",
            },
            {
              kind: "paragraph",
              text: "Steht meine Erfolgs-KPI bei 70 %, dann sind es 70 % — der Rest wird nicht mehr hochgerechnet, denn **gebaut ist gebaut**. Liegt sie über 100 %, zählt sie voll. Spätere Messungen bewegen die Menge nicht mehr; was sich danach noch ändern kann, ist ihr _Wert_, und den verantwortet Finance.",
            },
          ],
        },
        {
          title: "L4.2 → L5 · Und dann warte ich",
          body: [
            {
              kind: "paragraph",
              text: "„Fertig gebaut“ ist nicht „Nutzen nachgewiesen“, und zwischen beidem darf beliebig viel Zeit liegen. Irgendwann sieht Controlling im Bericht, dass sich die Bottom Line bewegt hat, und sagt Bescheid.",
            },
            {
              kind: "paragraph",
              text: "Ich beantrage den letzten Schritt; Voraussetzung ist die bestätigte Umsetzung. Die Abnahme setzt den Impact-Stempel — und erst damit ist der Kreis zum Kopf-Ziel vom Anfang geschlossen.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Portfolio Manager",
      role: "portfolio_manager",
      question: "Arbeiten wir am Richtigen, und wo muss entschieden werden?",
      stations: [
        {
          title: "Der Tag beginnt bei den Zielen",
          route: "/ziele",
          body: [
            {
              kind: "paragraph",
              text: "Ich sehe nicht **ein** Epic, ich sehe alle. Zielbild und Kopf-Ziele stehen hier; jedes Epic zahlt später auf eines davon ein.",
            },
            {
              kind: "paragraph",
              text: "Ohne gepflegte Ziele lässt sich am Jahresende kein Wertnachweis führen — die KPI-Kette der Epics hängt an ihnen.",
            },
          ],
        },
        {
          title: "Das Portfolio-Board",
          route: "/portfolio",
          anchor: "portfolio-kanban",
          body: [
            {
              kind: "paragraph",
              text: "Alle Epics nach Reifegrad. **Was sich links staut, ist unentschieden; was rechts steht, läuft bereits.** Die Epic-Liste zeigt dieselbe Menge als Trichter, mit dem nächsten notwendigen Schritt je Zeile und der Zahl der offenen Abnehmer, wo ein Antrag läuft.",
            },
          ],
        },
        {
          title: "Meine Entscheidungen",
          route: "/my-tasks",
          anchor: "approvals-list",
          body: [
            {
              kind: "paragraph",
              text: "Was dort liegt, sind beantragte Reifegrad-Wechsel, an denen ich als Abnehmer benannt bin — daneben, in eigenen Abschnitten, die Unterstützungs-Bitten und die Verteil-Aufgaben.",
            },
            {
              kind: "paragraph",
              text: "Zu jedem sehe ich, worum es geht, und — sobald es eine frühere Freigabe gibt — die Gegenüberstellung zur zuletzt freigegebenen Fassung. Ich stimme zu oder lehne begründet ab; **eine Ablehnung ohne Text nimmt Pulse nicht an.**",
            },
            {
              kind: "quote",
              text: "Solange ich nichts tue, steht das Epic still.",
            },
            {
              kind: "paragraph",
              text: "Das ist kein Nebeneffekt, sondern die Absicht: der Reifegrad bewegt sich nur durch eine Unterschrift.",
            },
          ],
        },
        {
          title: "Wo ich zeichne",
          body: [
            {
              kind: "paragraph",
              text: "Das hängt an der Tor-Policy meines Wertstroms. Dies sind die **Code-Vorgaben**, je Wertstrom überschreibbar; das Quorum ist durchgehend **einstimmig** — wer eingetragen ist, muss zustimmen.",
            },
            { kind: "figure", figure: "lifecycleSteps" },
            {
              kind: "paragraph",
              text: "**Der Produkt-Manager steht an zwei Schritten, mit unterschiedlicher Reichweite.** An → L2 zeichnet er bei **jedem** Epic seiner Solution mit — dort existiert die Einordnung ja noch gar nicht, eine Einschränkung auf ART-Epics wäre nicht entscheidbar. An → L4.1 ist sie bekannt, und dort zeichnet er nur bei ART-Epics: sein Produkt wird aus dem Rahmen seines ARTs verändert.",
            },
            {
              kind: "aside",
              text: "Die fünf Parteien an → L2 sind zugleich der Ausdruck der Practice **Mehrparteien-Freigabe**. Ist sie im Zielbild aus, zeichnet dort der VMO allein. Wer für _dieses_ Epic zeichnet, entscheidet der Antragsteller beim Antrag — die Vorbelegung aus dem Wertstrom ist ein Vorschlag, keine Regel. Das bleibt eine Eigenschaft des Epics.",
            },
          ],
        },
        {
          title: "Zwei Listen, die ungefragt kommen",
          route: "/portfolio",
          body: [
            {
              kind: "paragraph",
              text: "**Zur Steuerung markiert** führt die Epics, deren Owner den Steering-Haken gesetzt hat, sortiert nach der längsten Zeit ohne Update — **das ist die Agenda des nächsten Termins, nicht meine Erfindung.**",
            },
            {
              kind: "paragraph",
              text: "Und die offenen _I need help_-Bitten: als Portfolio Manager sehe ich alle im Mandanten, ein reiner VMO die seines Wertstroms.",
            },
          ],
        },
        {
          title: "Das Geld",
          body: [
            {
              kind: "paragraph",
              text: "Es wird **nicht am Epic** verteilt, sondern in einem Budget-Zeitraum: ich lege eine Kachel mit ihrem Topf an, nehme die vorgemerkten Epics auf die Kandidatenliste, und Gruppen verteilen unabhängig voneinander.",
            },
            {
              kind: "paragraph",
              text: "Für ein einzelnes Epic zählt nur das Ergebnis. **Das schiebt es nicht weiter** — es erfüllt das blockierende Kriterium für → L3, mehr nicht. Die Investitionsentscheidung ist der Antrag plus meine und Finance’ Abnahme.",
            },
            {
              kind: "note",
              text: "**Ohne das Budget-Modul entfällt dieses Kriterium.** Dann gibt es keine Zuteilung, die es erfüllen könnte, und der Schritt L2 → L3 ruht allein auf der Abnahme durch VMO und Finance. Das ist kein Schlupfloch, sondern die Regel in Reinform: die Investitionsentscheidung soll aus einer **Unterschrift** entstehen und nicht aus einer Zahl — das Budget ist ihre Vorbedingung, nicht sie selbst.",
            },
          ],
        },
        {
          title: "Review und Guardrails",
          route: "/portfolio/guardrails",
          body: [
            {
              kind: "paragraph",
              text: "Im **Portfolio-Review** stelle ich Plan und Ist gegenüber: Benefit-Plan, Forecast, Plantreue, Terminabweichung — top-down von Portfolio über Wertströme bis zu einzelnen Epics. Über den Stichtag vergleiche ich Stände.",
            },
            {
              kind: "paragraph",
              text: "Auf der **Guardrails**-Fläche lese ich, ob die Verteilung noch zum Zielbild passt: der Horizont-Mix, die Aufteilung zwischen Business und Enabler, und das **Business-Owner-Engagement** — ob die Business Owner ihre Zeichnung an L2 überhaupt leisten und wie lange sie dafür brauchen.",
            },
          ],
        },
        {
          title: "Die Korrektur-Instanz",
          body: [
            {
              kind: "paragraph",
              text: "Geht etwas schief, bin ich sie: **nur ich darf einen Reifegrad zurückstufen**, genau einen Schritt, mit Pflicht-Begründung.",
            },
            {
              kind: "paragraph",
              text: "Das **räumt die Stempel des verlassenen Schritts ab** — eine zurückgenommene BC-Freigabe ist wirklich zurückgenommen, und der Text wird wieder editierbar. Bei den Risiken gilt dasselbe Prinzip: einordnen darf jeder, löschen nur ich.",
            },
          ],
        },
      ],
    },

    {
      label: "Finance",
      question: "Stimmt die Rechnung, und ist sie am Ende aufgegangen?",
      stations: [
        {
          title: "Ich habe keine Rolle im System",
          body: [
            {
              kind: "paragraph",
              text: "Ich bin an meinem Wertstrom als **Finance-Approver benannt**, und daraus folgt alles Weitere: die Abnahme-Zeilen, die bei mir landen, und das Recht, die Run-the-Business-Positionen dieses Wertstroms zu pflegen — ohne dass mir jemand eine Portfolio-Rolle geben müsste.",
            },
            {
              kind: "paragraph",
              text: "Was der Wertstrom und seine ARTs an Budget tragen, ergibt sich aus den Budget-Zeiträumen; **ich lese es, ich setze es nicht.** Ich habe **drei Sitze** im Lebenszyklus eines Epics.",
            },
          ],
        },
        {
          title: "→ L2 · Der Business Case",
          body: [
            {
              kind: "paragraph",
              text: "Ich bin eine der fünf Parteien. Was ich prüfe, hat der Epic Owner aufgeschrieben, aber **mit mir gerechnet**: die Kostenscheiben auf der einen Seite, auf der anderen die KPI-Kalkulation — Wert je Einheit, Nutzenart einmalig oder laufend, und daraus der Nutzenbeitrag.",
            },
            {
              kind: "paragraph",
              text: "Die Felder pflegt der Owner; meine Zeichnung ist die **Gegenprobe**. Sie deckt Deliverables und KPIs mit ab, es gibt keine getrennte Abnahme je Abschnitt. Zeichne ich nicht, ist der Business Case nicht freigegeben — das Quorum ist einstimmig.",
            },
          ],
        },
        {
          title: "→ L3 · Die Investitionsentscheidung",
          body: [
            {
              kind: "paragraph",
              text: "Hier zeichne ich zusammen mit dem VMO, und hier fällt das Geld. Blockierendes Kriterium ist eine Zuteilung größer null; die Abnahme stempelt Genehmiger und Datum ans Epic.",
            },
            {
              kind: "quote",
              text: "Ein freigegebener Business Case ist noch keine Investition.",
            },
            {
              kind: "paragraph",
              text: "Dass dieser Schritt vom Eintritt in L3 getrennt ist, ist genau deshalb Absicht.",
            },
          ],
        },
        {
          title: "→ L5 · Impact realisiert",
          body: [
            {
              kind: "paragraph",
              text: "Der letzte Schritt gehört **mir allein**. Voraussetzung ist die bestätigte Umsetzung. Ich bestätige, dass der prognostizierte Nutzen an den KPIs bzw. auf der Bilanz angekommen ist.",
            },
            { kind: "figure", figure: "gateCriteria" },
          ],
        },
        {
          title: "Menge und Wert — zwei Achsen",
          body: [
            {
              kind: "paragraph",
              text: "Genau im Fenster zwischen L4.2 und L5 liegt meine eigentliche Arbeit. Die **Menge** ist mit L4.2 festgeschrieben, der **Wert** noch nicht: jetzt zeigt sich, ob eine Einheit Verbesserung wirklich so viel gebracht hat, wie im Business Case angesetzt.",
            },
            {
              kind: "paragraph",
              text: "Ziehe ich den Umrechnungsfaktor nach, gilt der neue Wert **rückwirkend** für die ganze Ist-Rechnung — der **Plan** dagegen bleibt bei dem Faktor und dem Ziel, die bei der Freigabe galten. **Nur so misst Plan gegen Ist etwas.**",
            },
            {
              kind: "paragraph",
              text: "Darin steckt eine Asymmetrie, die den Schnitt erklärt: ich zeichne die **Geld**-Entscheidung mit und bestätige am Ende den **Nutzen** — den Eintritt in L3 mit dem freigegebenen Business Case aber nicht allein. Genau deshalb sind L2 und L3 zwei Schritte und nicht einer.",
            },
            {
              kind: "aside",
              text: "Ein Epic, das nur 70 % seines KPI-Ziels erreicht, dessen Einheiten sich aber als wertvoller herausstellen, kann unterm Strich trotzdem liefern — und man sieht, woran es lag.",
            },
          ],
        },
        {
          title: "Die Lesefläche dazwischen",
          route: "/portfolio/dashboard",
          body: [
            {
              kind: "paragraph",
              text: "Break-Even, Benefit Velocity gegen den Plan, die Kostenkurve gegen den Kostenneutralitäts-Zielwert, und der Wasserfall „Wert je Reifegrad-Status“ gegen den Zielwert des jeweiligen Kopf-Ziels.",
            },
            {
              kind: "paragraph",
              text: "Was dort als **Forecast** steht, ist genau das, was ich an L2 mitgezeichnet habe — und was als **Ist** danebensteht, das, was an L5 daraus geworden ist.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Ein Epic rückt vor, wenn die Kriterien erfüllt sind.",
      why: "Nichts rückt von selbst vor. Jeder Reifegrad-Wechsel wird beantragt und abgenommen; die Kriterien sind die Checkliste davor, nicht der Auslöser.",
    },
    {
      claim: "Die Business-Case-Freigabe und die Investitionsentscheidung sind ein Schritt.",
      why: "Es sind zwei: L2 gibt den Text frei, L3 stellt fest, dass Geld da ist. Deshalb zeichnet Finance zweimal.",
    },
    {
      claim: "Die Budget-Zuteilung schiebt mein Epic auf L3.",
      why: "Sie erfüllt nur das blockierende Kriterium. Der Schritt bleibt ein Antrag mit zwei Abnahmen.",
    },
    {
      claim: "Die Einordnung als Portfolio- oder ART-Epic steht beim Anlegen fest.",
      why: "Beim Anlegen steht eine **Erwartung**. Die Einordnung entsteht mit der BC-Freigabe aus den Kosten gegen das Portfolio-Limit.",
    },
    {
      claim: "Ein zu großes Epic kann per Override zum ART-Epic erklärt werden.",
      why: "Der Override geht nur in eine Richtung: Portfolio-Sache trotz kleiner Kosten. Umgekehrt könnte der Rahmen eines ARTs es ohnehin nicht tragen.",
    },
    {
      claim: "„L4“ ist ein Schritt.",
      why: "Es ist eine **Spalte** — das Haupt-Tor, das L4.1 und L4.2 umfasst. Als Schritt heisst der Eintritt in die Umsetzung überall **L4.1**.",
    },
    {
      claim: "Wenn die KPI später doch noch steigt, steigt auch die gelieferte Menge.",
      why: "Die Menge friert mit L4.2 ein. Was sich danach noch ändern kann, ist ihr Wert.",
    },
    {
      claim: "Ein korrigierter Wert je Einheit verändert auch den Plan.",
      why: "Er gilt rückwirkend fürs **Ist**. Der Plan bleibt bei dem Faktor, der bei der Freigabe galt — sonst misst der Vergleich nichts.",
    },
    {
      claim: "Der Epic Owner sieht, wie viel Rahmen sein ART noch frei hat.",
      why: "Die Geld-Reiter tragen ein eigenes Recht. Er sieht, **ob** ein Rahmen da ist — der Rest ist ein Gespräch, und das ist Absicht.",
    },
    {
      claim: "Ein abgelehnter Antrag braucht keine Begründung.",
      why: "Eine Ablehnung ohne Text nimmt Pulse nicht an.",
    },
  ],

  who: [
    {
      step: "Reifegrad-Wechsel beantragen",
      who: "der Epic Owner",
      capability: "epic.gate.request",
    },
    {
      step: "Einen beantragten Schritt abnehmen oder ablehnen",
      who: "wer laut Tor-Policy des Wertstroms eingetragen ist",
      capability: "epic.gate.decide",
    },
    {
      step: "Die Abnehmer je Wertstrom und Tor festlegen",
      who: "Portfolio Manager",
      capability: "epic.gate.approvers.configure",
    },
    {
      step: "Einen Reifegrad zurückstufen (genau einen Schritt, mit Begründung)",
      who: "**nur** das Portfolio-Management",
      capability: "epic.gate.revert",
    },
    {
      step: "Ein Epic trotz kleiner Kosten zur Portfolio-Sache erklären",
      who: "Portfolio-Management",
      capability: "epic.portfolio_override",
    },
    {
      step: "Business Case und Hypothese schreiben",
      who: "der Epic Owner",
      capability: "epic.update",
    },
    { step: "Den Nutzen an L5 bestätigen", who: "die Finance-Partei des Wertstroms" },
    {
      step: "Run-the-Business-Positionen pflegen",
      who: "die Finance-Partei des Wertstroms",
      capability: "rtb_item.manage",
    },
  ],
};
