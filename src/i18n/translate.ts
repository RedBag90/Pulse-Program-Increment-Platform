/**
 * **Was eine reine Funktion vom Katalog braucht.**
 *
 * `useTranslations` ist ein React-Hook; `getTranslations` braucht einen
 * Request. Beides steht der Domäne nicht zur Verfügung, und genau daran
 * scheiterte die Zweisprachigkeit bisher an jeder Fläche, die kein Bildschirm
 * ist: der PDF-Bericht, die E-Mail-Vorlagen, die Fehlermeldungen der Services.
 *
 * Die Antwort ist kein zweiter Katalog, sondern ein Parameter. Wer eine
 * Domänen-Funktion aufruft, hat einen Übersetzer — der Aufrufer sitzt immer
 * entweder in einer Komponente oder in einem Request. Er reicht ihn herein;
 * die Funktion bleibt rein und lässt sich mit `(k) => k` prüfen, ohne dass ein
 * Katalog geladen werden muss.
 *
 * Absichtlich das kleinste Stück von `next-intl`s `t`, das trägt: ein
 * Schlüssel, ein Wort. Wer Platzhalter braucht, reicht den zweiten Parameter
 * durch — mehr nicht, damit diese Naht nicht zur zweiten Katalog-API wird.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Der Übersetzer für Tests und Momentaufnahmen: gibt den Schlüssel zurück.
 *
 * Eine Zusicherung auf `"goals.status.onTrack"` bleibt richtig, wenn jemand das
 * Wort ändert — und wird rot, wenn jemand den Schlüssel ändert. Genau die
 * Empfindlichkeit, die ein Test haben soll.
 */
export const identityTranslate: Translate = (key) => key;
