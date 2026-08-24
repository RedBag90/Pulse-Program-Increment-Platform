import { redirect } from "next/navigation";

/**
 * Alt-Route des €/ART-Detailplanungs-Boards. Ersetzt durch das Kachel-Modell
 * (`/budgeting/periods`); die ART-Budget-Pflege lebt weiter auf der
 * Value-Stream-Detailseite. Redirect hält Deep-Links gültig.
 */
export default function LegacyBudgetBoardRedirect() {
  redirect("/budgeting/periods");
}
