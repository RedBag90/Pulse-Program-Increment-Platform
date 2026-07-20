# Backlog — Ziele-Adaption nach Asana-Vorbild

> Adaptionspfad der Asana-Goals-Funktionen für Pulse, zerlegt in **Epic → Feature → Story**.
> Grundlage: die Funktionsreferenz + Gap-Map (Plan-Dokument). Statusmodell, Verlaufschart und
> Aktivitäts-/Kommentar-Feed sind bereits gebaut (Fundament).

## So liest du dieses Backlog

- **Epic** = eine Roadmap-Stufe. Trägt Priorität (Now/Next/Later), Aufwand (S/M/L), Abhängigkeit und Asana-Mapping.
- **Feature** = auslieferbarer Teil eines Epics.
- **Story** = `Als <Rolle> möchte ich <Ziel>, damit <Nutzen>` + **Akzeptanzkriterien (AK)**.

**Rollen:** Ziel-Owner · Portfolio-Manager/LPM (`target.manage`) · Controller (KPI-Bewertung) · Stakeholder (read-only) · Admin (Tenant) · Entwickler (technische Enabler).

**Aufwand:** S = klein · M = mittel · L = größer. **Alle Epics sind eigenständig lieferbar.**

**Fundament (bereits gebaut, nicht Teil des Backlogs):** Open/Closed-Status (3+4) · Status ⟂ Fortschritt getrennt · Check-in-Historie + Verlaufschart + Feed · manuelle Progress-Updates · Metriktyp „Zahl" · Grid-Liste mit Statuspills.

**Vor dem Bauen:** Der adversariale Verify-Pass der Recherche fiel aus (Rate-Limit). Konkrete Zahlen (Item-Limits), Kadenzen und Custom-Weights-Verhalten je Epic kurz an der Asana-Primärquelle gegenprüfen.

---

## EPIC 1 — Metriktypen Prozent & Währung

**Priorität:** Now · **Aufwand:** S–M · **Abhängigkeit:** — · **Asana-Mapping:** `goal.metric.unit` (percentage · number · currency), `precision`, `currency_code`

Heute kennt ein Key Result nur „Zahl" (baseline/target/current). Asana bietet drei Metriktypen. Diese Stufe ergänzt Prozent und Währung — kleiner Eingriff, hoher Nutzen.

### Feature 1.1 — Metriktyp am Key Result wählen

- **Story 1.1.1** — Als **Ziel-Owner** möchte ich beim Anlegen/Bearbeiten eines Key Results den Metriktyp (Zahl, Prozent, Währung) wählen, damit die Kennzahl zur Realität passt.
  - AK: Auswahl `unit ∈ {number, percent, currency}`, Default `number`.
  - AK: Bei `currency` erscheint eine Pflicht-Währungsauswahl (ISO-4217, z. B. EUR).
  - AK: `unit`/`precision`/`currencyCode` werden am KeyResult persistiert; `pnpm tsc --noEmit` + `pnpm lint` grün.
- **Story 1.1.2** — Als **Ziel-Owner** möchte ich die Nachkomma-Genauigkeit (0–6) festlegen, damit Werte konsistent gerundet dargestellt werden.
  - AK: `precision` 0..6 wählbar, Default 0.
  - AK: Wirkt auf Dialog, „Current value"-Karte und Chart.

### Feature 1.2 — Ein-/Ausgabe & Chart nach Einheit formatieren

- **Story 1.2.1** — Als **Stakeholder** möchte ich Current/Target/Progress in der korrekten Einheit sehen (%, €, Zahl), damit ich die Kennzahl richtig interpretiere.
  - AK: „Current value"-Karte, Progress-Dialog und Chart-Achse/Tooltip formatieren nach `unit`+`precision`.
  - AK: `percent` → Suffix „%"; `currency` → Symbol/Code; `number` unverändert.
- **Story 1.2.2** — Als **Ziel-Owner** möchte ich bei Prozent-KRs den Fortschritt direkt als % eingeben, damit ich nicht über baseline/target rechnen muss.
  - AK: Bei `unit=percent` sind baseline 0 / target 100 vorbelegt (überschreibbar).
  - AK: Eingabe akzeptiert 0..100; die vorhandene Normalisierung nutzt weiterhin `(value − baseline)/(target − baseline)`.

