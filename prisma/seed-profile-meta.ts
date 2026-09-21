/**
 * **Wie die Datensätze heissen — ohne einen davon mitzubringen.**
 *
 * Bewusst **ohne einen einzigen Import**. Die Auswahlfelder in der
 * Plattform-Verwaltung sind Client-Bauteile; zögen sie die Liste aus
 * `seed-profiles.ts`, kämen die drei Seeder mit — rund sechstausend Zeilen
 * Server-Code samt Prisma-Typen in den **Browser**. Genau das ist passiert und
 * fiel nur deshalb auf, weil der Webpack-Build vorher an einer Dateiendung
 * scheiterte.
 *
 * Hier stehen Name und Beschreibung, in `seed-profiles.ts` steht, was läuft.
 */

export const SEED_PROFILES = ["none", "skeleton", "dense", "large"] as const;
export type SeedProfile = (typeof SEED_PROFILES)[number];

export interface SeedProfileMeta {
  id: SeedProfile;
  label: string;
  /** Was drinsteht — die Fläche zeigt es unter der Auswahl. */
  description: string;
  /**
   * Grob, wie viel entsteht. Nicht für die Anzeige, sondern für die
   * Entscheidung, ob ein Profil im Request laufen darf.
   */
  scale: "none" | "small" | "medium" | "large";
}

export const SEED_PROFILE_META: readonly SeedProfileMeta[] = [
  {
    id: "none",
    label: "Kein Datensatz",
    description: "Nur der Mandant. Wertströme, ARTs und Vorhaben legst du selbst an.",
    scale: "none",
  },
  {
    id: "skeleton",
    label: "Gerüst",
    description:
      "Ökonomie, Guardrail-Ziele, Practices, Rollen und Nummernkreis — keine Fachdaten. " +
      "Der Mandant, in dem man mit echten Daten anfangen kann.",
    scale: "small",
  },
  {
    id: "dense",
    label: "Dicht",
    description:
      "3 Wertströme, 6 ARTs, 2 Zeitleisten, Epics über alle Reifegrade, Features, " +
      "Ziele, Budget und Risiken. Der Datensatz zum Vorführen.",
    scale: "medium",
  },
  {
    id: "large",
    label: "Groß",
    description:
      "Sechs durchgespielte Halbjahre mit Budgetrunden — hunderte Epics und Features. " +
      "Für Last und für Auswertungen über Zeit.",
    scale: "large",
  },
];
