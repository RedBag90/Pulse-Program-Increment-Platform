import { redirect } from "next/navigation";

/**
 * Legacy-Route. Participatory Budgeting lebt jetzt unter
 * `/controlling/budgeting` — siehe Modul-Refactor-Plan §C
 * (Budgeting ist eine Controlling-Aufgabe, nicht Portfolio-Sicht).
 */
export default function LegacyPortfolioBudgetingPage() {
  redirect("/controlling/budgeting");
}
