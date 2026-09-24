/**
 * Rest-Labels des Risiko-Moduls.
 *
 * Hier stand bis September 2026 die Kategorie-Beschriftung; sie ist zu ihrer
 * Aufzählung gezogen (`domain/risk-category.ts`), weil die Gruppierung der
 * Tabelle sie aus der Domäne heraus braucht. Die Achsen-Stufen liegen im Kernel
 * (`LEVEL_KEYS`). Übrig bleibt nichts, was nur hier hingehörte — die Datei
 * reicht die Kategorie-Labels weiter, damit vorhandene Importe nichts merken.
 */
export { CATEGORY_KEYS } from "@/modules/risks/domain/risk-category";
