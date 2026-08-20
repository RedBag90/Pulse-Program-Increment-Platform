import { redirect } from "next/navigation";

/**
 * `/budgeting/board` ist in `/budgeting/round` (die vereinte Budget-Runde)
 * aufgegangen. Bestehende Deep-Links bleiben über diesen Redirect gültig.
 */
export default function BudgetingBoardRedirect() {
  redirect("/budgeting/round");
}