---

## EPIC 2 — Objective-Rollup als echte Metrik

**Priorität:** Now · **Aufwand:** M · **Abhängigkeit:** Epic 1 (Einheiten) · **Asana-Mapping:** Sub-Goal-Aggregation (Prozent = Ø, Zahl/Währung = Summe)

Heute leitet das Objective seinen Fortschritt gemischt aus dem €-Trio ab. Asana aggregiert klar: Prozent als Durchschnitt, Zahl/Währung als Summe der Kinder.

### Feature 2.1 — Aggregation aus Key Results

- **Story 2.1.1** — Als **Portfolio-Manager** möchte ich, dass sich der Objective-Fortschritt automatisch aus seinen Key Results berechnet, damit ich Werte nicht doppelt pflege.
  - AK: Prozent-KRs → arithmetischer Durchschnitt; Zahl/Währung → Summe.
  - AK: Gemischte Einheiten → definierte Regel (normalisierter Durchschnitt 0..1) dokumentiert im Code-Kommentar.
  - AK: Ersetzt die heutige gemischte €-Ableitung; keine Regression der €-Trio-Anzeige.
- **Story 2.1.2** — Als **Entwickler** möchte ich die Aggregation in einer Domänen-Funktion kapseln, damit Liste, Drawer und Portfolio-Overview dieselbe Zahl zeigen.
  - AK: Eine Rollup-Funktion (Domäne), genutzt von `ziele-view` und `portfolio-overview`.
  - AK: Unit-Tests für Ø / Summe / gemischt / leer.

### Feature 2.2 — Konsistente Anzeige

- **Story 2.2.1** — Als **Stakeholder** möchte ich den aggregierten Objective-Fortschritt in Liste und Detail identisch sehen, damit es keine widersprüchlichen Werte gibt.
  - AK: `strategy-table-view` Progress-Spalte, Detail-Karte „Goal completion" und Chart nutzen denselben Rollup.
  - AK: Sichtprüfung: Werte stimmen überein.

---

## EPIC 3 — Gewichtete Rollups

**Priorität:** Next · **Aufwand:** M · **Abhängigkeit:** Epic 2 · **Asana-Mapping:** `contribution_weight` / Custom Weights (`is_custom_weight`)

### Feature 3.1 — Gewicht je Key Result

- **Story 3.1.1** — Als **Portfolio-Manager** möchte ich einzelnen Key Results ein Gewicht geben, damit wichtigere KRs den Objective-Fortschritt stärker beeinflussen.
  - AK: `weight` je KR pflegbar; Normalisierung der Summe; Default gleichgewichtet.
  - AK: Persistiert; leeres/gleiches Gewicht ⇒ Verhalten identisch zu Epic 2.
- **Story 3.1.2** — Als **Entwickler** möchte ich gewichteten und ungewichteten Rollup über denselben Pfad rechnen, damit „alle Gewichte gleich" exakt dem ungewichteten Ergebnis entspricht.
  - AK: Ein Berechnungspfad mit optionalem Gewichtsvektor; Test: gleiche Gewichte = Epic-2-Ergebnis.

### Feature 3.2 — Transparenz

- **Story 3.2.1** — Als **Stakeholder** möchte ich sehen, mit welchem Gewicht ein KR beiträgt, damit der Rollup nachvollziehbar ist.
  - AK: Gewicht in KR-Zeile/Detail sichtbar; Tooltip „trägt X % bei".

---

## EPIC 4 — Status-Update-Composer

**Priorität:** Next · **Aufwand:** M · **Abhängigkeit:** — (nutzt vorhandenes `GoalCheckin`) · **Asana-Mapping:** Status-Update mit editierbaren Sektionen

Heute trägt ein Check-in nur eine einzelne Notiz. Asana erlaubt strukturierte Updates mit mehreren Sektionen.

### Feature 4.1 — Strukturiertes Update erfassen

