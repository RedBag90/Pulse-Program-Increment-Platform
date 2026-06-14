import { redirect } from "next/navigation";

/**
 * Legacy-Detail-Route fuer das alte Ziele-Modul. Strategische Ziele
 * leben jetzt unter `/ziele`; ohne Detail-Sub-Route, weil dort der
 * Slide-Over-Drawer die Detail-Sicht liefert. Alte Deeplinks landen
 * auf der Modul-Startseite.
 */
export default function LegacyZieleDetailPage() {
  redirect("/ziele");
}
