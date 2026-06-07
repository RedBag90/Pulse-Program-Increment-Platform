import { redirect } from "next/navigation";

/**
 * Roadmap-P3.B: das fruehere RTE-Cockpit ist in den Umsetzungs-Hub und
 * den ART-Hub eingezogen. Diese Route bleibt als weicher Redirect
 * erhalten, damit Bookmarks und externe Links nicht brechen — der
 * Cross-ART-Eintritt liegt im Hub, pro-ART-Details im ART-Hub.
 */
export default function RteRedirectPage() {
  redirect("/umsetzung");
}
