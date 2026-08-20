import { redirect } from "next/navigation";

/**
 * Das frühere ART-scoped PI-Planning ist im Delivery-Cockpit aufgegangen
 * (`/umsetzung`, PI als Scope). Weicher Redirect für Bookmarks/externe Links —
 * das Cockpit listet alle PIs des Scopes im Strip als Sprungziele.
 */
export default function PiPlanningRedirectPage() {
  redirect("/umsetzung");
}
