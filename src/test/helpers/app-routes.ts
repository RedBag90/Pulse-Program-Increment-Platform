import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Zwei Quelltext-Wanderungen, die überall dort gebraucht werden, wo eine
 * **Erklärschicht per String** auf das Produkt zeigt — heute `onboarding`
 * (ADR-0017) und `wiki`. Beide Module sind Blätter über Core und dürfen die
 * oberen Module nicht importieren; der Compiler sieht ihre Verweise deshalb
 * nicht. Diese Helfer sind der Ersatz dafür.
 *
 * Sie standen zuerst inline in `role-playbook.test.ts`. Herausgezogen, statt
 * kopiert: eine zweite Abschrift wäre genau die Drift, die die Tests hier
 * verhindern sollen.
 */

/**
 * Jede Route unter `(dashboard)`, die eine echte `page.tsx` hat.
 *
 * Route-Gruppen (`(organisation)`) verändern die Adresse nicht, wohl aber den
 * Ordnerpfad — deshalb wird der Baum abgelaufen und je `page.tsx` die Route
 * rekonstruiert, statt den Pfad direkt zusammenzusetzen. Private Ordner
 * (`_figures`) haben keine `page.tsx` und fallen dabei von selbst heraus.
 */
export function appRoutes(): Set<string> {
  const base = join(process.cwd(), "src/app/[locale]/(dashboard)");
  const routes = new Set<string>();
  const walk = (dir: string, route: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
        walk(join(dir, entry.name), isGroup ? route : `${route}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        routes.add(route === "" ? "/" : route);
      }
    }
  };
  walk(base, "");
  return routes;
}

/**
 * Dieselben Routen, aber als **rohe App-Pfade** — mit `[locale]` und der
 * Routen-Gruppe, so wie Next sie intern führt
 * (`/[locale]/(dashboard)/portfolio/epics/[id]`).
 *
 * Der Unterschied ist nicht kosmetisch, er ist der Grund für einen Fehler, der
 * zwei Jahre gelebt hat: `revalidatePath` vergleicht gegen genau diese
 * Schreibweise. `createWorkStore` legt beide Formen ab — `page` roh und
 * `route: normalizeAppPath(page)` normalisiert —, und `getImplicitTags` nimmt
 * die **rohe**. Wer die Adresse einsetzt, die im Browser steht, trifft nichts.
 *
 * Schlüssel ist die Adresse (Registry-Schreibweise), Wert der rohe Pfad.
 */
export function appRoutePaths(): Map<string, string> {
  const base = join(process.cwd(), "src/app/[locale]/(dashboard)");
  const paths = new Map<string, string>();
  const walk = (dir: string, route: string, roh: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
        walk(
          join(dir, entry.name),
          isGroup ? route : `${route}/${entry.name}`,
          `${roh}/${entry.name}`,
        );
      } else if (entry.name === "page.tsx") {
        paths.set(route === "" ? "/" : route, roh);
      }
    }
  };
  walk(base, "", "/[locale]/(dashboard)");
  return paths;
}

/**
 * Alle `data-tour`-Werte, die im Quelltext wirklich ausgegeben werden.
 *
 * Ein fehlender Anker ist kein Absturz, sondern ein Fallback auf eine zentrierte
 * Karte — genau deshalb braucht es eine explizite Prüfung. Template-Anker wie
 * `` `group:${g.labelKey}` `` liefern nur einen statischen Präfix; er wird
 * getrennt zurückgegeben, damit die Prüfung sie als Präfix-Treffer zulassen
 * kann.
 */
export function emittedAnchors(): { literals: Set<string>; prefixes: string[] } {
  const literals = new Set<string>();
  const prefixes: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/data-tour="([^"]+)"/g)) literals.add(m[1]!);
      for (const m of src.matchAll(/data-tour=\{`([a-z-]+:?[a-z-]*)\$\{/g)) prefixes.push(m[1]!);
    }
  };
  walk(join(process.cwd(), "src"));
  return { literals, prefixes };
}

/** Trifft `anchor` einen ausgegebenen Anker — als Literal oder über einen Präfix? */
export function anchorEmitted(
  anchor: string,
  emitted: { literals: Set<string>; prefixes: string[] },
): boolean {
  return emitted.literals.has(anchor) || emitted.prefixes.some((p) => anchor.startsWith(p));
}
