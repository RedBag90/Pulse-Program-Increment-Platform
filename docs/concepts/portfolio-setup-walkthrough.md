# Ein gelebter Prozess — ein Portfolio entsteht

Der Aufbau, dreimal erzählt: aus Sicht des **Portfolio Managers**, der das
Kopfziel setzt und die Organisation aufnimmt, des **Wertstrom-Owners**, der
seinen Ausschnitt scharf stellt, und des **Produkt-Managers**, der seine
Solution einordnet. Mit den Namen, die Pulse tatsächlich verwendet: Ziele,
Organisation, Status, Guardrails, Timelines.

Die fünf Schwesterdokumente beschreiben Abläufe **in** einem laufenden
Portfolio. Dieses hier beschreibt, was vorher passiert — und es ist der einzige
Ablauf, den man in aller Regel **einmal** durchläuft.

Elf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Mandant](tenant-onboarding-walkthrough.md) — wer hereinkommt und was er darf ·
[Aufbau](portfolio-setup-walkthrough.md) — woraus alles besteht ·
[Intake](epic-intake-walkthrough.md) — wie eine Idee hereinkommt ·
[Halbjahr](portfolio-cycle-walkthrough.md) — wie der Takt schlägt ·
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Lieferung](delivery-walkthrough.md) — was liefert und was blockiert ·
[Wirkung](benefit-walkthrough.md) — ob es etwas gebracht hat ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen, in dem sie
stattfinden, führt [Struktur](structure-walkthrough.md) als Flächenführung vor —
dieses Dokument erzählt, wie er entsteht.

## Die gemeinsame Mechanik

### Die Reihenfolge ist eine Abhängigkeit, keine Konvention

Der Aufbau sieht aus wie eine Checkliste und ist keine. Vier der sieben Schritte
setzen einen anderen voraus, und wer sich in der Reihenfolge irrt, muss zurück:

```
Kopfziel ──────────────────────────────────────┐
                                               │
Wertstrom ──┬── ART ──┬── Solution             ├── Unterziel
            │         │                        │   braucht Kopfziel
            │         └── Timeline beitreten   │   + Wertstrom + ART
            │
            └── Finance Approver · Portfolio Manager
                Freigaben je Reifegrad
                Capacity · Portfolio-Limit

Portfolio-Guardrails ── tenant-weit, jederzeit

Reihenfolge im Ablauf:
  1 Kopfziel · 2 Wertstroeme · 3 ARTs · 4 Solutions
  5 PI-Kadenz · 6 Guardrails · 7 Unterziele
```

