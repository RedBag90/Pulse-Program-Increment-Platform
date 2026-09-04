import { redirect } from "next/navigation";

/**
 * Aufgegangen in `/budgeting/value-streams`: dieselben Positionen, aber mit
 * Detailebene, Halbjahres-Fenster, dem Leitfaden und einem Nav-Eintrag.
 *
 * Der Redirect bleibt, weil die Setup-Fläche einer Kachel hierher verlinkt.
 */
export default function RunTheBusinessRedirect() {
  redirect("/budgeting/value-streams");
}
