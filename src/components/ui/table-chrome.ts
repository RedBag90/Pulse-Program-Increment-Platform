/**
 * Das Aussehen eines **klebenden Tabellenkopfes** — eine Zeile, ein Ort.
 *
 * Sie stand bis September 2026 viermal in der Anwendung, und die vierte Fassung
 * war der Fehler: der Kopf der Kachel „Epic-Beitrag zu Kopf-Zielen" trug
 * `bg-muted/30` ohne `z-20`, `backdrop-blur` und `shadow-sm`. Zu 30 % deckend
 * scheinen die Zeilen beim Scrollen hindurch — im Bild stand „EPIC" mitten im
 * Epic-Titel.
 *
 * ```
 * strategy-table-view     z-20 bg-muted/95 blur shadow   ✓
 * tree-table-style        dieselbe Zeile als Konstante   ✓
 * epic-business-case-calc z-10 bg-muted/80 blur          ~
 * goal-contribution-block ---- bg-muted/30 ----          ✗
 * ```
 *
 * `components/ui` ist die gemeinsame Schicht, aus der alle Module ohnehin
 * `Card`, `SectionLabel` und `ToggleGroup` beziehen — ADR-0013 bleibt unberührt.
 * Der Kommentar an `TREE_THEAD` begründet seine Dublette damit, **das
 * Ziele-Modul** nicht zu importieren; das gilt weiterhin und wird hier nicht
 * umgangen, sondern erfüllt.
 *
 * Bewusst **kein** Token für den Scroll-Container daneben: die vorhandenen
 * Fassungen unterscheiden sich echt (waagerecht gegen senkrecht, `rounded-lg`
 * gegen `rounded-xl`), und ein Token mit einem Aufrufer wäre Umweg statt
 * Teilung.
 */
export const STICKY_THEAD =
  "sticky top-0 z-20 border-b bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur";
