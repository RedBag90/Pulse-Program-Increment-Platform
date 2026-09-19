import { redirect } from "next/navigation";

/**
 * **Die flache Solutions-Liste ist eine Gruppierung geworden, keine Seite.**
 *
 * Sie stand bis September 2026 **ausserhalb** des Struktur-Rahmens und zeigte
 * dieselben Solutions wie der Baum daneben — nur ohne ihn. Wer aus dem Baum
 * hierher wechselte, verlor Pfad und Auswahl. Was sie als Einzige konnte, war
 * die Ordnung **nach dem Stand** statt nach der Zugehörigkeit; genau das ist
 * jetzt `?view=tabelle&nach=horizont` auf der einen Fläche.
 *
 * Die Adresse bleibt, weil viel an ihr hängt: fünf Wiki-Stationen, der Eintrag
 * „Solution" im globalen „+"-Menü, ein Absprung aus dem Epic-Detail und zwei
 * Revalidierungs-Gruppen. **`?create=solution` wird mitgenommen** — sonst ginge
 * der Anlege-Dialog nach der Weiterleitung nicht mehr auf.
 */
export default async function SolutionsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string; q?: string }>;
}) {
  const { create, q } = await searchParams;
  const params = new URLSearchParams({ view: "tabelle", nach: "horizont" });
  if (create) params.set("create", create);
  if (q) params.set("q", q);
  redirect(`/structure?${params.toString()}`);
}
