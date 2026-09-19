# Die Geldfläche nach Prozess und Eigentümer — Spec

> Status: **Spec / zur Umsetzung** · Erstellt 2026-09-19
>
> Fünfte Spec der Reihe, unmittelbare Folge von
> [art-budget-consolidation.md](art-budget-consolidation.md). Die Zusammenlegung
> hat die zwei Geldflächen zu einer gemacht; diese Spec schneidet sie **neu** —
> nicht nach Geldsorte, sondern nach dem, was man gerade tut und wem es gehört.
>
> Wireframe mit echten Zahlen (Produktion · Large Test Corp, 2026-H2):
> https://claude.ai/code/artifact/58916a8f-d905-4fd4-8ee1-8b3049d444ce

## Anlass

Nach der Zusammenlegung wurden acht Container-Stile auf einen gebracht. Das
Urteil darüber war eindeutig:

> „Das Ergebnis gefällt mir überhaupt nicht. Darüber hinaus sind in Run the
> Business Navigationskacheln mit Eingabekacheln gemischt. Das verwirrt, da
> diese sich nicht wirklich unterscheiden und ich erst den ganzen Text lesen
> muss, um ihn zu verstehen."

Der Befund trifft zu. Die Vereinheitlichung hat auch den Unterschied zwischen
_hier tue ich etwas_ und _hier gehe ich woandershin_ getilgt — vorher waren die
Kacheln unterschiedlich schlecht, danach gleich. Das ist keine Gliederung.

Die tragende Frage kam danach: **welcher Prozessschritt gehört zu welchem
Inhalt.** §1 beantwortet sie; alles Weitere folgt daraus.

---

## 1 · Analyse: die Zuordnung

Der gelebte Prozess hat vier Schritte (`domain/art-funding-phases.ts`), **zwei
davon passieren auf dieser Seite**:

| #   | Schritt                | Handelnder                                   | Wo                   |
| --- | ---------------------- | -------------------------------------------- | -------------------- |
| 1   | ART-Rahmen anlegen     | Wertstrom-Owner                              | **hier**             |
| 2   | Auf der PB-Liste       | Kachel (Finance)                             | `/budgeting/periods` |
| 3   | Zuspruch               | Kachel (Finance)                             | `/budgeting/periods` |
| 4a  | Zuspruch **aufteilen** | **Wertstrom**-Owner                          | **hier**             |
| 4b  | Rahmen **verteilen**   | **ART** — VS-Owner, Finance, Produkt-Manager | **hier**             |

Schritt 4 wechselt **mitten im Schritt** den Handelnden, von `value_stream` auf
`art` (REQ-8 der Konsolidierungs-Spec). **Das ist die Naht, an der die Fläche zu
schneiden ist.**

### Jeder Block, sein Schritt, seine Art

| Block                              | Schritt         | Art        | Zeitbezug          |
| ---------------------------------- | --------------- | ---------- | ------------------ |
| Betriebspositionen (beide Gruppen) | **1**           | Eingabe    | **zeitlos**        |
| Zuspruch aufteilen                 | **4a**          | Eingabe    | Halbjahr           |
| Rahmen je ART                      | Wegweiser zu 4b | Navigation | Halbjahr           |
| ART-Epics finanzieren              | **4b**          | Eingabe    | Halbjahr           |
| Was sich verschieben ließe         | —               | Auskunft   | Halbjahr           |
| Matrix „Zugeteilt je ART"          | —               | Auskunft   | **alle Halbjahre** |
| Deckung · Zustandsstaffel · Epics  | —               | Auskunft   | Halbjahr           |
| Anmerkungen zur Datenlage          | —               | Auskunft   | **gemischt**       |

### Drei Befunde

1. **Geschnitten nach Geldsorte, nicht nach Schritt.** „Run the Business" heißt
   nach einer Geldsorte und enthält Schritt 1, Schritt 4a, einen Wegweiser zu
   4b, Schritt 4b und zwei Blöcke ohne Schritt — ununterscheidbar untereinander.
2. **Drei Zeitbezüge unter einem Halbjahr-Umschalter.** „Betriebspositionen"
   ändert sich beim Umschalten **nicht**, alles darunter springt.