- **Story 4.1.1** — Als **Ziel-Owner** möchte ich beim Status-Check-in mehrere Abschnitte (z. B. Zusammenfassung, Risiken, nächste Schritte) erfassen, damit mein Update aussagekräftig ist.
  - AK: Composer mit hinzufügbaren/entfernbaren Sektionen (Titel + Text); mindestens Freitext möglich.
  - AK: Speichert strukturiert am `GoalCheckin` (erweitertes Feld/JSON); Status bleibt Pflicht.
  - AK: Rückwärtskompatibel: alte reine Notizen laden weiterhin.

### Feature 4.2 — Update im Feed rendern

- **Story 4.2.1** — Als **Stakeholder** möchte ich im Aktivitäts-Feed das ausformulierte Update lesen, damit ich den Kontext zum Status verstehe.
  - AK: `goal-activity-feed` rendert Sektionen (Titel hervorgehoben + Text).
  - AK: Alte Notes erscheinen unverändert als einzelner Abschnitt.

---

## EPIC 5 — Related Work

**Priorität:** Next · **Aufwand:** M · **Abhängigkeit:** — · **Asana-Mapping:** „Related work" (Tasks · Projekte · Portfolios), rein referenziell

### Feature 5.1 — Arbeit mit einem Ziel verknüpfen

- **Story 5.1.1** — Als **Portfolio-Manager** möchte ich einem Ziel Features/Epics/PIs referenziell zuordnen, damit der Bezug zwischen Strategie und Umsetzung sichtbar wird.
  - AK: Verknüpfung **ohne** Fortschrittsbeitrag; n:m über Join-Tabelle `goal_related_work` (`kind` + `refId`).
  - AK: Hinzufügen/Entfernen im Ziel-Drawer; Duplikate verhindert.

### Feature 5.2 — Anzeige & Navigation

- **Story 5.2.1** — Als **Stakeholder** möchte ich die verknüpfte Arbeit am Ziel sehen und dorthin navigieren, damit ich vom Ziel direkt zur Umsetzung komme.
  - AK: „Related work"-Sektion im Drawer mit Titel + Status des Zielobjekts.
  - AK: Deeplink zu Feature/Epic/PI.

---

## EPIC 6 — Verantwortungs-Zuordnung + Zugriffsstufen

**Priorität:** Later · **Aufwand:** L · **Abhängigkeit:** — · **Asana-Mapping:** Accountable Team + Access Levels (Admin/Editor/Viewer)

Statt Asanas „Accountable Team" nutzt Pulse seine echten Organisationsebenen: **optionale** Zuordnung auf **Wertstrom und/oder ART, jeweils n:m**.

### Feature 6.1 — Optionale Zuordnung auf Wertstrom/ART

- **Story 6.1.1** — Als **Portfolio-Manager** möchte ich einem Ziel optional einen oder mehrere Wertströme und/oder ARTs zuordnen, damit die Verantwortung sichtbar ist.
  - AK: Zuordnung ist optional (leer erlaubt).
  - AK: n:m über `goal_value_streams` und `goal_arts` (zwei Join-Tabellen).
  - AK: Auswahl-UI im Drawer; Anzeige als Chips (Wertstrom-/ART-Name).
- **Story 6.1.2** — Als **Stakeholder** möchte ich Ziele nach Wertstrom/ART filtern, damit ich nur die für mich relevanten sehe.
  - AK: Filter in der Ziele-Liste nach Wertstrom und ART; kombinierbar.

### Feature 6.2 — Zugriffsstufen pro Ziel

- **Story 6.2.1** — Als **Admin** möchte ich pro Ziel Editor-/Viewer-Rechte vergeben, damit nur Berechtigte ein Ziel bearbeiten.
  - AK: Zugriffsstufen Admin/Editor/Viewer je Ziel.
  - AK: Editier-Affordances hängen an der Stufe; löst globales `target.manage` schrittweise ab.
  - AK: Default = heutiges Verhalten (kein Rechteverlust bei Migration).

---

## EPIC 7 — Custom Fields an Zielen

**Priorität:** Later · **Aufwand:** L · **Abhängigkeit:** — · **Asana-Mapping:** Custom Fields on Goals + „Show or hide fields"

### Feature 7.1 — Feld-Definition (Tenant)

- **Story 7.1.1** — Als **Admin** möchte ich benutzerdefinierte Felder für Ziele definieren (Text, Zahl, Auswahl), damit wir eigene Attribute erfassen können.
  - AK: Feldtypen Text/Zahl/Single-Select; Tenant-scoped Definition; CRUD.

