# Ein gelebter Prozess — was liefert, was blockiert

Der Alltag im Cockpit: die Reihenfolge, der Status und das, was dazwischenkommt.
Dreimal erzählt: aus Sicht des **Feature Owners**, der priorisiert und liefert,
des **RTE**, der den Zug zusammenhält, und des **Portfolio Managers**, der von
oben zusieht.

[PI](pi-walkthrough.md) beschreibt den **Takt** — wann ein Zeitraum beginnt und
endet. Dieses Dokument beschreibt, was **innerhalb** davon täglich passiert, und
die drei Flächen, die es dafür gibt.

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
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen führt
[Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

### Die Schreibmaschine eines Features

```
approved  →  in_progress  ⇄  blocked  →  completed | cancelled
```

**Der Doppelpfeil ist die Pointe.** Blockiert zu sein ist kein Makel und keine
Sackgasse — der Weg zurück steht offen. Und es gibt **zwei** Enden:
`cancelled` ist eine Entscheidung, keine Niederlage.

Diesen Status setzt der Feature Owner selbst. Er ist die einzige Stelle, an der
täglich etwas beigetragen wird — und die Zahl, aus der alles andere abgeleitet
wird: der Fortschritt des Epics, die Auslastung des ARTs, die Frage, ob das PI
zu ist.

### Drei Flächen für dieselben Features

| Fläche                                                | Wofür sie gebaut ist                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/umsetzung`** — „Umsetzung · Delivery-Cockpit"     | „Board, Tabelle, Fahrplan und Netzwerk in einer Fläche." Der Arbeitsplatz. ART und PI sind **Ausschnitte** (`?art=`, `?pi=`), keine eigenen Orte. |
| **`/implementation/features`** — „Features-Übersicht" | „Alle Features im Zugriff — über Wertströme, ARTs und PIs hinweg." Die Suche, wenn man nicht weiß, wo etwas hängt.                                |
| **`/dependencies`** — „Abhängigkeiten"                | „Alle Abhängigkeiten im Zugriff über PIs hinweg — Cross-ART und Critical-Path sind direkt sichtbar."                                              |

Die ersten beiden zeigen dasselbe von zwei Seiten: das Cockpit **innerhalb**
eines Zuges, die Übersicht **quer** über alle.

### Wer die drei sind

| Wer                   | Was er tut                                                                           | Recht                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Feature Owner**     | Features anlegen, schärfen, nach WSJF priorisieren, den Lieferstatus setzen, löschen | `feature.create`, `feature.wsjf.set`, `feature.delivery.set`, `feature.delete` |
| **RTE**               | dasselbe für seinen Zug, plus Abhängigkeiten und den Takt                            | dieselben, plus `dependency.link`                                              |
| **Portfolio Manager** | dasselbe von oben, ohne ART-Grenze                                                   | dieselben, unscoped                                                            |

Die drei tragen **fast identische Rechte**. Der Unterschied ist nicht die
Reichweite, sondern die Blickrichtung: der Feature Owner sein Backlog, der RTE
sein ART, der Portfolio Manager das Portfolio.

---

# 1 · Der Feature Owner

Meine Frage lautet: **was baue ich als Nächstes, und woher weiß ich das?**

## Die Reihenfolge ist meine Aussage

WSJF — **Weighted Shortest Job First**. Vier Zahlen, eine Division:

```
        Business Value + Time Criticality + Risk Reduction
WSJF =  ─────────────────────────────────────────────────
                          Job Size
```

Der Dialog heißt **„Update WSJF Score"** und trägt genau diese vier Felder;
gerechnet wird auf zwei Nachkommastellen. Ist eine der vier Zahlen leer, gibt es
keinen Score — die Pille zeigt dann **„Score"** statt einer Zahl.

> **Dasselbe Ergebnis, zwei Bänder.** Der berechnete Wert wird in `high`,
> `medium`, `low` einsortiert — aber mit **verschiedenen Schwellen**, je nachdem,
> wo man hinschaut: das Cockpit nutzt ≥ 8 / ≥ 4 und nennt fehlende Scores
> „unscored", die ART-Feature-Listen ≥ 5 / ≥ 2 und nennen sie „none". Das ist
> bewusst so und im Code als **Datenunterschied** angelegt, nicht als zwei
> Implementierungen. Wer die Bänder über zwei Flächen vergleicht, vergleicht
> trotzdem Verschiedenes.

WSJF ist eine eigene **Practice**. Ist sie aus, verschwinden die Spalten und die
Rangliste — die Zahlen bleiben stehen, nur niemand schaut mehr hin.

## Liefern

Den Status setze ich selbst, einzeln oder **im Stapel**. Was die fünf Werte
bedeuten:

| Status        | Was ich damit sage                                       |
| ------------- | -------------------------------------------------------- |
| `approved`    | geplant, noch nicht angefangen                           |
| `in_progress` | jetzt wird daran gearbeitet                              |
| `blocked`     | es geht gerade nicht weiter — **kein Makel, ein Signal** |
| `completed`   | fertig                                                   |
| `cancelled`   | wir machen es nicht                                      |

Jeder Wechsel wird als `feature.delivery.transitioned` protokolliert.

## Was mir auffällt, melde ich

Was uns aufhält, geht als **Issue** ins gemeinsame Register — Risiken und
Blockaden liegen dort zusammen. Melden darf jede Rolle, bis hinunter zum
Viewer. Was daraus wird, entscheidet ein anderer; hier zählt nur: ein
gemeldetes, **nicht eingeordnetes** Issue taucht am PI-Abschluss wieder auf.
Der Weg steht in [Risiko](risk-walkthrough.md).

---

# 2 · Der RTE

Meine Frage lautet: **wer wartet auf wen?**

## Abhängigkeiten sind eine eigene Praxis

Auf `/dependencies` liegen sie über alle PIs hinweg, mit **Cross-ART** und
**Critical Path** direkt sichtbar. Vier Handlungen, und sie sind bewusst nicht
dasselbe:

| Handlung       | Was sie tut                                | Recht               |
| -------------- | ------------------------------------------ | ------------------- |
| **Anlegen**    | eine neue Abhängigkeit als eigenes Objekt  | `dependency.link`   |
| **Verknüpfen** | eine bestehende an ein Arbeitspaket hängen | `dependency.link`   |
| **Typ ändern** | `blocks` · `relates_to`                    | `dependency.link`   |
| **Lösen**      | einzeln oder im Stapel                     | `dependency.unlink` |

> **Warum Lösen ein eigenes Recht ist.** Eine Abhängigkeit zu knüpfen fügt Wissen
> hinzu; sie zu lösen **kippt fremde Planungsannahmen**. Wer sie gesetzt hat,
> hat sich darauf verlassen. Deshalb steht das Lösen unter einer eigenen
> Capability — auch wenn im Standard dieselben drei Rollen sie tragen.

Abhängigkeiten sind ebenfalls eine eigene Practice. Ist sie aus, verschwindet
die Fläche.

## Verantwortung zuweisen, ohne den Inhalt zu ändern

`feature.owner.assign` ist **eine eigene Action** statt einer Nutzung von
`feature.update` — und der Grund steht im Code: Epic Owner und
Wertstrom-Verantwortliche dürfen den **Inhalt** eines Features nicht ändern,
sollen aber die **Verantwortung** zuweisen können.

Das Rollenmodell kennt keine Vererbung, deshalb steht „ab Epic Owner aufwärts"
ausgeschrieben: Portfolio Manager, RTE, Feature Owner und Epic Owner
unskopiert, der Wertstrom-Owner auf seinen Wertstrom beschränkt — dieselbe
Konstruktion wie bei `epic.owner.assign`.

---

# 3 · Der Portfolio Manager

Meine Frage lautet: **wo steckt es, und was heißt das für die Epics?**

## Die Übersicht quer

`/implementation/features` zeigt alle Features über Wertströme, ARTs und PIs
hinweg — mit WSJF-Spalten, solange die Practice an ist. Das ist die Fläche für
die Frage „wo hängt eigentlich X?", wenn man den Zug nicht kennt.

## Was der Status nach oben bewegt

Ich setze hier selten selbst etwas. Was mich interessiert, ist die Ableitung:

- Der Reifegrad-Schritt **L4.1 → L4.2** eines Epics hat als **beratendes**
  Kriterium: alle Child-Features sind abgeschlossen. Beratend, nicht
  blockierend — der Antrag geht auch früher, dann steht die offene Zahl daneben
  und die Abnehmer entscheiden.
- Die **Auslastung eines ARTs** entsteht aus der Job Size seiner eingeplanten
  Features. Das ist die einzige Stelle, an der WSJF-Zahlen etwas anderes tun als
  sortieren.
- Ein **offenes Issue ohne ROAM** hält am Ende den PI-Abschluss auf — als
  Warnung in der Oberfläche, als Sperre über die API.

## Löschen

`feature.delete` tragen Portfolio Manager, RTE, Feature Owner und Tenant-Admin.
RTE und Feature Owner **art-scoped**: nur in den ARTs, denen sie zugewiesen sind.

**Bis zum 2026-09-20 hatte der Feature Owner das Recht nicht** — begründet mit
Funktionstrennung: wer anlegt und pflegt, entscheidet nicht allein, dass es
verschwindet. Umgesetzt war die Trennung nie: der Löschen-Knopf hing am
Bearbeiten-Recht, also sah ihn genau der, der ihn nicht drücken durfte, und
bekam nach dem Bestätigen eine Fehlermeldung. Entschieden wurde gegen die
Trennung und für das Recht.

Gelöscht wird **weich** (`deletedAt`); nichts kaskadiert, weil unter einem
Feature nichts hängt.

---

## Die Nähte

**Zum PI.** Der Takt gibt der Lieferung ihren Rahmen: ein PI beginnt, Features
werden zugeordnet, am Ende wird gezeigt, was entstanden ist. Das steht in
[PI](pi-walkthrough.md).

**Zum Epic.** Features sind Kinder von Epics. Ihr Status ist die Bewegung, die
das Epic durch L4 schiebt — und ihre Zahl das beratende Kriterium für L4.2.

**Zum Risiko.** Blockaden und Risiken liegen in einem Register. Der Doppelpfeil
`in_progress ⇄ blocked` sagt, dass etwas klemmt; **warum**, steht im Issue.

**Zum Budget — bewusst keine.** Geld wird je Halbjahr entschieden, geliefert
wird je PI. Berührung gibt es nur mittelbar über die Job Size.

## Sätze, die naheliegen und nicht stimmen

| Satz                                                           | Warum er nicht stimmt                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| „`blocked` ist eine Sackgasse."                                | Der Weg zurück nach `in_progress` steht offen — der Doppelpfeil ist Absicht. |
| „`cancelled` heißt gescheitert."                               | Es ist eine Entscheidung. Zwei Enden, nicht eines.                           |
| „Ein WSJF-Band bedeutet überall dasselbe."                     | Cockpit ≥ 8 / ≥ 4, ART-Listen ≥ 5 / ≥ 2. Derselbe Score, zwei Einordnungen.  |
| „`/umsetzung/art/[id]` ist eine eigene Seite."                 | Es ist ein **Ausschnitt** — `?art=…`. Die alten Routen leiten dorthin um.    |
| „Es gibt eine Feature-QS."                                     | Der Freigabelauf wurde 2026-06 entfernt; „Acceptance" ist ein Textfeld.      |
| „Als Feature Owner kann ich jedes Feature löschen."            | Nur in **seinen** ARTs — `feature.delete` ist art-scoped.                    |
| „Verantwortung zuweisen ist Teil von `feature.update`."        | Eigene Action — Zuweisen ohne Inhaltsänderung ist der ganze Zweck.           |
| „Eine Abhängigkeit zu lösen ist so harmlos wie sie zu setzen." | Es kippt fremde Planungsannahmen. Deshalb ein eigenes Recht.                 |
| „Ohne WSJF-Practice sind die Zahlen weg."                      | Sie bleiben gespeichert. Nur die Spalten und die Rangliste verschwinden.     |

## Wer welchen Schritt macht

| Schritt                                        | Wer                                                                   | Recht                              |
| ---------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| Feature anlegen, schärfen, Acceptance Criteria | Portfolio Manager, RTE, Feature Owner                                 | `feature.create`, `feature.update` |
| WSJF bewerten                                  | dieselben                                                             | `feature.wsjf.set`                 |
| PI zuordnen                                    | dieselben                                                             | `feature.update`                   |
| Lieferstatus setzen, einzeln und im Stapel     | dieselben                                                             | `feature.delivery.set`             |
| Verantwortung zuweisen                         | dieselben **plus Epic Owner**; Wertstrom-Owner scoped                 | `feature.owner.assign`             |
| Feature löschen                                | Portfolio Manager, Tenant-Admin; RTE und Feature Owner auf ihren ARTs | `feature.delete`                   |
| Abhängigkeit anlegen, verknüpfen, Typ ändern   | Portfolio Manager, RTE, Feature Owner                                 | `dependency.link`                  |
| Abhängigkeit lösen                             | dieselben                                                             | `dependency.unlink`                |

## Nachschlagepunkte im Code

| Aussage                                         | Quelle                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Die fünf Delivery-Status als Schreibmaschine    | `src/modules/work/domain/feature-status.ts`                                             |
| Die Übergänge und ihr Audit-Ereignis            | `src/modules/work/features/feature/actions/feature.ts`                                  |
| WSJF-Formel und Dialog                          | `src/modules/work/features/feature/components/wsjf-score-dialog.tsx`                    |
| Die Bänder — und die zwei Schwellensätze        | `src/modules/core/kernel/domain/wsjf.ts`, `src/modules/drumbeat/domain/wsjf.ts`         |
| Warum `feature.owner.assign` eigen ist          | `src/server/auth/policies/index.ts`                                                     |
| Warum es keine Feature-QS mehr gibt             | `src/modules/work/server/services/feature.ts`                                           |
| Abhängigkeiten: anlegen, verknüpfen, Typ, lösen | `src/modules/drumbeat/features/dependencies/actions/dependency.ts`                      |
| Die Fläche über alle PIs                        | `src/modules/drumbeat/features/dependencies/components/dependencies-overview-shell.tsx` |
| Das Cockpit und seine vier Ansichten            | `src/modules/drumbeat/features/cockpit/components/cockpit-shell.tsx`                    |
| Die Features-Übersicht quer                     | `src/modules/drumbeat/features/implementation/components/features-overview-shell.tsx`   |
| PI-Zuordnung eines Features                     | `src/modules/work/domain/feature-pi.ts`                                                 |
| Der Feature-Teilbaum eines Epics                | `src/modules/work/domain/feature-breakdown.ts`                                          |
| Practices `wsjf` und `dependencies`             | `src/modules/core/kernel/domain/operating-model.ts`                                     |
| Was welche Rolle darf                           | `src/server/auth/policies/index.ts`                                                     |
