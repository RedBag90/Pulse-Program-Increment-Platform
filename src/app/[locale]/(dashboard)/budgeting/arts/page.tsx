import { redirect } from "next/navigation";

/**
 * **Die ART-Budget-Liste gibt es nicht mehr.**
 *
 * Sie sollte „alle meine ARTs, über Wertströme hinweg" beantworten — die Frage
 * eines RTE, der Züge in zwei Strömen betreut. `art-budget-consolidation.md`
 * §2.3 hatte sie deshalb ausdrücklich behalten.
 *
 * **Diese Entscheidung ist am 2026-09-19 zurückgenommen worden**: RTEs gehen
 * durch ihren Wertstrom. Damit trug die Liste nichts mehr, was die Geldfläche
 * des Wertstroms nicht zeigt — sie war ein zweiter Nav-Eintrag zu demselben
 * Geld, und genau dagegen ist die Spec geschrieben.
 *
 * Die Route bleibt als Wegweiser stehen, nicht aus Nostalgie: sie stand ein Jahr
 * lang im Menü, und eine Adresse, die gestern funktionierte, soll heute nicht
 * ins Leere laufen. Sie lädt nichts und revalidiert nichts.
 */
export default function BudgetingArtsRedirectPage() {
  redirect("/budgeting/value-streams");
}
