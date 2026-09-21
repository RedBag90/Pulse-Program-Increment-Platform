/**
 * **Was ein Seeder von aussen bekommt.**
 *
 * Bis September 2026 war jeder Seed eine `main()` ohne Export: der Mandant stand
 * fest, die Ids waren global (`uid("vs:digital-banking")` ist immer dieselbe
 * UUID), und der Prisma-Client kam aus dem Modul. Damit liess sich derselbe
 * Datensatz genau **einmal** anlegen.
 *
 * Diese drei Dinge sind jetzt Parameter. Der Seeder beschreibt nur noch, **was**
 * entsteht; **wo** und **unter welchen Ids** entscheidet der Aufrufer — die
 * Kommandozeile für ihren angestammten Mandanten, die Plattform-Verwaltung für
 * einen frisch angelegten.
 */

import type { PrismaClient } from "../src/generated/prisma/index.js";
import type { Uid } from "./seed-ids.js";

/**
 * Die Personen, die ein Datensatz braucht — als Griffe, nicht als
 * E-Mail-Adressen. Wer dahinter steckt, entscheidet der Aufrufer: die
 * Kommandozeile die `@pulse.dev`-Konten, die Plattform-Verwaltung frisch
 * erzeugte Testnutzer.
 */
export const SEED_USER_HANDLES = [
  "admin",
  "portfolio",
  "vmo",
  "rte",
  "owner",
  "viewer",
  "vso",
  "fo",
  "transformation",
] as const;

export type SeedUserHandle = (typeof SEED_USER_HANDLES)[number];
export type SeedUsers = Readonly<Record<SeedUserHandle, string>>;

export interface SeedContext {
  /**
   * **Injiziert, nicht aus `seed-helpers` geholt.** Der dortige Client entsteht
   * beim Import aus `DIRECT_URL` — ein Seeder, der ihn anfasst, ist aus der App
   * heraus nicht importierbar.
   */
  db: PrismaClient;
  tenantId: string;
  /** Aus `uidFor(namespace)`. Leerer Namensraum = die angestammten Ids. */
  uid: Uid;
  users: SeedUsers;
}

/** Was ein Lauf angelegt hat — für die Rückmeldung an die Fläche. */
export interface SeedSummary {
  valueStreams: number;
  arts: number;
  epics: number;
  features: number;
  objectives: number;
}

/**
 * Füllt fehlende Griffe mit einer Ersatzperson auf.
 *
 * Die Kommandozeile liefert alle neun; ein frisch angelegter Mandant hat
 * vielleicht nur zwei Testnutzer. Dann tragen mehrere Griffe dieselbe Person —
 * **nicht** eine erfundene Id, die auf kein Konto zeigt und in jeder
 * Namensauflösung als Leerstelle auftaucht.
 */
export function fillSeedUsers(
  partial: Partial<Record<SeedUserHandle, string>>,
  fallback: string,
): SeedUsers {
  return Object.fromEntries(SEED_USER_HANDLES.map((h) => [h, partial[h] ?? fallback])) as SeedUsers;
}