Ein ART verlangt seinen Wertstrom im Anlege-Dialog. Eine Solution verlangt ihren
Wertstrom und bietet ARTs erst an, wenn er gewählt ist („Zuerst Value Stream…").
Eine Timeline hat keine ARTs zum Beitreten, bevor es ARTs gibt. Und ein
Unterziel kann seine Verantwortung erst zuordnen, wenn Wertströme und ARTs
stehen.

**Das Kopfziel ist die Ausnahme.** Es hängt an nichts und darf zuerst entstehen
— und das ist die Aussage des ganzen Ablaufs: erst wird verabredet, was erreicht
werden soll, dann wird die Organisation aufgenommen, die es erreichen soll.

### Vier Horizonte, fünf Stationen

Der häufigste Irrtum beim Aufbau, und einer, der sich später rächt. Pulse führt
**vier Horizonte** und **fünf Stationen**:

| Achse                   | Werte                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `HORIZONS` (4)          | H3 · R&D — H2 · Emerging — **H1 · Investing** — H0 · Decommissioning |
| `STATIONS` (5)          | h3 — h2 — **h1.1 · Investing** — **h1.2 · Extracting** — h0          |
| Solution-**Status** (4) | Emerging — Investing — Extracting — Decommissioning                  |

H1 zerfällt wirtschaftlich in zwei verschiedene Phasen: **ausbauen** gegen
**ernten**. Deshalb hat die Solution fünf wählbare Status, während die
Horizont-Achse vierwertig bleibt — `HORIZON_LABEL` kennt „Extracting" gar nicht,
weil Extracting kein eigener Horizont ist, sondern die zweite Hälfte von H1.

Der Satz, an dem man es sich merkt: **die Achse bleibt vierwertig, die Leiter
zeigt fünf Stufen.** Wer beim Aufbau „fünf Horizonte" denkt, sucht später
vergebens nach einem Guardrail-Feld für den fünften.

### Wer die drei sind

| Wer                   | Was ihm gehört                                                                | Recht                                                     |
| --------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Portfolio Manager** | Kopfziel, Wertströme, ARTs, tenant-weite Guardrails, Timelines                | `value_stream.create`, `target.manage`, `timeline.manage` |
| **Wertstrom-Owner**   | sein Wertstrom: Besetzung, Freigabe-Regeln, eigene Guardrails, sein Unterziel | `value_stream.update`, `epic.gate.approvers.configure`    |
| **Produkt-Manager**   | seine Solution: Status, Beschreibung, ART-Zuweisung, Run-Baseline             | Benennung am Feld — **ohne** eigene Rolle                 |

**Am Anfang ist der Portfolio Manager alle drei.** Beim allerersten Durchlauf
gibt es niemanden, den man fragen könnte: keine Wertstrom-Owner, keine
Produkt-Manager, keine Finance-Partei. Er trägt alles selbst ein und benennt die
anderen dabei. Ab dem zweiten Durchlauf — ein neuer Wertstrom, eine neue
Solution — läuft es so, wie es hier in drei Teilen steht.

Zwei Begriffe aus dem Sprachgebrauch haben in Pulse **keine Entsprechung**:
„Portfolio Owner" ist keine Rolle, und „VMO" ist keine mehr. Es gibt acht
Rollen; der `portfolio_manager` hat das VMO aufgesogen. Das Datenfeld am
Wertstrom heißt noch `vmoId`, das Feld auf der Fläche heißt **„Portfolio
Manager"** — mit dem Hilfstext „Zuständiges Value Management Office."

---

# 1 · Der Portfolio Manager

Meine Frage lautet: **woraus besteht dieses Portfolio, und wohin soll es?**

## Das Kopfziel

Ich komme aus dem Termin mit der Geschäftsleitung und habe ein Ziel. Ich gehe
auf **`/ziele`** — die Route ist deutsch, nicht `/goals`.

Es gibt **zwei** Wege, ein Ziel anzulegen, und sie können verschieden viel:

- der **Schnell-Dialog** aus dem globalen „+"-Menü (Gruppe _Strategie_, Eintrag
  „Ziel") — er fragt nur **Titel**, **Zeitraum** und **Beschreibung**;
- der **volle Drawer** über „+ Ziel" in der Tabelle — er trägt alles Übrige.

Der Schnell-Dialog hat **kein Owner-Feld und keine Fortschrittsquelle.** Wer mit
ihm anlegt, muss das Ziel danach ohnehin öffnen. Für ein Kopfziel lohnt sich
gleich der Drawer.

**Zeitraum.** Ein Umschalter mit zwei Stellungen: **Raster** (das kanonische
FY / H1·H2 / Q1–Q4 über den Perioden-Picker) oder **Individuell** (zwei
Datumsfelder, „Start" und „Ende"). Im Modus _Individuell_ sind beide Grenzen
Pflicht.

**Owner.** Ein Personenfeld über die Tenant-Nutzer, Platzhalter „— Kein Owner".
Ohne Rollenbindung: verantwortlich für dieses Ziel, nicht berechtigt zu etwas.

**Fortschrittsquelle.** Drei Werte, und die Wahl entscheidet, welche Felder
danach überhaupt erscheinen:

| Wert       | Label im UI         | Woraus der Fortschritt entsteht                                                        |
| ---------- | ------------------- | -------------------------------------------------------------------------------------- |
| `manual`   | **Manuell**         | ich pflege den Ist-Wert selbst                                                         |
| `rollup`   | **Aus Unterzielen** | gewichteter Durchschnitt der Kinder — **eigene Metrik wird ignoriert**                 |
| `kpi_tree` | **KPI-Baum**        | Blatt: Ist aus verknüpften Epic-KPIs (Δ × Faktor); Ast: kaskadiert über die Unterziele |

Zwei Dinge, die man wissen muss, bevor man wählt:

- Bei **„Aus Unterzielen"** rendert die Fläche den ganzen Metrik-Block gar nicht
  erst. Baseline, Target, Einheit — alles weg. Das ist richtig, überrascht aber,
  wenn man sie gerade eingetragen hatte.
- **„KPI-Baum" erscheint nur, wenn das Portfolio-Modul aktiv ist** (oder der
  Modus bereits gesetzt war). Ohne das Modul stehen faktisch zwei Optionen zur
  Wahl.

**Die Details.** Beim **Anlegen** liegen sie hinter einer Klappe namens
**„Erweitert"**; beim späteren Bearbeiten stehen dieselben Felder offen im
Reiter _Einstellungen_. Es gibt keinen Knopf „erweitern" — es ist ein
aufklappbarer Abschnitt, und nur beim ersten Mal.

Darin, in dieser Reihenfolge:

| Feld                  | Anmerkung                                                        |
| --------------------- | ---------------------------------------------------------------- |
| **Narrativ**          | die Beschreibung des Ziels — sie heißt hier nicht „Beschreibung" |
| **Metriktyp**         | Pflicht: Zahl · Prozent · Währung · Individuell                  |
| **Einheit (Label)**   | nur bei Zahl und Individuell                                     |
| **Nachkomma (0–6)**   |                                                                  |
| **Währung (ISO)**     | nur bei Metriktyp Währung                                        |
| **Baseline**          | der Ausgangswert                                                 |
| **Target (Zielwert)** |                                                                  |
| **Aktuell**           | nur bei Fortschrittsquelle Manuell                               |