3. **Kein Block ist reine Eingabe.** Alle drei Schreibflächen sind Tabellen, die
   zuerst auskunften — der mechanische Grund für „erst den ganzen Text lesen".

---

## 2 · Zielbild

### 2.1 · Fünf Reiter in zwei Gruppen

```
WERTSTROM              ARTS
  Einrichten             Materials & Energy      126.500 €
  Dieses Halbjahr        Plant Efficiency (OEE)   58.750 €
  Nachsehen
  Budget-KPIs
```

| Reiter              | Inhalt                                                                                    | Umschalter |
| ------------------- | ----------------------------------------------------------------------------------------- | ---------- |
| **Einrichten**      | Betriebspositionen und ART-Rahmen — Stammdaten, Schritt 1                                 | **nein**   |
| **Dieses Halbjahr** | Ergebnis der Kachel (Auskunft) + **Schritt 4a · Zuspruch aufteilen**                      | ja         |
| **Nachsehen**       | Matrix über alle Halbjahre · Auslastung                                                   | ja         |
| **Budget-KPIs**     | „Wofür · eingeplant" für den Wertstrom **und je ART**                                     | ja         |
| **je ART**          | Business Case (Herkunft) · **Schritt 4b · Rahmen verteilen** · Was sich verschieben ließe | ja         |

Die Reiterliste bildet die **Handelnden** ab, nicht die Datenarten.

**Eine Regel für die Reihenfolge, überall dieselbe:** das Nachschlagewerk, das
die Handlung begründet, steht **vor** der Handlung. Ergebnis vor Aufteilen,
Business Case vor Verteilen.

**Der Falter entfällt.** Was aufklappte, hat eine eigene Adresse; die Zeile in
der Matrix wird damit ein echter Wegweiser statt einer Klapptür.

### 2.2 · Drei Sorten — und die dritte ist keine Kachel

| Sorte               | Gestalt                                                                             | Beispiele                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Arbeitsfläche**   | Karte · linke Akzentschiene `primary` · Schrittnummer im Titel · Aktion oben rechts | Schritt 1 · Betriebspositionen; Schritt 4 · Zuspruch aufteilen; Schritt 4 · Rahmen verteilen     |
| **Nachschlagewerk** | Karte, ruhig — keine Schiene, keine Nummer, keine Aktion                            | Ergebnis der Kachel, Business Case, die drei „Wofür"-Kacheln, Matrix, Was sich verschieben ließe |
| **Wegweiser**       | **keine Kachel** — Leiste, Zeile, Link                                              | Finanzierungs-Leiste, Reiterliste, ART-Name in der Matrix, „Zur Kachel →"                        |

> **Die dritte Sorte wurde als Kachelsorte verworfen.** „Rahmen je ART" ist kein
> Nachbar des Verteilformulars, sondern **dessen Auswahl** — welches ART man
> verteilt, ist Teil des Verteilens. Die beste Lösung für „Navigationskachel
> neben Eingabekachel" ist, dass die Navigationskachel aufhört, eine Kachel zu
> sein.

`border-l-*` ist von ADR-0021 ausdrücklich als **Akzentschiene** erlaubt und vom
`HAND_CARD`-Wächter ausgenommen; verboten ist nur der `border` als Kartenumriss.

---

## 3 · Der Business Case je ART

**Die Frage:** woher kommt das Geld, das in diesem Halbjahr an diesem ART landet?

| Herkunft                               | Quelle                                                |
| -------------------------------------- | ----------------------------------------------------- |
| **Veränderung** — finanziert Vorhaben  |                                                       |
| Portfolio-Epics aus der Kachel         | `BudgetCandidate` `kind=epic`, `artId`, `finalAmount` |
| ART-Rahmen · **an ART-Epics**          | `ArtEpicAllocation` (`artId`, `cycleKey`)             |
| ART-Rahmen · **für ART-eigene Arbeit** | `ArtOwnWorkAllocation` (`artId`, `cycleKey`)          |
| ART-Rahmen · **noch nicht vergeben**   | `RtbItemAward` − beide Zuteilungen                    |
| **Betrieb** — finanziert nie ein Epic  |                                                       |
| Direkt am ART                          | `RunTheBusinessItem` `kind=run`, `artId` gesetzt      |
| Über Solutions dieses ARTs             | `run` mit `solutionId` → `Solution.artId`             |
| Wertstrom-übergreifend, geschlüsselt   | `run` ohne ART und ohne Solution ÷ Zahl der ARTs      |

