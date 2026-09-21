/**
 * **Deterministische Ids fuer die Seeds — die reine Haelfte von
 * `seed-helpers.ts`.**
 *
 * Abgespalten, weil `seed-helpers.ts` beim Import `.env.local` laedt und einen
 * eigenen Prisma-Client samt Service-Role-Schluessel baut. Solange die Id-Regel
 * dort lag, konnte **keine Server-Action** einen Seeder importieren: der
 * Next-Build zoege beides mit. Hier steht nur Arithmetik — importierbar von
 * ueberall, ohne Seiteneffekt.
 */

/**
 * Deterministische UUID aus einem String-Schlüssel (FNV-1a über mehrere Runden).
 * Gleicher Key ⇒ gleiche UUID ⇒ idempotenter Reseed + querverweisbare Relationen.
 */
export function uid(key: string): string {
  const bytes: number[] = [];
  let h = 0x811c9dc5 >>> 0;
  for (let round = 0; round < 16; round++) {
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i) + round * 131;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    bytes.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
    h = (h ^ (round * 0x9e3779b1)) >>> 0;
  }
  const b = bytes.slice(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40; // Version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // Variante
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Die Id-Regel eines Seed-Laufs. Ein Seeder bekommt sie, er baut sie nicht. */
export type Uid = (key: string) => string;

/**
 * **Derselbe Datensatz in zwei Mandanten, ohne Kollision.**
 *
 * `uid("vs:digital-banking")` ist immer dieselbe UUID. Solange ein Seeder diese
 * Funktion direkt rief, liess sich sein Datensatz genau **einmal** anlegen — ein
 * zweiter Mandant scheiterte am Primaerschluessel. Der Namensraum haengt das
 * Ziel davor.
 *
 * **Der leere Namensraum ist nicht bloss der Vorgabewert, er ist eine Zusage:**
 * `uidFor("")` muss `uid` selbst sein. Die Kommandozeile saet seit Mai 2026 in
 * dieselben Mandanten, und ein `pnpm db:seed:demo` mit anderen Ids legte alles
 * **doppelt** an, statt es zu ersetzen. Ein Test haelt das fest.
 *
 * **Die Laenge steht vorn, nicht nur ein Trenner.** Ein blosses
 * `${namespace}|${key}` liesse sich verschieben: `uidFor("a")("b|c")` und
 * `uidFor("a|b")("c")` ergaeben dieselbe Id. Heute kann das nicht vorkommen —
 * Namensraeume sind UUIDs, Schluessel benutzen `:` — aber eine Regel, die nur
 * durch die aktuelle Aufrufform stimmt, ist keine. Mit der Laenge davor ist die
 * Zerlegung eindeutig.
 */
export const uidFor =
  (namespace: string): Uid =>
  (key: string) =>
    namespace ? uid(`${namespace.length}|${namespace}|${key}`) : uid(key);
