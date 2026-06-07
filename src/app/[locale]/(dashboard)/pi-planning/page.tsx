import { redirect } from "next/navigation";

/**
 * Roadmap-P2.B: das frühere ART-scoped PI-Planning ist in den PI-
 * Workspace eingezogen (`/umsetzung/pi/[id]?tab=plan`). Diese Route
 * bleibt als weicher Redirect erhalten, damit Bookmarks und externe
 * Links nicht brechen.
 *
 * Da der Workspace pro PI lebt und ein Bookmark auf `/pi-planning`
 * keinen PI mitgibt, leiten wir auf den Umsetzungs-Hub um — dort
 * sind alle PIs des Scopes als Sprungziele gelistet.
 */
export default function PiPlanningRedirectPage() {
  redirect("/umsetzung?tab=overview");
}
