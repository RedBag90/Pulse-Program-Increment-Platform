/**
 * **Was hinter einem Schalter liegt, ist abwesend — nicht leer.**
 *
 * Ein Modul oder eine Practice kann aus sein. Die Lesesicht liefert dann
 * nichts. Die naheliegende Schreibweise dafür ist `T | null` — und genau die
 * hat hier schon zweimal denselben Fehler erzeugt, weil *abwesend* und
 * *vorhanden, aber leer* dieselbe Gestalt haben:
 *
 *  - **September 2026, Abhängigkeiten.** Ein Mandant mit Work ohne Drumbeat
 *    legte eine Kante an, bekam die Bestätigung, und der nächste
 *    `router.refresh()` lieferte `[]` zurück: die Kante war geschrieben und
 *    wurde weggelesen. Der Schreibweg ging durch die Modul-Schranke, der
 *    Leseweg hing an einer abgeschalteten Scheibe.
 *  - **September 2026, Einordnung.** Dasselbe eine Ebene weiter: das
 *    Auswahlfeld stand **vor** der Practice-Bedingung, seine Lesestelle
 *    dahinter. `classification?.intended ?? null` ist ein einwandfrei
 *    typisierter Ausdruck — er macht aus „die Practice ist aus" ein „noch
 *    nicht eingeordnet". Gespeichert wurde, angezeigt nicht.
 *
 * Beide Male war die Ursache dieselbe: der Compiler konnte nicht sehen, dass
 * ein Fall unbehandelt blieb, weil es gar keinen zweiten Fall gab.
 *
 * `Gated<T>` gibt ihm einen. Wer die Daten will, muss `disabled` prüfen —
 * `?.feld ?? null` kompiliert nicht mehr. Die Regel, die vorher nur als
 * Kommentar existierte, ist damit etwas, das man importiert.
 *
 * ```ts
 * export type BudgetingSlice = Gated<{ allocated: boolean }>;
 *
 * if (slice.disabled) return null;   // ← ohne diese Zeile: Typfehler
 * slice.allocated;
 * ```
 *
 * **Die Regel in einem Satz:** ist die Fähigkeit aus, liefert der Lader leere
 * Port-Ergebnisse **und** der Erbauer `{ disabled: true }` — nie eine Scheibe
 * mit `disabled: false` und leerem Inhalt. Eine leere Liste heisst „nichts
 * da"; `disabled` heisst „die Frage stellt sich nicht".
 */
export type Gated<T> = { disabled: true } | ({ disabled: false } & T);

/** Der Inhalt einer eingeschalteten Scheibe — für Aufrufer, die ihn benennen müssen. */
export type GatedOn<T> = Extract<Gated<T>, { disabled: false }>;
