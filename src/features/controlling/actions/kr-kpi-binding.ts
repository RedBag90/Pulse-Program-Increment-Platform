/**
 * Controlling-Surface fuer KR↔KPI-Bindungen (Refactor-Plan §B).
 *
 * Re-exportiert die Actions, die heute noch in `features/ziele/actions`
 * leben. Logisch gehoeren sie zum Controlling — der Strategie-Drawer
 * ruft sie nicht mehr direkt; ein spaeterer Move kann die
 * Datei-Hierarchie nachziehen. Heute reicht der Re-Export, damit der
 * Coverage-View nur Controlling-Imports hat und die Strategie-Pflege
 * keine Kopplung mehr zur Bindungs-Action behaelt.
 */
export { bindKpiAction, unbindKpiAction } from "@/features/ziele/actions/ziele";