Bei Metriktyp **Prozent** belegt die Fläche leere Baseline/Target mit 0 und 100
vor. „Speichern" — das Kopfziel steht.

## Die Wertströme

Zwischen dem Ziel und dieser Zeile liegt die eigentliche Arbeit, und sie
passiert **nicht** im Werkzeug: Workshops und Interviews mit den Bereichen. Drei
Dinge nehme ich dabei auf — welche **Solutions** genutzt werden, welche
**Personengruppen** sich um sie kümmern (und wer Produkt-Manager ist), und wie
sich das in **Wertströme** clustert.

Was ich aufnehme, ist mal die Ist-, mal die Soll-Organisation des Programms.
Das ist eine Entscheidung mit langem Schatten: **die gesamte Arbeitsstruktur
richtet sich danach.** Budgets, Freigaben, Guardrails und die Zuordnung jedes
Epics hängen an dieser Gliederung.

Im Werkzeug ist es dann kurz. Die Struktur liegt **nicht** in Reitern, sondern
als drei Einträge in der Seitenleiste — **Organisation**, **Solutions**,
**Timelines** — und `/structure` ist ein Baum mit Detailfläche daneben. Das Wort
„Wertströme" gibt es dort nur als **Filter-Chip** über dem Baum, neben „Alle",
„ARTs" und „Solutions".

In der Kopfzeile des Baums sitzt der Knopf **„Wertstrom"** (mit Plus-Icon; in
der vollen Variante „Wertstrom anlegen"). Der Dialog fragt **Name** und
**Beschreibung**, Schaltfläche **„Anlegen"**. Mehr nicht — alles Weitere gehört
auf die Detailseite und damit in Teil 2.

Ich wiederhole das für jeden identifizierten Wertstrom.

## Die ARTs

ARTs entstehen über das globale **„+"** oben rechts. Die Einträge liegen dort in
Gruppen: _Strategie_ trägt „Ziel", _Portfolio_ trägt **„Value Stream"**,
**„ART"** und **„Solution"**, _Initiative_ trägt „Epic" und „Feature".

> **Hier stockte der Aufbau bis September 2026.** `art.create` und
> `art.update` trugen nur `TENANT_ADMIN` — der Portfolio Manager konnte
> Wertströme, Solutions, Ziele, Guardrails und Timelines anlegen, **ARTs aber
> nicht**, und musste für diesen einen Schritt jemanden holen.
>
> **Das ist behoben.** Ein ART ist Portfolio-Struktur, kein Admin-Thema: wer
> Wertströme anlegt, legt auch die Trains darin an. `art.create` und
> `art.update` liegen jetzt beim `portfolio_manager`. **`art.delete` bleibt
> beim Admin** — ein ART trägt Solutions, PIs und Epics, und sein Verlust ist
> nicht die Umkehrung des Anlegens.
>
> Für Mandanten, die ihre Rollen **selbst angepasst** haben, gilt das nicht
> automatisch: die gespeicherte Rechte-Zusammenstellung schlägt den Code-Default
> vollständig, sobald sie überhaupt Zeilen hat. Dort trägt man das Recht unter
> _Admin → Rollen_ nach.

**Der ART-Dialog ist englisch** — als einziger in dieser Kette. Titel „Create
Agile Release Train", Felder **„Value Stream \*"** und **„Name \*"**, Knöpfe
„Cancel" und „Create ART". Kein Beschreibungsfeld, **kein RTE-Feld**, keine
Kadenz. Ein Hinweis darunter sagt, warum: „Die PI-Kadenz wird später (mit dem
Drumbeat-Modul) pro ART zugewiesen."

Den **RTE** trage ich danach auf der ART-Detailseite im Reiter _Allgemein_ ein
— das Feld heißt dort **„RTE (Release Train Engineer)"**, Platzhalter
„— Niemand —", gesichert mit **„Änderungen speichern"**. Wählbar sind nur
Nutzer mit der Rolle RTE; gibt es keine, sagt die Fläche das, statt eine leere
Liste zu zeigen.

Der RTE verantwortet den Prozess **innerhalb** seines ARTs: dass die PIs
eingehalten und die Features eingeplant werden.

## Die Solutions

Dieselbe „+"-Kachel, Eintrag „Solution". Dialog **„Neue Solution"**: **Name \***,
**Beschreibung**, **Value Stream \***, **ART** (kaskadiert — vor der
Wertstromwahl steht dort „Zuerst Value Stream…", danach wahlweise „— kein ART —")
und **Status \***.

**Das Feld heißt „Status", nicht „Horizont"** — obwohl überall sonst vom
Horizont die Rede ist. Fünf Werte, alle englisch:

| Status              | Bedeutung                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| **Emerging**        | Anwärter, für den gerade ein Pilot oder MVP entsteht                     |
| **Investing**       | der Pilot hat getragen — ab hier eine echte Solution, kein Anwärter mehr |
| **Extracting**      | wird nicht mehr groß weiterentwickelt, sondern nur noch gepflegt         |
| **Decommissioning** | im Phase-out                                                             |

