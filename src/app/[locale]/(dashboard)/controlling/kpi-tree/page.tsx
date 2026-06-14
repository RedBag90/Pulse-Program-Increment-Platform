import { redirect } from "next/navigation";

/**
 * Legacy-Route. KPI-Wertbeitrag zeigte den TransformationGoal/
 * TargetOutcome-Baum, der nach der Hierarchie-Vereinfachung (Themes
 * = OKRs in V2) keine Pflege-Surface mehr hat. Die Bewertungs-Pflege
 * (valuePerUnit + KR↔KPI-Bindungen) lebt vollstaendig in
 * `/controlling/kpi-coverage`; alte Deeplinks landen dort.
 */
export default function LegacyKpiTreePage() {
  redirect("/controlling/kpi-coverage");
}
