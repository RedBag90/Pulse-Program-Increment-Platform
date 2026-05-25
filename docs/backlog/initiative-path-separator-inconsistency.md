# Backlog: Materialized-Path-Trennzeichen sind inkonsistent (Epic→Feature)

**Status:** 🐞 Offener Defekt — entdeckt bei der Architektur-Review (2026-05-24).
Bewusst **nicht** als Teil eines verhaltenswahrenden Refactors behoben, weil ein
Fix eine Datenmigration der bestehenden `path`-Spalte braucht.

## Problem

Der materialisierte `path` einer Initiative wird je Ebene unterschiedlich gebaut:

| Ebene   | Aufbau                               | Beispiel    | Quelle                      |
| ------- | ------------------------------------ | ----------- | --------------------------- |
| Epic    | eigene id                            | `E`         | `epic.ts` (`path: epic.id`) |
| Feature | `${epic.path}.${feature.id}` (Punkt) | `E.F`       | `feature.ts:98`             |
| Story   | `${parent.path}/${uuid}` (Slash)     | `E.F/s1`    | `initiative-write.ts:70`    |
| Task    | `${parent.path}/${uuid}` (Slash)     | `E.F/s1/t1` | `initiative-write.ts:70`    |

Die Descendants-API filtert mit **Slash**:
`path: { startsWith: \`${root.path}/\` }` (`app/api/v1/initiatives/[id]/descendants/route.ts:30`).

**Folge:** Für eine **Epic**-Wurzel (`path = "E"`) sucht die Query `startsWith("E/")`.
Features haben aber `path = "E.F"` (Punkt) → matchen **nicht** → der gesamte
Teilbaum unter einem Epic fehlt im Ergebnis. Feature→Story/Task funktioniert
(beide Slash).

## Fix-Skizze (eigenes Ticket)

1. Ein einheitliches Pfad-Format festlegen (ein Trennzeichen, ein Segment-Typ —
   z. B. durchgehend `/${id}` über alle Ebenen) und `createChildInitiative` als
   einzigen Pfad-Bauer für **alle** Ebenen verwenden (inkl. Feature — schließt
   die Lücke aus ADR-0002-Nachbarschaft/„Feature umgeht das Skelett").
2. **Datenmigration** der bestehenden `path`-Werte auf das neue Format.
3. Integrationstests gegen die Test-DB (Descendants über alle Ebenen) als Netz —
   lokal nur mit `supabase start` + `DATABASE_URL_TEST` lauffähig.

Bis dahin: Descendants-Endpoint für Epic-Wurzeln liefert unvollständige Bäume.