Der Übergang **Emerging → Investing** ist der einzige, der ein Tor hat — er ist
die Stelle, an der aus einem Anwärter ein Produkt wird. Alles Weitere dazu steht
in Teil 3.

## Die PI-Kadenz

Damit die ARTs einen sauberen Takt haben, brauchen sie eine Timeline: sie
definiert die Dauer der Umsetzungsphasen. Seitenleiste **Struktur → Timelines**,
Schaltfläche **„Neue Timeline"** (nicht „+ Timeline"), Dialog mit einem Feld
**Name**.

Im Detail-Bereich dann, in dieser Reihenfolge:

1. **Program Increments** — entweder einzeln über **„Neues PI"**, oder in einem
   Zug über **„Standard anwenden…"**. Der Leertext sagt beides an.
2. **ART hinzufügen** — je ART ein **„+ ART beitreten"**. Danach stehen sie
   unter **„Verknüpfte ARTs"**.

> **Die beiden PI-Wege hängen an verschiedenen Rechten.** Sichtbar sind beide
> Knöpfe unter demselben Flag (`timeline.manage`, also Portfolio Manager und
> Admin). „Neues PI" prüft ebenfalls `timeline.manage` — **„Standard
> anwenden…" aber `pi.create`, und das trägt nur der RTE** (Admins ohnehin).
> Ein Portfolio Manager sieht den Knopf deshalb und läuft in eine Absage. Wer
> mit einem Standard startet, holt dafür den RTE dazu oder legt die PIs
> einzeln an.

**Eine Standard-Kadenz für alle ist die Empfehlung.** Eine eigene Kadenz je ART
ist möglich, kostet aber genau das, wofür der Takt da ist: die synchronisierte
Umsetzung. Ein ART trägt deshalb auch keine eigene Kadenz mehr — er **tritt**
einer Timeline **bei**; auf seiner Seite steht sie als Feld mit Link.

## Die Guardrails

Hierfür braucht es ein Alignment mit dem Portfolio-Sponsor, typischerweise dem
oberen Management; oft gibt es einen Rahmen, den man als Richtwert nimmt.

Im Werkzeug: **`/portfolio/guardrails`**. Die Fläche zeigt oben den Ist-Mix und
unten unter „Soll-Mix (Targets)" das Formular.

**Es sind vier Guardrails — aber nur drei werden gemessen.**

| #   | Achse                         | Ist-Karte | Zielfelder                         |
| --- | ----------------------------- | --------- | ---------------------------------- |
| 1   | **Investment by Horizon**     | ja        | fünf Prozentfelder, Σ = 100        |
| 2   | **Capacity Allocation**       | ja        | Business % · Enabler %, Σ = 100    |
| 3   | **Portfolio-Limit**           | **nein**  | „Schwelle" in €                    |
| 4   | **Business-Owner-Engagement** | ja        | Abdeckung % · Reaktionszeit (Tage) |

Guardrail 3 hat keine eigene Messung, nur einen Wert — er ist eine Grenze, kein
Mix. Sein Hilfstext sagt in einem Satz, was er tut: **„Ab dieser Größe
entscheidet das Portfolio. Darunter finanziert der ART."**

Die Horizont-Verteilung trägt **fünf** Felder, nicht vier — hier zahlt sich
aus, die Stationen verstanden zu haben:

```
H3 · R&D          ▢ %
H2 · Emerging     ▢ %
H1.1 · Investing  ▢ %      ← H1, erste Hälfte
H1.2 · Extracting ▢ %      ← H1, zweite Hälfte
H0 · Decommissioning ▢ %
                  Σ 100 ✓
```

Das ist der Grund, warum es sie überhaupt gibt: ohne sie liefe alles Geld in die
laufenden Solutions, und für neue Ideen bliebe nichts. Die Summe muss 100
ergeben (Toleranz 0,5), sonst steht statt des Häkchens „— erwartet 100".
Schaltfläche **„Targets speichern"**.

Capacity Allocation und Portfolio-Limit setze ich hier **für alle Wertströme**.
Das ist der Normalfall; Ausnahmen macht der einzelne Wertstrom — siehe Teil 2.

## Der Startschuss

Damit ist die Dokumentation des Setups fertig. Was jetzt fehlt, steht nicht mehr
im Werkzeug: die Beteiligten über die Ziele informieren und die Identifikation
von Potenzialen freigeben. Wie eine Idee von dort aus ein Vorhaben wird, erzählt
[Intake](epic-intake-walkthrough.md).

---

# 2 · Der Wertstrom-Owner

Meine Frage lautet: **wer zeichnet in meinem Ausschnitt, und wofür?**

## Wofür jemand geradesteht

Meine Detailseite (`/structure/value-stream/…`) hat vier Reiter: **Allgemein**,
**Guardrails**, **Solutions**, **Verlauf**. Der Guardrail-Reiter erscheint nur
mit Budgeting-Modul und Leserecht aufs Geld — oder wenn ich die Finance-Partei
dieses Wertstroms bin.

