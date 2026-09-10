import type { Guide } from "@/modules/wiki/domain/guide";

/**
 * „Ein Portfolio entsteht“ — die versionierte Langfassung liegt unter
 * `docs/concepts/portfolio-setup-walkthrough.md`, dort zusaetzlich mit den
 * Nachschlagepunkten im Code. Diese Datei ist die Fassung fuers Produkt: ohne
 * Dateipfade, dafuer mit Sprungzielen.
 */
export const PORTFOLIO_SETUP: Guide = {
  slug: "ein-portfolio-entsteht",
  title: "Ein Portfolio entsteht",
  standfirst:
    "Der Aufbau, dreimal erzählt: aus Sicht des Portfolio Managers, der das Kopfziel setzt und die Organisation aufnimmt, des Wertstrom-Owners, der seinen Ausschnitt scharf stellt, und des Produkt-Managers, der seine Solution einordnet. Der einzige Ablauf, den man in aller Regel **einmal** durchläuft.",
  teaser: "Kopfziel, Wertströme, ARTs, Solutions, Timelines, Guardrails, Unterziele.",
  cadence: "einmalig",
  seeAlso: ["der-mandant-und-seine-menschen"],

  mechanics: [
    {
      kind: "paragraph",
      text: "**Die Reihenfolge ist eine Abhängigkeit, keine Konvention.** Der Aufbau sieht aus wie eine Checkliste und ist keine: vier der sieben Schritte setzen einen anderen voraus, und wer sich irrt, muss zurück.",
    },
    {
      kind: "code",
      text: `Kopfziel ──────────────────────────────────────┐
                                               │
Wertstrom ──┬── ART ──┬── Solution             ├── Unterziel
            │         │                        │   braucht Kopfziel
            │         └── Timeline beitreten   │   + Wertstrom + ART
            │
            └── Finance Approver · Portfolio Manager
                Freigaben je Reifegrad
                Capacity · Portfolio-Limit

Portfolio-Guardrails ── tenant-weit, jederzeit`,
    },
    {
      kind: "paragraph",
      text: "Ein ART verlangt seinen Wertstrom im Anlege-Dialog. Eine Solution verlangt ihren Wertstrom und bietet ARTs erst an, wenn er gewählt ist. Eine Timeline hat keine ARTs zum Beitreten, bevor es ARTs gibt. Und ein Unterziel kann seine Verantwortung erst zuordnen, wenn Wertströme und ARTs stehen.",
    },
    {
      kind: "aside",
      text: "**Das Kopfziel ist die Ausnahme.** Es hängt an nichts und darf zuerst entstehen — und das ist die Aussage des ganzen Ablaufs: erst wird verabredet, was erreicht werden soll, dann wird die Organisation aufgenommen, die es erreichen soll.",
    },
    {
      kind: "paragraph",
      text: "**Vier Horizonte, fünf Stationen** — der häufigste Irrtum beim Aufbau, und einer, der sich später rächt. H1 zerfällt wirtschaftlich in zwei Phasen: ausbauen gegen ernten.",
    },
    { kind: "figure", figure: "horizonLadder" },
    {
      kind: "quote",
      text: "Die Achse bleibt vierwertig, die Leiter zeigt fünf Stufen.",
    },
    {
      kind: "paragraph",
      text: "Wer beim Aufbau „fünf Horizonte“ denkt, sucht später vergebens nach einem Guardrail-Feld für den fünften.",
    },
    {
      kind: "aside",
      text: "**Am Anfang ist der Portfolio Manager alle drei.** Beim allerersten Durchlauf gibt es niemanden, den man fragen könnte: keine Wertstrom-Owner, keine Produkt-Manager, keine Finance-Partei. Er trägt alles selbst ein und **benennt die anderen dabei**. Ab dem zweiten Durchlauf läuft es so, wie es hier in drei Teilen steht.",
    },
    {
      kind: "note",
      text: "Zwei Begriffe aus dem Sprachgebrauch haben in Pulse **keine Entsprechung**: „Portfolio Owner“ ist keine Rolle, und „VMO“ ist keine mehr. Es gibt acht Rollen; der `portfolio_manager` hat das VMO aufgesogen. Das Datenfeld am Wertstrom heißt noch `vmoId`, das Feld auf der Fläche heißt **Portfolio Manager**.",
    },
  ],

  perspectives: [
    {
      label: "Der Portfolio Manager",
      role: "portfolio_manager",
      question: "woraus besteht dieses Portfolio, und wohin soll es?",
      stations: [
        {
          title: "Das Kopfziel",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "Ich komme aus dem Termin mit der Geschäftsleitung und habe ein Ziel. Die Route ist deutsch: `/ziele`, nicht `/goals`.",
            },
            {
              kind: "paragraph",
              text: "Es gibt **zwei** Wege, ein Ziel anzulegen, und sie können verschieden viel. Der Schnell-Dialog aus dem globalen „+“-Menü fragt nur Titel, Zeitraum und Beschreibung. Der volle Drawer über „+ Ziel“ in der Tabelle trägt alles Übrige.",
            },
            {
              kind: "aside",
              text: "Der Schnell-Dialog hat **kein Owner-Feld und keine Fortschrittsquelle**. Wer mit ihm anlegt, muss das Ziel danach ohnehin öffnen — für ein Kopfziel lohnt sich gleich der Drawer.",
            },
            {
              kind: "paragraph",
              text: "**Zeitraum** ist ein Umschalter mit zwei Stellungen: **Raster** (FY / H1·H2 / Q1–Q4) oder **Individuell** — zwei Datumsfelder, „Start“ und „Ende“, im zweiten Modus beide Pflicht. **Owner** ist ein Personenfeld über die Tenant-Nutzer, ohne Rollenbindung.",
            },
            {
              kind: "paragraph",
              text: "Die **Fortschrittsquelle** entscheidet, welche Felder danach überhaupt erscheinen:",
            },
            {
              kind: "table",
              head: ["Label im UI", "Woraus der Fortschritt entsteht"],
              rows: [
                ["Manuell", "ich pflege den Ist-Wert selbst"],
                [
                  "Aus Unterzielen",
                  "gewichteter Durchschnitt der Kinder — **eine eigene Metrik wird ignoriert**",
                ],
                [
                  "KPI-Baum",
                  "Blatt: Ist aus verknüpften Epic-KPIs (Δ × Faktor); Ast: kaskadiert über die Unterziele",
                ],
              ],
            },
            {
              kind: "note",
              text: "Zwei Fallen. Bei **„Aus Unterzielen“** rendert die Fläche den ganzen Metrik-Block gar nicht erst — Baseline, Target, Einheit sind weg. Und **„KPI-Baum“ erscheint nur, wenn das Portfolio-Modul aktiv ist**; ohne es stehen faktisch zwei Optionen zur Wahl.",
            },
            {
              kind: "paragraph",
              text: "Die Details liegen beim **Anlegen** hinter einer Klappe namens **Erweitert**; beim späteren Bearbeiten stehen dieselben Felder offen im Reiter _Einstellungen_. Einen Knopf „erweitern“ gibt es nicht.",
            },
            {
              kind: "table",
              head: ["Feld", "Anmerkung"],
              rows: [
                ["Narrativ", "die Beschreibung des Ziels — sie heißt hier nicht „Beschreibung“"],
                ["Metriktyp", "Pflicht: Zahl · Prozent · Währung · Individuell"],
                ["Einheit (Label)", "nur bei Zahl und Individuell"],
                ["Baseline · Target (Zielwert)", "der Ausgangswert und das Ziel"],
                ["Aktuell", "nur bei Fortschrittsquelle Manuell"],
              ],
            },
            {
              kind: "paragraph",
              text: "Bei Metriktyp **Prozent** belegt die Fläche leere Werte mit 0 und 100 vor. „Speichern“ — das Kopfziel steht.",
            },
          ],
        },
        {
          title: "Die Wertströme",
          route: "/structure",
          anchor: "value-stream-create-button",
          body: [
            {
              kind: "paragraph",
              text: "Zwischen dem Ziel und dieser Zeile liegt die eigentliche Arbeit, und sie passiert **nicht** im Werkzeug: Workshops und Interviews mit den Bereichen. Drei Dinge nehme ich auf — welche **Solutions** genutzt werden, welche **Personengruppen** sich um sie kümmern, und wie sich das in **Wertströme** clustert.",
            },
            {
              kind: "aside",
              text: "Was ich aufnehme, ist mal die Ist-, mal die Soll-Organisation. Eine Entscheidung mit langem Schatten: **die gesamte Arbeitsstruktur richtet sich danach** — Budgets, Freigaben, Guardrails und die Zuordnung jedes Epics.",
            },
            {
              kind: "paragraph",
              text: "Im Werkzeug ist es dann kurz. Die Struktur liegt **nicht** in Reitern, sondern als drei Einträge in der Seitenleiste — **Organisation**, **Solutions**, **Timelines**. `/structure` ist ein Baum mit Detailfläche daneben; das Wort „Wertströme“ gibt es dort nur als **Filter-Chip** über dem Baum.",
            },
            {
              kind: "paragraph",
              text: "In der Kopfzeile des Baums sitzt der Knopf **Wertstrom**. Der Dialog fragt Name und Beschreibung, Schaltfläche **Anlegen**. Mehr nicht — alles Weitere gehört auf die Detailseite und damit in Teil 2.",
            },
          ],
        },
        {
          title: "Die ARTs",
          route: "/structure",
          anchor: "structure-tree",
          body: [
            {
              kind: "paragraph",
              text: "ARTs entstehen über das globale **„+“** oben rechts. Die Einträge liegen in Gruppen: _Strategie_ trägt „Ziel“, _Portfolio_ trägt „Value Stream“, „ART“ und „Solution“.",
            },
            {
              kind: "paragraph",
              text: "**Der ART-Dialog ist englisch** — als einziger in dieser Kette: „Create Agile Release Train“, Felder **Value Stream \\*** und **Name \\***, Knöpfe „Cancel“ und „Create ART“. Kein Beschreibungsfeld, **kein RTE-Feld**, keine Kadenz.",
            },
            {
              kind: "paragraph",
              text: "Den **RTE** trage ich danach auf der ART-Detailseite im Reiter _Allgemein_ ein — das Feld heißt dort **RTE (Release Train Engineer)**, gesichert mit **Änderungen speichern**. Wählbar sind nur Nutzer mit der Rolle RTE; gibt es keine, sagt die Fläche das, statt eine leere Liste zu zeigen.",
            },
            {
              kind: "aside",
              text: "Der RTE verantwortet den Prozess **innerhalb** seines ARTs: dass die PIs eingehalten und die Features eingeplant werden.",
            },
          ],
        },
        {
          title: "Die Solutions",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "Dieselbe „+“-Kachel, Eintrag „Solution“. Der Dialog **Neue Solution** fragt Name, Beschreibung, **Value Stream \\***, **ART** — kaskadiert, vor der Wertstromwahl steht dort „Zuerst Value Stream…“ — und **Status \\***.",
            },
            {
              kind: "note",
              text: "**Das Feld heißt „Status“, nicht „Horizont“** — obwohl überall sonst vom Horizont die Rede ist. Fünf Werte, alle englisch, in der Leiter oben.",
            },
            {
              kind: "paragraph",
              text: "Der Übergang **Emerging → Investing** ist der einzige mit einem Tor: die Stelle, an der aus einem Anwärter ein Produkt wird. Alles Weitere dazu steht in Teil 3.",
            },
          ],
        },
        {
          title: "Die PI-Kadenz",
          route: "/structure/timelines",
          body: [
            {
              kind: "paragraph",
              text: "Damit die ARTs einen sauberen Takt haben, brauchen sie eine Timeline: sie definiert die Dauer der Umsetzungsphasen. Seitenleiste **Struktur → Timelines**, Schaltfläche **Neue Timeline** — nicht „+ Timeline“ —, Dialog mit einem Feld Name.",
            },
            {
              kind: "list",
              ordered: true,
              items: [
                "**Program Increments** — einzeln über **Neues PI**, oder in einem Zug über **Standard anwenden…**",
                "**ART hinzufügen** — je ART ein **+ ART beitreten**. Danach stehen sie unter **Verknüpfte ARTs**.",
              ],
            },
            {
              kind: "note",
              text: "**Die beiden PI-Wege hängen an verschiedenen Rechten.** Sichtbar sind beide Knöpfe unter demselben Flag (`timeline.manage`). „Neues PI“ prüft ebenfalls `timeline.manage` — **„Standard anwenden…“ aber `pi.create`, und das trägt nur der RTE**. Ein Portfolio Manager sieht den Knopf deshalb und läuft in eine Absage.",
            },
            {
              kind: "aside",
              text: "**Eine Standard-Kadenz für alle ist die Empfehlung.** Eine eigene Kadenz je ART ist möglich, kostet aber genau das, wofür der Takt da ist: die synchronisierte Umsetzung. Ein ART trägt deshalb auch keine eigene Kadenz mehr — er **tritt** einer Timeline **bei**.",
            },
          ],
        },
        {
          title: "Die Guardrails",
          route: "/portfolio/guardrails",
          body: [
            {
              kind: "paragraph",
              text: "Hierfür braucht es ein Alignment mit dem Portfolio-Sponsor, typischerweise dem oberen Management. Die Fläche zeigt oben den Ist-Mix und unten unter **Soll-Mix (Targets)** das Formular.",
            },
            { kind: "figure", figure: "guardrailAxes" },
            {
              kind: "paragraph",
              text: "Guardrail 3 hat keine eigene Messung, nur einen Wert — er ist eine Grenze, kein Mix. Sein Hilfstext sagt in einem Satz, was er tut: **Ab dieser Größe entscheidet das Portfolio. Darunter finanziert der ART.**",
            },
            {
              kind: "paragraph",
              text: "Die Horizont-Verteilung trägt **fünf** Felder, nicht vier — hier zahlt sich aus, die Stationen verstanden zu haben. Die Summe muss 100 ergeben (Toleranz 0,5), sonst steht statt des Häkchens „— erwartet 100“.",
            },
            {
              kind: "aside",
              text: "Das ist der Grund, warum es die Achse überhaupt gibt: ohne sie liefe alles Geld in die laufenden Solutions, und für neue Ideen bliebe nichts.",
            },
            {
              kind: "paragraph",
              text: "Capacity Allocation und Portfolio-Limit setze ich hier **für alle Wertströme**. Das ist der Normalfall; Ausnahmen macht der einzelne Wertstrom — siehe Teil 2.",
            },
            {
              kind: "aside",
              text: "Was mir jetzt noch fehlt, sind die **Unterziele** — Schritt 7. Sie stehen im nächsten Teil, weil sie den Wertstrom-Ownern gehören. Danach folgt kein Werkzeug-Schritt mehr, sondern der Startschuss: die Beteiligten über die Ziele informieren und die Identifikation von Potenzialen freigeben.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Wertstrom-Owner",
      role: "value_stream_owner",
      question: "wer zeichnet in meinem Ausschnitt, und wofür?",
      stations: [
        {
          title: "Wofür jemand geradesteht",
          route: "/structure",
          body: [
            {
              kind: "paragraph",
              text: "Meine Detailseite hat vier Reiter: **Allgemein**, **Guardrails**, **Solutions**, **Verlauf**. Der Guardrail-Reiter erscheint nur mit Budgeting-Modul und Leserecht aufs Geld — oder wenn ich die Finance-Partei dieses Wertstroms bin.",
            },
            {
              kind: "list",
              items: [
                "**Finance Approver** — „Nimmt die Epics dieses Wertstroms als Finance-Partei ab.“ Er zeichnet die finanzielle Zuweisung, die Kalkulation und die Bestätigung des Impacts.",
                "**Portfolio Manager** — „Zuständiges Value Management Office.“ Erste Ansprechperson für den Prozess und für saubere Dokumentation aller Epics dieses Wertstroms. Wählbar sind **nur** Nutzer mit der Rolle `portfolio_manager`.",
              ],
            },
            {
              kind: "aside",
              text: "**Mit diesen beiden Benennungen ist der Freigabezyklus grundsätzlich gesichert** — das ist ihre eigentliche Funktion. Die Rollen-Platzhalter der Freigabe-Regeln lösen sich an ihnen zu konkreten Personen auf.",
            },
            {
              kind: "paragraph",
              text: "Gesichert wird mit **Änderungen speichern** (Plural). Ohne Schreibrecht steht an derselben Stelle eine reine Definitionsliste.",
            },
          ],
        },
        {
          title: "Freigaben je Reifegrad",
          route: "/structure",
          body: [
            {
              kind: "paragraph",
              text: "Weiter unten auf derselben Fläche: **Freigaben je Reifegrad** — „Wer nimmt jeden Reifegrad-Übergang (L1–L5) in diesem Wertstrom ab.“",
            },
            {
              kind: "paragraph",
              text: "Im Normalfall lasse ich das stehen. Wurden in den Workshops detaillierte Wünsche verabredet, öffne ich **Bearbeiten** und setze je Tor: **Abnahme erforderlich**, **Quorum** („alle müssen zustimmen“ oder „eine Zustimmung genügt“), **Rollen-Platzhalter** und **benannte Personen**.",
            },
            {
              kind: "paragraph",
              text: "**Speichern** — und die Regeln gelten **für alle Epics dieses Wertstroms**. Ein Herkunfts-Abzeichen an jeder Zeile sagt, woher die geltende Regel kommt: „Wertstrom-Regel“, „Tenant-Default“ oder „Standard“.",
            },
          ],
        },
        {
          title: "Die eigenen Guardrails",
          route: "/structure",
          body: [
            {
              kind: "paragraph",
              text: "Zu setzen sind unter **Ziele dieses Wertstroms** drei Felder: Business %, Enabler % und Portfolio-Limit €. Ihr Platzhalter ist das Wort, auf das es ankommt: **„geerbt“**. Ein leeres Feld ist keine Null — es heißt, dass die tenant-weite Vorgabe gilt.",
            },
            {
              kind: "paragraph",
              text: "Beim Aufbau lasse ich in aller Regel beides leer. Ein **eigenes, niedrigeres Portfolio-Limit** ist die Ausnahme und hat eine klare Konsequenz: dann müssen auch kleinere Epics durch das Top-Management. Für besonders kritische Wertströme ist genau das gewollt.",
            },
            {
              kind: "note",
              text: "**Eine Horizont-Achse gibt es hier nicht.** Die Domäne kennt einen Wertstrom-Override für sie, die Fläche bietet ihn nicht an — „Investment by Horizon“ wird ausschließlich tenant-weit gesetzt.",
            },
          ],
        },
        {
          title: "Das Unterziel",
          route: "/ziele",
          anchor: "goals-table",
          body: [
            {
              kind: "paragraph",
              text: "Stehen Kopfziel und Struktur, breche ich das Ziel herunter — gemeinsam mit den Business Ownern und dem Top-Management. **Ein Ziel je Wertstrom ist die saubere Aufteilung**; weiter herunter, auf ARTs oder Solutions, geht auch.",
            },
            {
              kind: "paragraph",
              text: "Der Weg: das **„+“** an der Zeile des Kopfziels („Unterziel hinzufügen“), oder im Drawer unter _Verknüpfungen_ der Abschnitt **Unterziele** mit **+ Neues Unterziel**. Es öffnet sich **derselbe Dialog wie beim Kopfziel**. Als Owner wähle ich die Wertstrom-Owner.",
            },
            {
              kind: "list",
              items: [
                "**Gewicht im Rollup des Elternziels (leer = 1)** — wie stark dieses Unterziel im Durchschnitt des Elternziels zählt.",
                "**Beitrag zum Elternziel — 1 {Einheit} = ▢ {Eltern-Einheit}** — der Umrechnungsfaktor. Leer heißt „kein Wertbeitrag“.",
              ],
            },
            {
              kind: "note",
              text: "**Zwei Faktoren, die man verwechselt.** Der hier verbindet **Ziel mit Ziel**. Es gibt einen zweiten, der **Ziel mit Epic-KPI** verbindet — er wird im KPI-Reiter des Epics gepflegt, unter „Wert (Umrechnungsfaktor)“.",
            },
            {
              kind: "paragraph",
              text: "Zuletzt die Verbindung zur Organisation: Drawer, Reiter **Verknüpfungen**, Abschnitt **Related work & Scope** — nicht „Related Work & Score“; einen Score gibt es dort nicht. Darin nimmt _Related work_ konkrete Arbeit auf (Epics, Features, PIs), und **Verantwortung · Value Streams & ARTs** ist die Stelle, an der Wertstrom und ART des Ziels eingetragen werden.",
            },
          ],
        },
      ],
    },

    {
      label: "Der Produkt-Manager",
      question: "wo steht mein Produkt, und was kostet es im Bestand?",
      stations: [
        {
          title: "Der Status",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "Meine Benennung steht auf der Solution-Detailseite im Reiter _Overview_ als **Produkt-Manager** — ein freies Personenfeld ohne Rollenbindung, weil Produktverantwortung nicht mit einer SAFe-Rolle zusammenfällt. Es ist keine Beschriftung: daran hängt unter anderem, dass ich **bei den Reifegrad-Abnahmen der Epics meiner Solution mitzeichne**.",
            },
            {
              kind: "paragraph",
              text: "Den **Status** ändere ich über die **Lebenszyklus-Leiste** — sie sitzt im Unterkopf der Detailseite und ist damit aus jedem Reiter erreichbar.",
            },
            { kind: "figure", figure: "solutionLifecycle" },
            {
              kind: "paragraph",
              text: "**Eine Kante ist ein Tor.** _Nach H1 befördern_ öffnet einen Dialog mit den vier Kriterien, die oben unter der Kante stehen — alle vier müssen bestätigt sein.",
            },
            {
              kind: "aside",
              text: "Das ist die Stelle, an der aus einem Anwärter ein Produkt wird — deshalb die einzige mit Rückfrage. H1.1 → H1.2 dagegen ist ein Klick ohne Dialog.",
            },
            {
              kind: "paragraph",
              text: "**Wo das im Betrieb passiert:** im Portfolio Review. Dort wird regelmäßig über die Solutions gesprochen, und dazu gehört die Frage, ob sich die Einordnung verschoben hat.",
            },
          ],
        },
        {
          title: "Die Run-Baseline",
          route: "/structure/solutions",
          body: [
            {
              kind: "paragraph",
              text: "Solutions, die bei der Aufnahme in Pulse kommen, haben in aller Regel schon einen laufenden Betrieb. Was es kostet, ihn am Laufen zu halten — _keep the lights on_ —, gehört als **Run the Business** hinterlegt.",
            },
            {
              kind: "paragraph",
              text: "Im Reiter _Overview_ stehen dazu drei Kacheln: **Grow · aktive Primär-Epics**, **Run · Betrieb p.a.** und das Verhältnis **Grow : Run**. Ist das Budgeting-Modul nicht aktiv, steht in der Run-Kachel „Budgeting-Modul nicht aktiv“ — die Zahl gehört diesem Modul, nicht der Struktur.",
            },
            {
              kind: "table",
              head: ["Art", "Was hineingehört"],
              rows: [
                ["Betrieb", "Lizenzen, Wartung, alles, was den Bestand hält"],
                ["ART-Epic-Budget", "der Rahmen für die Weiterentwicklung, den der ART verteilt"],
              ],
              caption: "Zwei Arten, eine Liste — und die Unterscheidung ist keine Formalie.",
            },
            {
              kind: "aside",
              text: "Sie zu trennen ist keine Buchhaltungsformalie: **sonst würde Veränderungsarbeit aus dem Betriebstopf bezahlt**, und vier Flächen sagten die Unwahrheit — die Grow-/Run-Kacheln, der Run-Anteil am Wertstrom, die Gliederung der PB-Liste und Guardrail 2.",
            },
          ],
        },
      ],
    },
  ],

  misconceptions: [
    {
      claim: "Es gibt fünf Horizonte.",
      why: "Vier Horizonte, **fünf Stationen**. H1 zerfällt in Investing und Extracting.",
    },
    {
      claim: "Ich bin Portfolio Owner.",
      why: "Die Rolle heißt `portfolio_manager`. „Portfolio Owner“ und „VMO“ sind keine Rollen.",
    },
    {
      claim: "Der Wertstrom hat einen Horizont-Guardrail.",
      why: "Nur Capacity und Portfolio-Limit. Die Horizont-Achse gibt es ausschließlich tenant-weit.",
    },
    {
      claim: "Beim Anlegen des ARTs setze ich den RTE.",
      why: "Der Dialog kennt nur Wertstrom und Name. Der RTE kommt auf der Detailseite.",
    },
    {
      claim: "Ein leeres Guardrail-Feld heißt null.",
      why: "Es heißt **geerbt** — die tenant-weite Vorgabe gilt.",
    },
    {
      claim: "Ein Ziel legt man einmal an, egal wo.",
      why: "Der Schnell-Dialog kann weder Owner noch Fortschrittsquelle. Für ein Kopfziel: der Drawer.",
    },
    {
      claim: "Der Umrechnungsfaktor verbindet Ziel und Epic.",
      why: "Der hier verbindet Ziel und **Elternziel**. Der zum Epic ist ein anderer.",
    },
    {
      claim: "Jeder ART bekommt seine eigene Kadenz.",
      why: "Er **tritt** einer Timeline **bei**. Eigene Kadenzen kosten die synchronisierte Umsetzung.",
    },
    {
      claim: "Was ich sehe, darf ich auch.",
      why: "„Standard anwenden…“ ist unter `timeline.manage` sichtbar, verlangt aber `pi.create` (RTE).",
    },
  ],

  who: [
    {
      step: "Ziel und Unterziel anlegen, Metrik pflegen",
      who: "Portfolio Manager / Admin; Wertstrom-Owner nur in seinem Wertstrom",
      capability: "target.manage",
    },
    { step: "Wertstrom anlegen", who: "Portfolio Manager", capability: "value_stream.create" },
    {
      step: "Finance Approver und Portfolio Manager setzen",
      who: "Portfolio Manager / Admin, Wertstrom-Owner",
      capability: "value_stream.update",
    },
    {
      step: "Freigaben je Reifegrad ändern",
      who: "Portfolio Manager / Admin, Wertstrom-Owner",
      capability: "epic.gate.approvers.configure",
    },
    { step: "ART anlegen, RTE setzen", who: "Portfolio Manager / Admin", capability: "art.create" },
    { step: "ART löschen", who: "nur Tenant-Admin", capability: "art.delete" },
    {
      step: "Solution anlegen, Status ändern",
      who: "Portfolio Manager / Admin — nicht der Wertstrom-Owner",
      capability: "solution.manage",
    },
    {
      step: "Solution bearbeiten (Status, ART, Beschreibung)",
      who: "der benannte Produkt-Manager — ohne weitere Rolle",
    },
    {
      step: "Tenant-weite Targets setzen",
      who: "Portfolio Manager / Admin",
      capability: "target.manage",
    },
    {
      step: "Timeline anlegen, einzelne PIs, ARTs beitreten",
      who: "Portfolio Manager / Admin",
      capability: "timeline.manage",
    },
    { step: "PI-Standard anwenden", who: "RTE / Admin", capability: "pi.create" },
    {
      step: "Run-the-Business-Positionen pflegen",
      who: "Wertstrom-Owner, Finance-Partei, Portfolio Manager / Admin",
      capability: "rtb_item.manage",
    },
  ],
};
