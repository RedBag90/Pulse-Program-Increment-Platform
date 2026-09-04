import { redirect } from "next/navigation";

/**
 * Legacy-Route. Budgeting ist eine Controlling-Aufgabe (kein Portfolio-Tab) und
 * lebt jetzt unter `/budgeting`. Der Einstieg in den Prozess ist die geführte
 * Budget-Runde — daher direkt dorthin (kein Doppel-Hop über `/budgeting/board`).
 */
export default function LegacyPortfolioBudgetingPage() {
  redirect("/budgeting/periods");
}
