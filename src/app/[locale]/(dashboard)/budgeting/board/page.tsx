import { redirect } from "next/navigation";

/**
 * Alt-Route des €-Boards. Sie zeigte bis zuletzt auf `/budgeting/round`, das
 * selbst nur weiterleitete — eine Kette aus zwei Sprüngen. Jetzt ein Sprung.
 */
export default function BudgetingBoardRedirect() {
  redirect("/budgeting/periods");
}