### Feature 7.2 — Werte am Ziel + Sichtbarkeit

- **Story 7.2.1** — Als **Ziel-Owner** möchte ich Custom-Field-Werte am Ziel pflegen, damit zusätzliche Infos am Ziel hängen.
  - AK: Werte je Ziel; Validierung nach Feldtyp.
- **Story 7.2.2** — Als **Stakeholder** möchte ich Felder in der Liste ein-/ausblenden, damit ich meine Sicht anpasse.
  - AK: „Felder ein-/ausblenden"; Auswahl pro Nutzer persistiert.

---

## EPIC 8 — Strategy Map (ziel-zentriert)

**Priorität:** Later · **Aufwand:** L · **Abhängigkeit:** Epic 2 (Fortschritt), Epic 6 (Scope-Filter, optional) · **Asana-Mapping:** Goals Strategy Map

Die vorhandene `strategy-network-view` (ReactFlow) wird zur status-/fortschrittsgetriebenen Map ausgebaut.

### Feature 8.1 — Status-/Fortschritts-Karten

- **Story 8.1.1** — Als **LPM** möchte ich Ziele als Map mit Status und Fortschritt sehen, damit ich die strategische Lage auf einen Blick erfasse.
  - AK: Jeder Knoten zeigt Statuspill + Fortschritt; Farben aus `goal-status`.

### Feature 8.2 — Interaktion

- **Story 8.2.1** — Als **LPM** möchte ich Hierarchie-Knoten auf-/zuklappen und die Anzahl beitragender Elemente sehen, damit große Maps handhabbar bleiben.
  - AK: Expand/Collapse; Count-Badge; erscheint nur, wenn Beiträge existieren.
- **Story 8.2.2** — Als **LPM** möchte ich per Klick ein Side-Pane mit Ziel-Details öffnen, damit ich ohne Seitenwechsel Details sehe.
  - AK: Klick → Side-Pane/Drawer mit Kernmetadaten + Link zum Ziel.

---

## EPIC 9 — Reminder & Grading-Erinnerungen _(zurückgestellt)_

**Priorität:** — (vorerst nicht benötigt) · **Aufwand:** M · **Abhängigkeit:** Scheduler · **Asana-Mapping:** Update-Reminder-Kadenz + End-of-Period-Grading

> Auf Wunsch zurückgestellt. Hier nur skizziert, damit der Umfang dokumentiert ist.

### Feature 9.1 — Owner-Erinnerungen (Kadenz)

- **Story 9.1.1** — Als **Ziel-Owner** möchte ich eine Erinnerungs-Kadenz (z. B. wöchentlich/monatlich) setzen, damit ich Status-Updates nicht vergesse.
  - AK: Kadenz konfigurierbar; Erinnerung an den Owner; ⚠ Kadenz-Werte vorab an Asana-Quelle verifizieren.

### Feature 9.2 — Grading zum Periodenende

- **Story 9.2.1** — Als **Ziel-Owner** möchte ich zum Ende der Zeitperiode erinnert werden, das Ziel zu bewerten und zu schließen, damit offene Ziele nicht liegenbleiben.
  - AK: Erinnerung nahe Periodenende; Aktion „bewerten & schließen" (Closed-Status setzen).

---

## Umsetzungs-Reihenfolge (Zusammenfassung)

| #   | Epic                           | Priorität      | Aufwand | Abhängigkeit |
| --- | ------------------------------ | -------------- | ------- | ------------ |
| 1   | Metriktypen % & Währung        | Now            | S–M     | —            |
| 2   | Objective-Rollup (Ø/Summe)     | Now            | M       | 1            |
| 3   | Gewichtete Rollups             | Next           | M       | 2            |
| 4   | Status-Update-Composer         | Next           | M       | —            |
| 5   | Related Work                   | Next           | M       | —            |
| 6   | Verantwortung + Zugriffsstufen | Later          | L       | —            |
| 7   | Custom Fields                  | Later          | L       | —            |
| 8   | Strategy Map (ziel-zentriert)  | Later          | L       | 2 (·6)       |
| 9   | Reminder & Grading             | zurückgestellt | M       | Scheduler    |