In _Allgemein_ stehen zwei Personenfelder, und beide sind mehr als eine
Beschriftung:

- **Finance Approver** — „Nimmt die Epics dieses Wertstroms als Finance-Partei
  ab." Er zeichnet die finanzielle Zuweisung, die Kalkulation und die
  Bestätigung des Impacts.
- **Portfolio Manager** — „Zuständiges Value Management Office." Erste
  Ansprechperson für den Prozess und für saubere Dokumentation aller Epics
  dieses Wertstroms. **Wählbar sind nur Nutzer mit der Rolle
  `portfolio_manager`**; gibt es keine, sagt die Fläche „Keine Nutzer mit
  Portfolio-Manager-Rolle im Mandanten."

Gesichert wird mit **„Änderungen speichern"** (Plural). Ohne Schreibrecht steht
an derselben Stelle eine reine Definitionsliste.

**Mit diesen beiden Benennungen ist der Freigabezyklus grundsätzlich gesichert**
— das ist ihre eigentliche Funktion. Die Rollen-Platzhalter der Freigabe-Regeln
lösen sich an ihnen zu konkreten Personen auf.

## Freigaben je Reifegrad

Auf derselben Fläche, weiter unten: **„Freigaben je Reifegrad"** — „Wer nimmt
jeden Reifegrad-Übergang (L1–L5) in diesem Wertstrom ab."

Im Normalfall lasse ich das stehen. Wurden in den Workshops detaillierte Wünsche
zu Freigaben verabredet, öffne ich **„Bearbeiten"** und setze je Tor:

| Feld                     | Bedeutung                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **Abnahme erforderlich** | ob das Tor überhaupt gezeichnet werden muss                                           |
| **Quorum**               | „alle müssen zustimmen" oder „eine Zustimmung genügt"                                 |
| **Rollen-Platzhalter**   | VMO, Finance, Epic-Owner — sie treffen beim Antrag automatisch die hinterlegte Person |
| **Benannte Personen**    | zusätzlich, namentlich                                                                |

**„Speichern"** — und die Regeln gelten **für alle Epics dieses Wertstroms**.
Ein Herkunfts-Abzeichen an jeder Zeile sagt, woher die geltende Regel kommt:
„Wertstrom-Regel", „Tenant-Default" oder „Standard". Die Kaskade ist Wertstrom →
Tenant → Code-Vorgabe.

## Die eigenen Guardrails

Im Reiter _Guardrails_ stehen **Guardrail 2 · Capacity Allocation** mit
Ist-Tabelle und, sobald ein Limit gesetzt ist, **Guardrail 3 · Aufteilung bei
einem Limit von …** als Vorschau, wie die anstehenden Epics fallen würden.

Zu setzen sind unter „Ziele dieses Wertstroms" drei Felder: **Business** %,
**Enabler** % und **Portfolio-Limit** €. Ihr Platzhalter ist das Wort, auf das
es ankommt: **„geerbt"**. Ein leeres Feld ist keine Null — es heißt, dass die
tenant-weite Vorgabe gilt.

Beim Aufbau lasse ich in aller Regel beides leer. Ein **eigenes, niedrigeres
Portfolio-Limit** ist die Ausnahme und hat eine klare Konsequenz: dann müssen
auch kleinere Epics durch das Top-Management. Für besonders kritische oder
strategisch wichtige Wertströme ist genau das gewollt.

**Eine Horizont-Achse gibt es hier nicht.** Die Domäne kennt einen
Wertstrom-Override für sie, die Fläche bietet ihn nicht an; „Investment by
Horizon" wird ausschließlich tenant-weit gesetzt.

## Das Unterziel

Stehen Kopfziel und Struktur, breche ich das Ziel herunter — gemeinsam mit den
Business Ownern und dem Top-Management. **Ein Ziel je Wertstrom ist die
saubere Aufteilung**; weiter herunter, auf ARTs oder Solutions, geht auch.

Der Weg: das **„+"** an der Zeile des Kopfziels („Unterziel hinzufügen"), oder
im Drawer unter _Verknüpfungen_ der Abschnitt **„Unterziele"** mit
**„+ Neues Unterziel"**. Daneben liegt „Bestehendes Ziel verbinden" — für ein
Ziel, das es schon gibt.

Es öffnet sich **derselbe Dialog wie beim Kopfziel**. Als Owner wähle ich die
Wertstrom-Owner. Zwei Felder kommen hinzu, die es oben nicht gab:

- **„Gewicht im Rollup des Elternziels (leer = 1)"** — wie stark dieses
  Unterziel im Durchschnitt des Elternziels zählt.
- **„Beitrag zum Elternziel — 1 {Einheit} = ▢ {Eltern-Einheit}"** — der
  **Umrechnungsfaktor**. Er beantwortet: wie viel der Eltern-Einheit trägt eine
  Einheit dieses Ziels bei, wenn ich seine KPI bewege? Leer heißt „kein
  Wertbeitrag".

