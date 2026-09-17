/**
 * **Die Facetten der Ziele-Fläche** — die eine Stelle, die sie aufzählt.
 *
 * Es sind dieselben vier, die schon in der URL stehen und serverwirksam sind
 * (`ziele/page.tsx`, `goal-scope-filter-bar.tsx`, `loadStrategyTree`). Ein
 * gespeicherter Filter trägt genau diese Schlüssel.
 *
 * Bewusst **nicht** dabei: Sortierung, „nur off-track" und eingeklappte Knoten.
 * Die liegen in React-State, nicht in der URL — sie zu speichern hiesse erst,
 * drei Doppelungen aufzulösen (`offTrackOnly` gibt es in Tabelle und Netzplan
 * getrennt, `collapsed` dreifach).
 *
 * **Warum hier und nicht bei den Actions:** eine `"use server"`-Datei darf nur
 * async-Funktionen exportieren. Ein Array daraus zu exportieren lässt zwar
 * `tsc`, ESLint und die Testsuite unberührt, bricht die Seite aber zur
 * Laufzeit. Das Portfolio-Gegenstück (`PORTFOLIO_FILTER_KEYS`) entgeht dem aus
 * demselben Grund: es steht im Service, nicht in den Actions.
 */
export const GOAL_FILTER_KEYS = ["period", "vs", "art", "status"] as const;
