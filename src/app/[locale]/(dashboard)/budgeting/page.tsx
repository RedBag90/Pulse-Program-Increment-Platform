import { redirect } from "next/navigation";

/**
 * Die Controlling-Übersicht ist in die Kachel und die Gallery aufgegangen.
 *
 * Sie zeigte eine Prozessleiste, deren sechs Schritte einen Ablauf beschrieben,
 * den es nicht mehr gab, und deren Links auf Redirects zeigten; dazu einen
 * „Verbleibend im Topf"-Wert aus einem Topf, den keine Oberfläche mehr pflegen
 * konnte. Ihre brauchbaren Zahlen stehen jetzt im Kopf der Gallery, ihr
 * Snapshot-Knopf im Ergebnis-Reiter der Kachel und ihre Guardrails wieder im
 * Portfolio. Der Redirect hält bestehende Deep-Links gültig.
 */
export default function ControllingOverviewRedirect() {
  redirect("/budgeting/periods");
}
