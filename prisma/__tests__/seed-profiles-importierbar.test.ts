import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * **Die Plattform-Verwaltung muss einen Seeder importieren können.**
 *
 * `prisma/seed-helpers.ts` ruft beim Import `loadEnvLocal()`, baut einen eigenen
 * Prisma-Client auf `DIRECT_URL` **und** einen Supabase-Client mit dem
 * Service-Role-Schluessel — alles auf Modulebene. Zoege ein Seeder das mit, kaeme
 * beides in den Server-Build der Anwendung, und `seed-profiles.ts` waere aus
 * einer Server-Action nicht benutzbar.
 *
 * Genau das war im ersten Anlauf noch der Fall: die Kommandozeilen-Funktion
 * stand in derselben Datei wie der Datensatz und importierte die Helfer ganz
 * oben. Aufgefallen ist es **nicht** beim Ausprobieren — unter `tsx` fand
 * `loadEnvLocal()` die `.env.local` und alles lud durch. Deshalb steht hier eine
 * Pruefung des Import-Graphen statt eines Probelaufs.
 *
 * Die Kommandozeile lebt seither in `seed-*.cli.ts`; nur die darf die Helfer
 * anfassen.
 */

const WURZEL = process.cwd();
const VERBOTEN = "seed-helpers";

/**
 * Folgt den relativen Importen einer Datei.
 *
 * Zwei Schreibweisen kommen vor und beide meinen dieselbe `.ts`-Quelle: `./x.js`
 * (so verlangt es ECMAScript, so laufen die Skripte unter blossem Node) und
 * `./x` (was Webpack ohne Zusatzregel allein aufloest).
 */
function importGraph(einstieg: string): string[] {
  const gesehen = new Set<string>();
  const offen = [resolve(WURZEL, einstieg)];
  while (offen.length > 0) {
    const datei = offen.pop()!;
    if (gesehen.has(datei) || !existsSync(datei)) continue;
    gesehen.add(datei);
    const src = readFileSync(datei, "utf8");
    for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const roh = join(dirname(datei), m[1]!);
      offen.push(roh.endsWith(".js") ? roh.replace(/\.js$/, ".ts") : `${roh}.ts`);
    }
  }
  return [...gesehen];
}

describe("der Import-Graph der Seed-Profile", () => {
  const graph = importGraph("prisma/seed-profiles.ts");

  it("enthält die drei Seeder", () => {
    for (const datei of ["seed-demo.ts", "seed-large.ts", "seed-large-setup.ts"]) {
      expect(graph.some((g) => g.endsWith(datei))).toBe(true);
    }
  });

  it("enthält seed-helpers NICHT — sonst zöge er Client und Service-Key mit", () => {
    const treffer = graph.filter((g) => g.includes(VERBOTEN)).map((g) => g.replace(WURZEL, ""));
    expect(treffer).toEqual([]);
  });

  it("enthält keine der Kommandozeilen-Dateien", () => {
    const treffer = graph.filter((g) => g.endsWith(".cli.ts")).map((g) => g.replace(WURZEL, ""));
    expect(treffer).toEqual([]);
  });

  /** Ohne diese Zeile wäre der Test grün, sobald der Graph leer läuft. */
  it("hat überhaupt etwas gefunden", () => {
    expect(graph.length).toBeGreaterThan(5);
  });
});

describe("die Kommandozeilen-Dateien", () => {
  it("dürfen die Helfer benutzen — sie laufen nur als Skript", () => {
    for (const datei of ["seed-demo.cli.ts", "seed-large.cli.ts", "seed-large-setup.cli.ts"]) {
      expect(readFileSync(join(WURZEL, "prisma", datei), "utf8")).toContain(VERBOTEN);
    }
  });
});

/**
 * **Und umgekehrt: kein Client-Bauteil darf die Seeder anfassen.**
 *
 * `SEED_PROFILE_DEFS` trug bis zum 21.09.2026 Name, Beschreibung **und** den
 * Seeder. Zwei Client-Bauteile lasen daraus nur die Beschriftung — und zogen
 * damit alle drei Datensaetze in den **Browser**. Aufgefallen ist das nur, weil
 * der Webpack-Build vorher an einer Dateiendung scheiterte; ohne den Zufall
 * waeren sechstausend Zeilen Server-Code ausgeliefert worden.
 *
 * Die Beschriftung steht seither in `seed-profile-meta.ts` — ohne einen
 * einzigen Import.
 */
describe("die Trennung von Beschriftung und Seeder", () => {
  const clientDateien = (dir: string): string[] => {
    const out: string[] = [];
    const lauf = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const voll = join(d, e.name);
        if (e.isDirectory()) lauf(voll);
        else if (/\.tsx?$/.test(e.name) && readFileSync(voll, "utf8").startsWith('"use client"')) {
          out.push(voll);
        }
      }
    };
    lauf(join(WURZEL, dir));
    return out;
  };

  it('kein „use client"-Bauteil importiert seed-profiles', () => {
    const suender = clientDateien("src").filter((f) =>
      /from\s+"[^"]*seed-profiles"/.test(readFileSync(f, "utf8")),
    );
    expect(suender.map((f) => f.replace(WURZEL, ""))).toEqual([]);
  });

  it("seed-profile-meta bringt nichts mit — es hat keinen einzigen Import", () => {
    const meta = readFileSync(join(WURZEL, "prisma/seed-profile-meta.ts"), "utf8");
    expect(meta).not.toMatch(/^\s*import\s/m);
  });
});
