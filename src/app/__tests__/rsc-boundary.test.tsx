import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/**
 * RSC-Grenze: eine Server-Komponente darf einer Client-Komponente **keine
 * Funktion** als Prop geben.
 *
 * Warum es diesen Test gibt: genau dieser Fehler hat `/timelines` neun Tage
 * lang bei *jedem* Aufruf abstürzen lassen, ohne dass ihn irgendetwas gemeldet
 * hätte. `tsc` sieht ihn nicht (der Prop-Typ `(t, cb) => ReactNode` ist ja
 * korrekt), ESLint sieht ihn nicht, und `next build` auch nicht — dynamische
 * Routen werden beim Build nicht gerendert. Aufgefallen ist es erst einem
 * Menschen, der die Seite angeklickt hat.
 *
 * Der Test schliesst diese Lücke rein statisch: er löst die Importe jeder
 * Server-Datei unter `src/app` auf, merkt sich, welche davon `"use client"`
 * sind, und prüft deren JSX-Props auf inline geschriebene Funktionen.
 *
 * **Grenze:** erkannt werden *inline* notierte Funktionen (`={() => …}`,
 * `={function …}`). Eine benannte Referenz (`render={myRenderer}`) rutscht
 * durch — dafür bräuchte es eine Datenflussanalyse, was den Nutzen nicht
 * rechtfertigt. Die real vorkommende Form ist inline.
 */

const SRC = join(process.cwd(), "src");
const APP = join(SRC, "app");

/** `"use client"` / `'use client'` als allererste Anweisung der Datei. */
function isClientModule(source: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source);
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...tsxFiles(p));
    } else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

/** `@/x` bzw. `./x` → konkrete Datei auf der Platte, oder null. */
function resolveImport(fromFile: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(fromFile), spec)
      : null;
  if (!base) return null; // node_modules — nicht unsere Baustelle
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Lokale Namen je Import-Spezifizierer: `import A, { B as C } from "x"`. */
function importedNames(source: string): { names: string[]; spec: string }[] {
  const result: { names: string[]; spec: string }[] = [];
  for (const m of source.matchAll(/import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g)) {
    const clause = m[1]!;
    const spec = m[2]!;
    const names: string[] = [];
    const braced = clause.match(/\{([^}]*)\}/);
    if (braced) {
      for (const part of braced[1]!.split(",")) {
        const local = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (local) names.push(local);
      }
    }
    const defaultName = clause
      .replace(/\{[^}]*\}/, "")
      .replace(/,/g, "")
      .trim();
    if (/^[A-Za-z_$][\w$]*$/.test(defaultName)) names.push(defaultName);
    result.push({ names, spec });
  }
  return result;
}

/**
 * Der Text jedes Opening-Tags `<Name …>` — inklusive verschachtelter
 * JSX-Ausdrücke in den Props, deshalb die Klammertiefe statt eines Regex.
 */
function openingTags(source: string, component: string): string[] {
  const tags: string[] = [];
  for (const m of source.matchAll(new RegExp(`<${component}(?=[\\s/>])`, "g"))) {
    let i = m.index! + m[0].length;
    let depth = 0;
    while (i < source.length) {
      const c = source[i]!;
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) break;
      i += 1;
    }
    tags.push(source.slice(m.index!, i));
  }
  return tags;
}