> **Zwei Faktoren, die man verwechselt.** Der hier heißt
> `parentUnitPerChildUnit` und verbindet **Ziel mit Ziel**. Es gibt einen
> zweiten, `conversionFactor`, der **Ziel mit Epic-KPI** verbindet — er wird
> nicht hier gepflegt, sondern im KPI-Reiter des Epics unter „Wert
> (Umrechnungsfaktor)". Der Drawer sagt es in einem Satz: „KPI + Faktor werden
> im Epic-KPI-Bereich je Ziel definiert."

Zuletzt die Verbindung zur Organisation. Im Drawer, Reiter **„Verknüpfungen"**,
Abschnitt **„Related work & Scope"** — nicht „Related Work & Score"; einen Score
gibt es dort nicht. Darin zwei Dinge, die man auseinanderhalten muss:

| Unterabschnitt                           | Wofür                                              |
| ---------------------------------------- | -------------------------------------------------- |
| **Related work**                         | konkrete Arbeit: Epics, Features, PIs              |
| **Verantwortung · Value Streams & ARTs** | **hier** trage ich Wertstrom und ART des Ziels ein |

Beide Picker sind modul-abhängig: der Wertstrom-Picker am Portfolio-Modul, der
ART-Picker am Programm-Modul.

---

# 3 · Der Produkt-Manager

Meine Frage lautet: **wo steht mein Produkt, und was kostet es im Bestand?**

## Der Status

Meine Benennung steht auf der Solution-Detailseite im Reiter _Overview_ als
**„Produkt-Manager"** — ein freies Personenfeld ohne Rollenbindung, weil
Produktverantwortung nicht mit einer SAFe-Rolle zusammenfällt. Ist niemand
benannt, steht dort „Nicht zugewiesen" und ein bernsteinfarbener Hinweis.

Es ist keine Beschriftung: daran hängt unter anderem, dass ich **bei den
Reifegrad-Abnahmen der Epics meiner Solution mitzeichne**.

Den **Status** ändere ich über die **Lebenszyklus-Leiste** — sie sitzt im
Unterkopf der Detailseite und ist damit aus jedem Reiter erreichbar. Vier
Stufen, in dieser Beschriftung:

```
H2 · Emerging → H1.1 · Investing → H1.2 · Extracting → H0 · Decommissioning
```

Darunter stehen nur die **erlaubten** Übergänge als Schaltflächen, vorwärts wie
rückwärts: „Auf Ernten umstellen (H1.2)", „Wieder investieren (H1.1)",
„Stilllegen (H0)", „Zurück zu H2".

**In H3 gibt es keine Solution** (ADR-0020): dort wird geforscht, und ob daraus
je ein Produkt wird, ist offen. Die Leiter beginnt deshalb bei _Emerging_, und
ein Anwärter, der sich nicht bewährt, wird geordnet stillgelegt statt in eine
Forschungsphase zurückgeschoben, die es als Solution-Zustand nicht mehr gibt.
Ein R&D-**Vorhaben** trägt seinen Horizont am Epic — H3 bleibt eine gültige
Guardrail-Bahn, nur ohne Produkt darin.

**Eine Kante ist ein Tor.** `Emerging → Investing` heißt **„Nach H1
befördern"** und öffnet einen Dialog mit vier Kriterien, die zu bestätigen sind:

- Benefit-Hypothese durch Marktdaten validiert
- Run-Baseline stabil / prognostizierbar
- Ziel-Value-Stream & ART zugewiesen
- Wirtschaftlich tragfähig (LTV / CAC)

Das ist die Stelle, an der aus einem Anwärter ein Produkt wird — deshalb ist sie
die einzige mit Rückfrage. `H1.1 → H1.2` dagegen ist ein Klick ohne Dialog.

**Wo das im Betrieb passiert:** im **Portfolio Review**. Dort wird regelmäßig
über die Solutions gesprochen, und dazu gehört die Frage, ob sich die Einordnung
verschoben hat. Hat sie das, setze ich sie hier nach.

## Die Run-Baseline

Solutions, die bei der Aufnahme in Pulse kommen, haben in aller Regel schon
einen laufenden Betrieb. Was es kostet, ihn am Laufen zu halten — _keep the
lights on_ —, gehört als **Run the Business** hinterlegt.

Im Reiter _Overview_ stehen dazu drei Kacheln: **„Grow · aktive
Primär-Epics"**, **„Run · Betrieb p.a."** und das Verhältnis **„Grow : Run"**.
Ist das Budgeting-Modul nicht aktiv, steht in der Run-Kachel „Budgeting-Modul
nicht aktiv" — die Zahl gehört diesem Modul, nicht der Struktur.

Der Abschnitt **„Run the Business"** darunter nimmt die Positionen auf:
**„+ Position hinzufügen"**, je Zeile Position · Periode · Betrag · p. a. Die
Periode ist monatlich, halbjährlich oder jährlich; Pulse rechnet daraus beides
aus — was es im Jahr kostet und was davon in eine Budget-Kachel geht.

