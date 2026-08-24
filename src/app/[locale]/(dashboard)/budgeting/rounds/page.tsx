import { redirect } from "next/navigation";

/**
 * Alt-Route der geführten Drei-Zonen-Runde. Ersetzt durch das Kachel-Modell
 * (`/budgeting/periods`). Redirect hält Deep-Links gültig. Die eigentliche
 * Entfernung der Alt-UI + Legacy-Spalten erfolgt beim Schema-Push (Cutover).
 */
export default function LegacyBudgetRoundsRedirect() {
  redirect("/budgeting/periods");
}