/** Props, deren Wert eine inline notierte Funktion ist. */
const INLINE_FUNCTION_PROP =
  /([A-Za-z_$][\w$]*)=\{\s*(?:async\s+)?(?:function\b|(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;

interface Violation {
  file: string;
  component: string;
  prop: string;
}

interface CallViolation {
  file: string;
  fn: string;
}

/**
 * Wird ein importierter Name **aufgerufen** (`name(`) statt als Komponente
 * gerendert? Groß geschriebene Namen bleiben ausgenommen: `<Foo />` ist ein
 * Rendering, und ein Aufruf `Foo(props)` kommt in diesem Code nicht vor.
 */
function calledNames(source: string, names: readonly string[]): string[] {
  return names.filter((name) => {
    if (/^[A-Z]/.test(name)) return false;
    return new RegExp(`\\b${name}\\s*\\(`).test(source);
  });
}

function findViolations(): { props: Violation[]; calls: CallViolation[] } {
  const violations: Violation[] = [];
  const calls: CallViolation[] = [];
  const clientCache = new Map<string, boolean>();

  for (const file of tsxFiles(APP)) {
    const source = readFileSync(file, "utf8");
    if (isClientModule(source)) continue; // Client → Client ist erlaubt

    for (const { names, spec } of importedNames(source)) {
      const target = resolveImport(file, spec);
      if (!target) continue;
      let isClient = clientCache.get(target);
      if (isClient === undefined) {
        isClient = isClientModule(readFileSync(target, "utf8"));
        clientCache.set(target, isClient);
      }
      if (!isClient) continue;

      for (const name of names) {
        for (const tag of openingTags(source, name)) {
          for (const m of tag.matchAll(INLINE_FUNCTION_PROP)) {
            violations.push({
              file: file.slice(process.cwd().length + 1),
              component: name,
              prop: m[1]!,
            });
          }
        }
      }

      for (const fn of calledNames(source, names)) {
        calls.push({ file: file.slice(process.cwd().length + 1), fn });
      }
    }
  }
  return { props: violations, calls };
}

describe("RSC-Grenze", () => {
  it("keine Server-Komponente reicht einer Client-Komponente eine Funktion durch", () => {
    const violations = findViolations().props;
    expect(
      violations.map((v) => `${v.file} → <${v.component} ${v.prop}={…}>`),
      "Funktions-Props überleben die Serialisierung nicht — React wirft zur " +
        "Laufzeit und die Seite läuft in die Error-Boundary. Die Funktion " +
        'gehört auf die Client-Seite (dünner "use client"-Adapter).',
    ).toEqual([]);
  });

  /**
   * Die zweite Richtung derselben Grenze: eine Server-Komponente darf eine
   * Client-Komponente **rendern**, aber keine ihrer Funktionen **aufrufen**.
   *
   * Auch das hat eine Seite zur Laufzeit gekillt — der Reiter-Cookie-Name lag
   * in der `"use client"`-Datei, und die Wertstrom-Fläche rief ihn serverseitig
   * auf. `tsc` sieht es nicht (der Export ist ja eine Funktion), `next build`
   * auch nicht, weil dynamische Routen beim Build nicht gerendert werden.
   */
  it("keine Server-Komponente ruft eine Funktion aus einem Client-Modul auf", () => {
    const calls = findViolations().calls;
    expect(
      calls.map((c) => `${c.file} → ${c.fn}()`),
      "Ein Client-Modul exportiert zur Laufzeit nur Referenzen für React. Der " +
        'Helfer gehört in ein neutrales Modul ohne "use client", das beide ' +
        "Seiten importieren.",
    ).toEqual([]);
  });

  it("erkennt einen Funktions-Prop überhaupt (Selbsttest des Detektors)", () => {
    // Ohne diesen Fall wäre ein stumpfer Detektor ununterscheidbar von „alles gut".
    const tag = openingTags('<Foo bar={(a, b) => <X />} baz={<Y />} qux="s" />', "Foo")[0]!;
    const props = [...tag.matchAll(INLINE_FUNCTION_PROP)].map((m) => m[1]);
    expect(props).toEqual(["bar"]);
  });

  it("erkennt einen Aufruf überhaupt (Selbsttest des Detektors)", () => {
    const src = 'const n = tabCookieName("vs");\n<RememberTab kind="vs" />';
    expect(calledNames(src, ["tabCookieName", "RememberTab"])).toEqual(["tabCookieName"]);
  });
});