Und die Unterscheidung, auf die es ankommt — **zwei Arten, eine Liste**:

| Art          | Label im UI         | Was hineingehört                                           |
| ------------ | ------------------- | ---------------------------------------------------------- |
| `run`        | **Betrieb**         | Lizenzen, Wartung, alles, was den Bestand hält             |
| `art_change` | **ART-Epic-Budget** | der Rahmen für die Weiterentwicklung, den der ART verteilt |

Sie zu trennen ist keine Buchhaltungsformalie: **sonst würde Veränderungsarbeit
aus dem Betriebstopf bezahlt**, und vier Flächen sagten die Unwahrheit — diese
Grow-/Run-Kacheln, der Run-Anteil am Wertstrom, die Gliederung der PB-Liste und
Guardrail 2.

Wie dieser Rahmen zu Geld wird, erzählt
[ART-Budget](art-epic-budget-walkthrough.md).

---

## Die Nähte

**Zum Epic.** Das Portfolio-Limit — Guardrail 3, tenant-weit oder je Wertstrom —
entscheidet, ob ein Vorhaben Portfolio- oder ART-Sache wird. Die Freigabe-Regeln
des Wertstroms entscheiden, wer seine Tore zeichnet. Beides steht, bevor das
erste Epic angelegt ist, und beides wirkt auf jedes.

**Zum Budget.** Die Run-the-Business-Positionen der Solutions und die
ART-Epic-Budgets der ARTs sind die Bedarfe, mit denen die erste Budget-Kachel
rechnet. Sie entstehen hier, nicht dort.

**Zum PI.** Die Timeline trägt den PI-Standard; die ARTs treten ihr bei. Ohne
diesen Schritt hat ein ART keinen Takt.

**Zum Ziel.** Ein Unterziel ohne Eintrag unter „Verantwortung · Value Streams &
ARTs" hängt in der Luft: es misst etwas, das keinem Ausschnitt der Organisation
zugeordnet ist.

## Sätze, die naheliegen und nicht stimmen

| Satz                                             | Warum er nicht stimmt                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| „Es gibt fünf Horizonte."                        | Vier Horizonte, **fünf Stationen**. H1 zerfällt in Investing und Extracting.                                |
| „Ich bin Portfolio Owner."                       | Die Rolle heißt `portfolio_manager`. „Portfolio Owner" und „VMO" sind keine Rollen.                         |
| „Der Wertstrom hat einen Horizont-Guardrail."    | Nur Capacity und Portfolio-Limit. Die Horizont-Achse gibt es ausschließlich tenant-weit.                    |
| „Beim Anlegen des ARTs setze ich den RTE."       | Der Dialog kennt nur Wertstrom und Name. Der RTE kommt auf der Detailseite.                                 |
| „Ein leeres Guardrail-Feld heißt null."          | Es heißt **geerbt** — die tenant-weite Vorgabe gilt.                                                        |
| „Ein Ziel legt man einmal an, egal wo."          | Der Schnell-Dialog kann weder Owner noch Fortschrittsquelle. Für ein Kopfziel: der Drawer.                  |
| „Der Umrechnungsfaktor verbindet Ziel und Epic." | Der hier verbindet Ziel und **Elternziel**. Der zum Epic ist ein anderer, im KPI-Reiter.                    |
| „Jeder ART bekommt seine eigene Kadenz."         | Er **tritt** einer Timeline **bei**. Eigene Kadenzen kosten die synchronisierte Umsetzung.                  |
| „ARTs legt nur der Admin an."                    | Nicht mehr: `art.create` und `art.update` liegen beim Portfolio Manager. Nur `art.delete` blieb beim Admin. |
| „Was ich sehe, darf ich auch."                   | „Standard anwenden…" ist unter `timeline.manage` sichtbar, verlangt aber `pi.create` (RTE).                 |

## Wer welchen Schritt macht

| Schritt                                         | Wer                                                                | Recht                           |
| ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| Ziel und Unterziel anlegen, Metrik pflegen      | Portfolio Manager / Admin; Wertstrom-Owner nur in seinem Wertstrom | `target.manage`                 |
| Wertstrom anlegen                               | Portfolio Manager / Admin                                          | `value_stream.create`           |
| Finance Approver und Portfolio Manager setzen   | Portfolio Manager / Admin, Wertstrom-Owner                         | `value_stream.update`           |
| Freigaben je Reifegrad ändern                   | Portfolio Manager / Admin                                          | `epic.gate.approvers.configure` |
| ART anlegen, RTE setzen                         | Portfolio Manager / Admin                                          | `art.create`, `art.update`      |
| ART löschen                                     | **nur Tenant-Admin**                                               | `art.delete`                    |
| Solution anlegen, Status ändern                 | Portfolio Manager / Admin — **nicht** der Wertstrom-Owner          | `solution.manage`               |
| Solution bearbeiten (Status, ART, Beschreibung) | **der benannte Produkt-Manager** — ohne weitere Rolle              | Benennung am Feld               |
| Tenant-weite Guardrail-Targets setzen           | Portfolio Manager / Admin                                          | `target.manage`                 |
| Wertstrom-Targets setzen (Capacity, Limit)      | Portfolio Manager / Admin, Wertstrom-Owner (scoped)                | `target.manage`                 |
| Timeline anlegen, einzelne PIs, ARTs beitreten  | Portfolio Manager / Admin                                          | `timeline.manage`               |
| **PI-Standard anwenden**                        | **RTE** / Admin                                                    | `pi.create`                     |
| Run-the-Business-Positionen pflegen             | Wertstrom-Owner, Finance-Partei, Portfolio Manager / Admin         | `rtb_item.manage` (+ Seam)      |