Vier Zeilen davon standen in der ursprünglichen Anforderung nicht und sind
ergänzt, weil die Rechnung sonst nicht aufgeht:

1. **Betrieb über die Solution** als eigene Zeile — bei Plant Efficiency der
   zweitgrößte Posten. ART-spezifisch, aber anders hergeleitet als der direkte.
2. **Rahmen, noch nicht verteilt** — sonst unterschlägt die Summe Geld, das dem
   ART gehört und nur noch nicht an einem Epic hängt.
3. **Die Trennung Veränderung / Betrieb** mit Zwischensummen. Ohne sie lädt die
   Tabelle zu genau dem Fehler ein, den §2.6 der Konsolidierungs-Spec verbietet.
4. **Die Gegenposition** — Last × €-Satz gegen das zugeteilte Budget. Sie wohnt
   im KPI-Reiter (§5); im ART-Reiter bleibt davon **eine Zeile**.

**Σ gesamt heißt „was dieses ART hat", nicht „was es ausgegeben hat"** — der
nicht verteilte Rahmen zählt mit. Die Kopfzeile sagt das.

### Zugesprochen schlägt beantragt

Wo für ein Halbjahr `RtbItemAward`-Zeilen vorliegen, zeigt die Tabelle den
**zugesprochenen** Betrag, nicht den geplanten (`rtbCycleAmount`). Vor dem
Aufteilen gibt es keine Zusprüche — dann steht der geplante Betrag da und heißt
auch so („beantragt").

Gemessen für 2026-H2: Betrieb über Solutions bei Plant Efficiency ist
**82.353 € zugesprochen** gegenüber 77.500 € geplant; die übergreifenden
Positionen **28.824 €** je ART statt 24.500 €.

---

## 4 · Der Reiter „Budget-KPIs"

Dieselbe Kachel dreimal untereinander — für den Wertstrom **und für jedes ART**.
Ein Ort zum Nachschlagen, damit die Arbeitsreiter die Herleitung nicht
mitschleppen.

| Zeile              | Wertstrom           | Materials & Energy | Plant Efficiency (OEE) |
| ------------------ | ------------------- | ------------------ | ---------------------- |
| Feature-Last       | 105 F · 635 JS      | 31 F · 180 JS      | 74 F · 455 JS          |
| Satz je Job Size   | **existiert nicht** | 7.953 €            | 13.043 €               |
| Last in Geld       | 7.365.983 €         | 1.431.551 €        | 5.934.432 €            |
| Zugeteiltes Budget | 474.800 €           | 236.050 €          | 238.750 €              |
| Lücke              | −6.891.183 €        | −1.195.501 €       | −5.695.682 €           |

**Der Satz ist je ART verschieden — ein Wertstrom-Satz wäre eine Erfindung.**
`deriveJobSizeRate` leitet ihn aus der Historie **dieses** ARTs ab
(`domain/art-throughput.ts`). Die Wertstrom-Last ist deshalb die **Summe zweier
Rechnungen**, nicht 635 JS × einem Satz. Die Karte sagt das, und die
Aufschlüsselung je ART steht zugeklappt darunter — sonst teilt jemand
7.365.983 ÷ 635 und hält 11.600 € für „den Satz".

**Betrieb zählt in keiner dieser Rechnungen mit** — er bezahlt kein Feature.

---

## 5 · Zwei Rechenfragen, gestellt und zurückgestellt

Beide kamen beim Bauen der Herkunftstabelle hoch. **Entschieden am 2026-09-19:
die bisherige Kalkulation bleibt, bis etwas anderes gesagt wird.** Die Messungen
stehen hier, damit sie beim nächsten Mal nicht neu erhoben werden müssen.

### (a) Der €-Satz auf Vollkosten

`deriveJobSizeRate` nimmt als Zähler nur das **Veränderungsgeld** vergangener
Halbjahre. Mit dem **gesamten** Budget (Portfolio + ART-Rahmen + Betrieb, je
Halbjahr aus `RtbItemAward` — historisch exakt, nicht hochgerechnet):

| ART                    | Satz heute | Vollkosten   | Zähler heute → voll     |
| ---------------------- | ---------- | ------------ | ----------------------- |
| Materials & Energy     | 7.953 €    | **14.275 €** | 389.700 € → 699.465 €   |
| Plant Efficiency (OEE) | 13.043 €   | **22.756 €** | 626.050 € → 1.092.286 € |

Die Last stiege bei Plant von 5,9 auf **10,4 Mio €**.

**Der Einwand, der die Sache trägt:** §2.6 der Konsolidierungs-Spec verbietet
Betriebsgeld im Satz, weil `allocated` zugleich Deckungs-Bezugsgröße und
Satz-Zähler ist. Das stimmt im Code — aber beide werden an **verschiedenen
Halbjahren** benutzt (Satz: vergangene, Deckung: laufendes), liessen sich also
trennen. Ein Vollkostensatz verlangte dann, dass auch die Deckung gegen das
**Gesamtbudget** rechnet; sonst stünde eine Vollkosten-Last gegen ein
Teilkosten-Budget.

**Zurückgestellt.** §2.6 und REQ-10 der Konsolidierungs-Spec bleiben in Kraft.

### (b) `ArtEpicAllocation` fehlt in der Deckung

`coverage.allocated` zählt nur die Portfolio-Zuteilungen
(`server/views/art-budget-detail.ts:284-288`). Das aus dem ART-Rahmen an
Epics verteilte Geld fehlt — obwohl es dieselben Features finanziert. Für Plant ·
2026-H2 sind das **76.250 €**: ausgewiesen wird eine Lücke von 5.695.682 €, bei
Einbezug wären es 5.619.432 €. Derselbe Versatz steckt im Satz.

**Zurückgestellt.** Die Flächen zeigen den heutigen Stand.

---

## 6 · Requirements (testbar)

**REQ-1 · Fünf Reiter, zwei Gruppen.** Wertstrom: `einrichten` · `halbjahr` ·
`nachsehen` · `kpi`. Dazu je **sichtbarem** ART einer (`art:<id>`), alphabetisch,
unter einer Trennlinie und dem Etikett „ARTs".

**Lesereihenfolge ist nicht Landeplatz.** Die Reiter stehen in Prozessfolge —
„Einrichten" zuerst —, aber wer die Adresse ohne `?tab=` öffnet, landet auf
`nachsehen`: man kommt, um zu sehen, nicht um einzurichten. `resolveTab` fällt
heute auf `tabs[0]` zurück und kann das nicht ausdrücken; sie bekommt einen
**expliziten Rückfall** als drittes Argument.

**REQ-2 · Kein Halbjahr-Umschalter auf „Einrichten".** Was dort steht, gilt über
alle Halbjahre; der Umschalter behauptete sonst einen Zeitbezug, den es nicht
gibt. Das gewählte Halbjahr bleibt beim Wechsel dorthin und zurück erhalten.

**REQ-3 · Drei Sorten, ohne Lesen unterscheidbar.** Arbeitsfläche =
Akzentschiene + Schrittnummer + Aktion. Nachschlagewerk = ruhige Karte.
Wegweiser = keine Kachel.

**REQ-4 · Nachschlagewerk vor Handlung.** In jedem Reiter steht die Karte, die
die Handlung begründet, über der Handlung.

**REQ-5 · Kein Falter, kein `?art=`.** Der ART steckt im Reiter. In keiner
Tabellenzeile klappt mehr etwas auf.

**REQ-6 · Die Reiterliste trägt den offenen Rahmen.** Neben jedem ART-Namen
`remaining` aus `loadArtEpicBudgets`, in `primary`, **nur wenn > 0**, nur für
das gewählte Halbjahr. Die einzige Zahl in der Navigation.

**REQ-7 · Der Business Case je ART.** Sechs Herkunftszeilen nach §3, getrennt
nach Veränderung und Betrieb, mit Zwischensummen und Σ gesamt. Anteile beziehen
sich auf Σ gesamt; „p. a." gibt es nur für Betrieb.

**REQ-8 · Zugesprochen schlägt beantragt.** Wo Awards vorliegen, zeigt die
Tabelle sie; sonst den geplanten Betrag, und dann heißt die Spalte „beantragt".

**REQ-9 · Budget-KPIs.** „Wofür · eingeplant" für den Wertstrom und je ART,
untereinander, dieselbe Form. **Kein Wertstrom-Satz** — die Wertstrom-Last ist
die Summe der ART-Rechnungen, und die Karte sagt es.

**REQ-10 · Jede Arbeitsfläche nennt ihren Nachfolger.** Ein Fußsatz, der
konkret übergibt („Weiter in den Reitern ⟨ART⟩ und ⟨ART⟩").

**REQ-11 · Spalten ausserhalb der Summe sagen es.** Die Betriebsspalte steht
rechts von Σ, durch eine Linie getrennt, und trägt „nicht in Σ" im Kopf.
**Präzisiert 2026-09-19:** sie trägt zusätzlich ihr **Halbjahr** und ihre
**Basis** — `Betrieb · H2 2026 · zugesprochen · nicht in Σ`. Sie hiess „je HJ"
und rechnete mit dem geplanten Betrag, während der Business Case desselben ARTs
den zugesprochenen zeigte: 24.500 € gegen 28.824 €, dieselbe Seite. „Zugesprochen
schlägt beantragt" (REQ-8) gilt überall, wo ein Betriebsbetrag steht.

**REQ-12 · Jede Karte hat eine leere Fassung.** Eine Arbeitsfläche verliert
dabei ihren **Knopf, nicht ihre Schiene** — sie bleibt der Ort, an dem etwas zu
tun wäre, und sagt, was fehlt:

| Karte               | Voraussetzung             | Ohne sie                                                           |
| ------------------- | ------------------------- | ------------------------------------------------------------------ |
| Ergebnis der Kachel | Kachel abgeschlossen      | „Für ⟨HJ⟩ gibt es keine Kachel." / „Die Kachel läuft noch." + Link |
| Zuspruch aufteilen  | `awarded != null`         | „Noch nichts zugesprochen."                                        |
| Zuspruch aufteilen  | Fenster offen             | Beträge als Text, Grund im Klartext, kein Knopf                    |
| Rahmen verteilen    | Rahmen > 0                | „Für ⟨HJ⟩ ist diesem ART kein Rahmen zugesprochen."                |
| Rahmen verteilen    | ≥ 1 vorgemerktes ART-Epic | „Kein vorgemerktes ART-Epic — der Haken sitzt am Epic."            |
| Business Case       | irgendeine Zeile ≠ 0      | `EmptyState`: „An diesem ART landet in ⟨HJ⟩ kein Geld."            |
| Wofür (KPI)         | `rate.rate != null`       | „Deckung nicht berechenbar." Zeilen bleiben, Lücke ist „—"         |
| Matrix              | ≥ 1 ART                   | `EmptyState` „Noch kein ART"                                       |
| Betriebspositionen  | ≥ 1 Position              | `EmptyState`, Knopf bleibt                                         |

**REQ-13 · Zwei Zeichen, zwei Gesten.** `›` führt in einen anderen Reiter;
`▸`/`▾` klappt an Ort und Stelle auf und steht nur noch an `<details>`.

**REQ-14 · Die Leiste.** Beschriftung `fundingSummary(phases)`. `surface` folgt
dem **Reiter** (`art` auf einem ART-Reiter, sonst `value_stream`) statt
`focusArtId`. Schritt 4 verlinkt in den Reiter. **Der Schritt der Leiste ist
nicht der Schritt des Reiters** — sie sagt, wo der Prozess steht, der Reiter, wo
man steht.

**REQ-15 · Die Zurechnung gliedert, statt sich zu wiederholen.**
_Ersetzt am 2026-09-19._ In „Einrichten" zerfallen **Betrieb** und **ART-Rahmen**
jeweils in dieselben drei Gruppen, von der breitesten Zurechnung zur engsten:
**Wertstrom-übergreifend** (geschlüsselt) · **ART-übergreifend** ·
**Solution-individuell**. Jede Gruppe trägt ihre Zwischensumme; leere Gruppen
erscheinen nicht.

Die Spalte daneben nennt nur noch den **Namen** — in der Solution-Gruppe beide
Stationen (`⟨Solution⟩ · ⟨ART⟩`), denn der ART der Solution entscheidet, wo das
Geld landet.

**Die Gruppe folgt der Eingabe, nicht der Auflösung:** eine Position mit ART
**und** Solution steht bei der Solution, weil man sie dort sucht.
`resolveRtbToArts` nimmt in diesem Fall den direkten ART — weicht er vom ART der
Solution ab, sagt die Zeile das („zählt bei ⟨ART⟩"). Am Bestand stimmen beide
bei allen vier betroffenen Positionen überein.

Die ursprüngliche Fassung — **eine** Spalte, die den Weg im Text jeder Zeile
trug — verschwieg jeweils die zweite Station: von 25 Betriebspositionen hängen
15 an einer Solution, deren ART nirgends stand.

**Weg 1 war bis 2026-09-19 gar nicht erreichbar.** Das Formular blendete das
ART-Feld aus, sobald die Art nicht `art_change` war — eine Betriebsposition
liess sich nur einer Solution zuordnen oder gar nichts. Dass **0 von 25**
Positionen einen direkten ART tragen, war deshalb keine Aussage über die
Nutzung, sondern über das Formular. Mit dem freigegebenen Feld gilt zugleich die
Wertstrom-Prüfung für **jede** Art: ein fremder ART wurde vorher stillschweigend
gespeichert und von `resolveRtbToArts` übergangen — das Geld fiel aus jeder
Gruppe, ohne dass es jemand meldete.

**REQ-15b · Vorlagen beim Anlegen.** „+ Position" bietet die üblichen
Positionen eines Wertstroms an, gegliedert nach denselben drei Gruppen
(`domain/rtb-templates.ts`). Eine Vorlage setzt **Name, Art und Periode** vor,
**nie den Betrag**. Die Perioden folgen der Entscheidungsfrequenz: Kapazität und
Laufkosten jährlich, der ART-Rahmen je Halbjahr. Vorlagen, die in die
Kapazitätsfalle führen (§9.3), sagen das im Formular.

**REQ-15c · Ein Pflegeort.** Betriebspositionen werden **nur** im Budget-Bereich
gepflegt. Die Solution-Fläche im Struktur-Bereich zeigt sie lesend, mit dem ART,
auf dem ihr Geld landet, und einem Weg zum Pflegeort. Zwei Schreibflächen für
dieselben Zeilen hiessen zwei Stellen, an denen Rechte, Formular und Wortwahl
auseinanderlaufen.

**REQ-16 · Die Sprungziele halten.** `?tab=betrieb` → `?tab=halbjahr`,
`?tab=budget` → `?tab=nachsehen`, `&art=<id>` → `?tab=art:<id>`. Kette, Inbox,
Redirect, Struktur-Hinweis und Kachel-Ergebnis landen am richtigen Ort.

**REQ-17 · Der Wächter wächst mit.** `section-structure.test.tsx`: eine Karte
mit Akzentschiene trägt eine Aktion oder eine Schrittnummer — sonst behauptet
sie eine Arbeitsfläche, die keine ist.

**REQ-18 · Die Kalkulation bleibt unverändert.** Keine Zahl wird anders
gerechnet (§5).

---

## 7 · Umsetzung in Stufen

1. **`SectionCard` bekommt die Sorten** — `step?: number`, `work?: boolean`
   (`border-l-2 border-l-primary`), dazu die Wächter-Regel aus REQ-17. Beides
   ohne Vorgabe; bestehende Aufrufer bleiben unverändert. **Trägt allein.**
2. **Die Reiter** — `TABS` dynamisch, Umschalter bedingt (REQ-2), `?art=` →
   Reiter, `ArtDetailPanel` entfällt, alle Sprungziele (REQ-16).
   `EntityDetailShell` bekommt die Gruppierung der Reiterliste.
3. **Der Business Case** — reine Rechnung `domain/art-budget-origin.ts`,
   `rtb-art-resolution.ts` gibt zusätzlich **je Weg** aus (heute nur die Summe),
   Lader `server/views/art-business-case.ts` über `budget-reads.ts` (keine neue
   Rundreise).
4. **Budget-KPIs** — `server/views/budget-kpis.ts`: `loadArtCoverage` je
   sichtbarem ART, Summe für den Wertstrom, **kein** Wertstrom-Satz. Die
   Deckungs-Kachel zieht aus `art-budget-tab.tsx` hierher; dort bleibt eine
   Zeile.
5. **Die Feinheiten** — leere Fassungen (REQ-12), Nachfolger-Sätze (REQ-10),
   Spaltenköpfe (REQ-11), Zeichen (REQ-13), Zurechnung (REQ-15).
6. **Doku** — Nachtrag an `art-budget-consolidation.md`, der Wiki-Leitfaden
   `guides/art-epic-budget.ts` nennt die neuen Reiter.

**Nach Stufe 2 ist ein sauberer Halt:** die Fläche ist geschnitten und
navigierbar, die Inhalte sind dieselben.

---

## 8 · Bewusster Verzicht

- **Keine Zahl wird anders gerechnet** (§5, REQ-18).
- **Kein Reiter für die Kachel.** Schritte 2 und 3 passieren woanders; die
  Leiste zeigt sie und verlinkt dorthin. Mehr wäre eine zweite Wahrheit.
- **Der „ART ohne Rahmen"-Hinweis bleibt aussen vor.** Der Leitfaden nennt ihn
  als die Falle von Schritt 1; ihn zu zeigen wäre **neues Verhalten**, nicht
  Gliederung.
- **Der ART-Rahmen finanziert auch Arbeit ohne Epic** (2026-09-19, eigene Spec
  [art-own-work-budget.md](art-own-work-budget.md)): der Business Case oben
  zerlegt die verteilte Rahmen-Zeile seitdem in „an ART-Epics" und „für
  ART-eigene Arbeit". Σ Veränderung und Σ gesamt ändern sich dadurch nicht.
- **Der Verlauf ist entfallen** (2026-09-19, Nachtrag in
  `art-budget-transparency.md`): sechs gleich hohe Balken, deren Höhe die
  Rechnung selbst erzeugt. Die Zustandsstaffel sagt dasselbe ohne Monatsachse —
  und ohne dass je Epic acht Spalten Reifegrad-Historie geladen werden müssen.
  „Nachsehen" trägt seitdem genau eine Karte.
- **Auslastung und Soll/Ist bleiben in „Nachsehen"**, nicht in den KPIs — sie
  sind die Aussage der Matrix, keine Kennzahlen für sich.
- **Die Kachel-Fläche** (`features/components/period/`) bleibt unberührt. Sie
  hat denselben Befund; das ist eine eigene Spec.

## 9 · Offene Punkte

1. **Wie viele ARTs verträgt die Reiterliste?** Hier zwei — macht sechs Reiter.
   Ein Wertstrom mit sechs ARTs macht **zehn**. Die Liste scrollt dann; ob das
   trägt, sieht man erst an einem solchen Bestand. Falls nicht: die ARTs als
   Auswahl **innerhalb** eines Reiters „ARTs".
2. ~~Reiter „Einrichten" ist dünn~~ — **entschieden am 2026-09-19: er bleibt.**
   Er ist die einzige zeitlose Fläche und die einzige ohne Halbjahr-Umschalter;
   zurück in „Dieses Halbjahr" geschoben, entstünde genau der Befund wieder, der
   diese Spec ausgelöst hat. Ein dünner Reiter, der die Wahrheit sagt, ist
   besser als ein voller, der lügt.
3. **Die Kapazität hat keine eigene Art.** Pulse teilt das Geld eines Wertstroms
   in zwei: Veränderungsgeld, das Vorhaben finanziert, und Betrieb, der „nie ein
   Epic bezahlt" (§2.6 der Konsolidierungs-Spec). Eine reale Wertstrom-Struktur
   hat dazwischen einen dritten, **größten** Block — die Kapazität der Teams.
   Heute muss sie als `run` geführt werden und fällt damit aus Deckung, Lücke
   und €-Satz: die Ampel meldet „überbucht um 2386 %", während die Teams, die
   die Features bauen, bezahlt sind.

   Eine dritte Art neben `run` und `art_change` wäre die saubere Antwort und ist
   SAFe-konform — ein Lean Budget finanziert Menschen, und Epics werden daraus
   gedeckt, nicht zusätzlich bezahlt. **Dieselbe Wurzel** haben die beiden
   zurückgestellten Rechenfragen aus §5: der Vollkostensatz (a) und die
   fehlenden Rahmen-Zuteilungen in der Deckung (b). Wer eine von ihnen aufgreift,
   sollte alle drei zusammen ansehen.

   Bis dahin sagen die Vorlagen für Kapazität im Formular, was sie tun
   (REQ-15b).

## 10 · Verifikation

1. **Messlatte:** `npx tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`
   (Dev-Server samt `next-server`-Kind stoppen, Port per `lsof`, neu starten).
2. **Wächter:** `visual-language`, `rsc-boundary`, `entity-detail-shell-tabs`,
   `guides`, `section-structure` samt neuer Regel (REQ-17).
3. **Die Zuordnung als Probe:** je Reiter nachzählen, dass nur Blöcke seiner
   Phase darin stehen — „Einrichten" enthält nichts Halbjahresgebundenes,
   „Nachsehen" und „Budget-KPIs" keinen Schreibweg.
4. **Die Herkunftsrechnung stimmt:** Σ je ART gegen SQL gegengeprüft; Σ über
   alle ARTs = Σ Epic-Zuteilungen + Σ Zuspruch. Kein Euro entsteht, keiner
   verschwindet.
5. **Σ-Probe der Flächen:** „Betrieb · je HJ" zählt nicht in Σ der Matrix;
   Σ gesamt = Σ Veränderung + Σ Betrieb; Anteile summieren auf 100 % ± 1.
6. **Zeitbezug:** „Einrichten" ändert sich beim Halbjahrwechsel nicht.
7. **Sprungziele** (REQ-16) — alle fünf Einsprünge landen am richtigen Ort.
8. **Rechte:** ein ART-eingegrenzter Nutzer sieht nur seine ART-Reiter; ohne
   Wertstrom-Recht fehlen die Summenzeilen in „Nachsehen".
9. **Die leeren Fassungen** (REQ-12) — je Karte einmal herbeiführen. Eine
   Fläche, die nur im guten Fall stimmt, ist nicht fertig.
10. **Ohne Lesen erkennbar:** je Reiter binnen einer Sekunde sagen können, welche
    Karte eine Arbeitsfläche ist. Das ist der Zweck; gelingt es nicht, trägt die
    Schiene nicht.
11. **Beide Themen**, hell und dunkel.

## 11 · Referenzen

- [art-budget-consolidation.md](art-budget-consolidation.md) — die Zusammenlegung
  der zwei Flächen; §2.6 und REQ-10 bleiben in Kraft (§5 dieser Spec)
- [art-own-work-budget.md](art-own-work-budget.md) — der ART-Rahmen finanziert
  auch Features ohne Epic; die Reservierungszeile und ihr Richtwert
- [art-budget-transparency.md](art-budget-transparency.md) — Zustandsstaffel,
  €-Satz, die zwei Ampeln; ihr zweiter Nachtrag nimmt den Verlauf zurück
- [art-budget-relocation.md](art-budget-relocation.md) — warum die Flächen unter
  `/budgeting` liegen
- [art-epic-budget-walkthrough.md](art-epic-budget-walkthrough.md) — der Ablauf
  aus drei Perspektiven; `guides/art-epic-budget.ts` ist seine gelebte Fassung
- ADR-0021 (die visuelle Sprache — Karte, Akzentschiene, Mikro-Beschriftung),
  ADR-0013 (Schichtung)
