/**
 * **Welcher Datensatz wie läuft — die Server-Hälfte des Registers.**
 *
 * Name und Beschreibung stehen in `seed-profile-meta.ts` und sind importierbar,
 * ohne etwas mitzubringen. Hier kommt `run` dazu, und damit die drei Seeder.
 * **Diese Datei gehört deshalb auf den Server** — ein Client-Bauteil, das sie
 * anfasst, zieht sechstausend Zeilen in den Browser.
 *
 * Importierbar ist sie überhaupt erst, seit die Seeder Mandant, Id-Regel und
 * Client als Parameter bekommen (`seed-context.ts`) und ihre Kommandozeile in
 * `*.cli.ts` liegt. Ein Riegel hält das fest:
 * `prisma/__tests__/seed-profiles-importierbar.test.ts`.
 *
 * **Kein `server-only`-Marker**, weil das Paket hier keine Abhaengigkeit ist.
 * Statt eines Import-Fehlers zur Bauzeit haelt ein Test fest, dass kein
 * `"use client"`-Bauteil diese Datei anfasst — dieselbe Pruefung, nur frueher.
 */

import type { SeedContext } from "./seed-context";
import { SEED_PROFILE_META, type SeedProfile, type SeedProfileMeta } from "./seed-profile-meta";
import { seedDense } from "./seed-demo";
import { seedLarge } from "./seed-large";
import { seedSkeleton } from "./seed-large-setup";

export { SEED_PROFILES, type SeedProfile } from "./seed-profile-meta";

export interface SeedProfileDef extends SeedProfileMeta {
  run: ((ctx: SeedContext) => Promise<void>) | null;
}

const RUNNER: Record<SeedProfile, SeedProfileDef["run"]> = {
  none: null,
  skeleton: seedSkeleton,
  dense: seedDense,
  large: seedLarge,
};

export const SEED_PROFILE_DEFS: readonly SeedProfileDef[] = SEED_PROFILE_META.map((m) => ({
  ...m,
  run: RUNNER[m.id],
}));

export function seedProfileDef(id: SeedProfile): SeedProfileDef {
  const def = SEED_PROFILE_DEFS.find((p) => p.id === id);
  if (!def) throw new Error(`Unbekanntes Seed-Profil: ${id}`);
  return def;
}