## Nachschlagepunkte im Code

| Aussage                                                  | Quelle                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Vier Horizonte, fünf Stationen                           | `src/modules/work/domain/portfolio-guardrails.ts` (`HORIZONS`, `STATIONS`)              |
| Solution-Status, Übergänge, Beförderungs-Kriterien       | `src/modules/work/domain/solution.ts`                                                   |
| Die Lebenszyklus-Leiste                                  | `src/modules/work/features/portfolio/components/solutions/solution-lifecycle-bar.tsx`   |
| Die vier Guardrail-Achsen und ihre Prüfung               | `src/modules/work/domain/portfolio-guardrails.ts` (`validateGuardrailTargets`)          |
| Kaskade Wertstrom → Tenant → Code-Vorgabe                | `src/modules/work/domain/portfolio-guardrails.ts` (`resolveGuardrailTargets`)           |
| Die fünf Horizont-Zielfelder                             | `src/modules/work/features/portfolio/components/guardrail-targets-form.tsx`             |
| Wertstrom-Targets (nur Capacity + Limit)                 | `src/modules/work/features/portfolio/actions/guardrail-targets.ts`                      |
| Zeitraum-Umschalter Raster / Individuell                 | `src/modules/core/goals/features/components/goal-period-field.tsx`                      |
| Fortschrittsquelle und ihre drei Werte                   | `src/modules/core/goals/domain/goal-progress-mode.ts`                                   |
| Metriktypen und ihre Labels                              | `src/modules/core/goals/domain/goal-metric.ts`                                          |
| Ziel-Drawer: Erweitert, Verknüpfungen, Umrechnungsfaktor | `src/modules/core/goals/features/components/ziele-edit-drawer.tsx`                      |
| Der Schnell-Dialog aus dem „+"-Menü                      | `src/modules/core/goals/features/components/create-goal-dialog.tsx`                     |
| Einträge und Gruppen des „+"-Menüs                       | `src/features/create/registry.ts`                                                       |
| Wertstrom anlegen                                        | `src/modules/core/org/features/value-stream/components/create-value-stream-dialog.tsx`  |
| Finance Approver und Portfolio Manager (`vmoId`)         | `src/modules/core/org/features/capacity/components/value-stream-overview-form.tsx`      |
| Freigaben je Reifegrad, Herkunft der Regel               | `src/modules/work/features/portfolio/components/gate-approver-rules-section.tsx`        |
| Auflösung der Rollen-Platzhalter zu Personen             | `src/modules/work/domain/gate-policy.ts`                                                |
| ART anlegen (englisch, kadenz-frei)                      | `src/modules/core/org/features/art/components/create-art-dialog.tsx`                    |
| RTE am ART                                               | `src/modules/core/org/features/capacity/components/art-overview-form.tsx`               |
| Solution anlegen, Feld „Status"                          | `src/modules/work/features/portfolio/components/solutions/create-solution-dialog.tsx`   |
| Produkt-Manager als Feld und als Recht                   | `src/modules/work/features/portfolio/components/solutions/solution-product-manager.tsx` |
| Timelines, PIs, ART-Beitritt                             | `src/modules/drumbeat/features/cadence/components/timeline-detail-pane.tsx`             |
| Zwei Arten einer Run-Position                            | `src/modules/budgeting/domain/rtb-kind.ts`                                              |
| Run the Business am Knoten                               | `src/modules/budgeting/features/components/rtb/rtb-section.tsx`                         |
| Der Struktur-Baum und seine Routen                       | `src/modules/core/org/server/views/structure-page.ts`                                   |
| Rollensatz und Labels                                    | `src/modules/core/kernel/domain/roles.ts`                                               |
| Was welche Rolle darf                                    | `src/server/auth/policies/index.ts`                                                     |
| PI-Anlage über die Timeline (`timeline.manage`)          | `src/modules/drumbeat/features/cadence/actions/pi.ts`                                   |
| PI-Standard anwenden (`pi.create`)                       | `src/modules/drumbeat/features/cadence/actions/pi-standard.ts`                          |
| Ziele-Actions hängen an `target.manage`                  | `src/modules/core/goals/features/actions/ziele.ts`                                      |
