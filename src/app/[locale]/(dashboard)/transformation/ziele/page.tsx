import { redirect } from "next/navigation";

/**
 * Legacy-Route fuer das alte Ziele-Modul (`TransformationGoal`-basiert).
 * Nach P0–P5 lebt der ganze Strategie-Stack unter `/ziele` (V2:
 * Vision → Theme → Objective → KR mit €-Rollup). Alte Deeplinks
 * landen ueber diesen Redirect am neuen Modul.
 *
 * Der Schema-Drop fuer `TransformationGoal` / `TargetOutcome` /
 * `GoalEpicLink` ist bewusst eine separate Story (Rest-Backlog),
 * weil `/transformation` (Maturity-Cockpit) diese Tabellen heute
 * noch fuer seine Strategischen-Ziele-Karten liest.
 */
export default function LegacyZielePage() {
  redirect("/ziele");
}
