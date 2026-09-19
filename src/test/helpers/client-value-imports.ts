/**
 * **Wer aus einem `"use client"`-Modul einen *Wert* importiert, muss selbst
 * Client sein.**
 *
 * Next ersetzt ein Client-Modul im Server-Graphen durch eine Referenz. Für
 * Komponenten ist das genau richtig — sie werden an der Grenze serialisiert.
 * Für alles andere ist es eine Falle: eine exportierte Konstante kommt in der
 * Server-Komponente als `undefined` an, und zwar **erst zur Laufzeit**.
 * TypeScript sieht den Typ, der Build sieht kein Problem, und ein jsdom-Test
 * sieht es auch nicht — er rendert clientseitig, wo das Modul normal auflöst.
 *
 * Gefunden wurde das an `HORIZON_BADGE_CLASS`: die Farbtabelle lag in
 * `horizon-badge.tsx` (`"use client"`), und die neue Struktur-Fläche stürzte
 * beim ersten echten Rendern ab. Die Tabelle liegt seitdem in
 * `horizon-tokens.ts`, ohne Direktive.
 *
 * **Zwei Heuristiken tragen den Melder.**
 *
 * 1. In einem Client-Modul gilt jedes `export const` mit einem Namen, der
 *    **nicht** PascalCase ist, als Wert-Export — Komponenten heißen in diesem
 *    Repo `export function Foo` oder `export const Foo`. Typen sind ohnehin
 *    ausgenommen: `import type` ist zur Laufzeit nicht da.
 * 2. Gemeldet wird nur, was der **Server** wirklich lädt. Eine Datei ohne
 *    Direktive ist nicht automatisch Server-Code: wird sie nur von
 *    Client-Komponenten importiert, landet sie im Client-Bündel und löst dort
 *    normal auf. Der Melder läuft deshalb vom App-Router und den
 *    `"use server"`-Dateien aus durch den Importgraphen und **hält an jedem
 *    Client-Modul an** — das ist genau die Grenze, um die es geht.
 *
 * Ohne die zweite Regel meldete er `breakdown-layout.ts`, das seine Tabelle aus
 * einem Client-Modul zieht und ausschliesslich vom Netzplan gelesen wird. Kein
 * Fehler, nur eine Datei im anderen Graphen.
 */

export interface ClientValueImport {
  /** Die importierende Datei (repo-relativ). */
  file: string;
  /** Das Client-Modul, aus dem importiert wird (repo-relativ). */
  from: string;
  /** Der importierte Name. */
  name: string;
}

const USE_CLIENT = /^\s*(?:\/\*[\s\S]*?\*\/|\/\/.*\n)*\s*["']use client["']/;

export function isClientModule(source: string): boolean {
  return USE_CLIENT.test(source);
}

/** Wert-Exporte eines Moduls: `export const x` mit nicht-PascalCase-Namen. */
export function valueExports(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)) {
    const name = m[1]!;
    if (!/^[A-Z][a-z]/.test(name)) out.add(name);
  }
  return out;
}

/** Nicht-Typ-Namen, die `file` aus `from` importiert. */
export function importedValueNames(source: string, from: string): string[] {
  const out: string[] = [];
  const spec = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`import\\s+(type\\s+)?\\{([^}]*)\\}\\s*from\\s*["']${spec}["']`, "g");
  for (const m of source.matchAll(re)) {
    if (m[1]) continue; // `import type { … }` — zur Laufzeit nicht vorhanden
    for (const raw of m[2]!.split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name && !name.startsWith("type ")) out.push(name);
    }
  }
  return out;
}

/** Die Einstiegspunkte des Servers: App-Router-Dateien und Server-Actions. */
const ROUTE_ENTRY =
  /^src\/app\/(?:.*\/)?(page|layout|route|loading|error|not-found|template|default)$/;

function isServerRoot(path: string, source: string): boolean {
  return ROUTE_ENTRY.test(path) || /^\s*["']use server["']/.test(source);
}

/** Jeder `@/`-Import einer Datei, als repo-relativer Pfad ohne Endung. */
export function importedModules(source: string): string[] {
  return [...source.matchAll(/from\s*["']@\/([^"']+)["']/g)].map((m) => `src/${m[1]!}`);
}

/**
 * Alle Dateien, die der Server tatsächlich lädt — vom App-Router und den
 * Server-Actions aus, **anhaltend an jedem Client-Modul**.
 */
export function serverReachable(files: ReadonlyMap<string, string>): Set<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const [path, source] of files) {
    if (isServerRoot(path, source) && !isClientModule(source)) {
      seen.add(path);
      queue.push(path);
    }
  }
  while (queue.length > 0) {
    const path = queue.pop()!;
    for (const next of importedModules(files.get(path) ?? "")) {
      const source = files.get(next);
      // Unbekannt (kein Quellmodul) oder Client — beides endet den Server-Graphen.
      if (source === undefined || isClientModule(source) || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/**
 * Prüft einen ganzen Baum. `files` bildet den repo-relativen Pfad **ohne**
 * Endung (so, wie ihn ein `@/`-Import schreibt) auf den Quelltext ab.
 */
export function clientValueImports(files: ReadonlyMap<string, string>): ClientValueImport[] {
  const clientExports = new Map<string, Set<string>>();
  for (const [path, source] of files) {
    if (isClientModule(source)) clientExports.set(path, valueExports(source));
  }

  const server = serverReachable(files);

  const out: ClientValueImport[] = [];
  for (const path of server) {
    const source = files.get(path)!;
    for (const [clientPath, exported] of clientExports) {
      if (exported.size === 0) continue;
      const alias = `@/${clientPath.replace(/^src\//, "")}`;
      for (const name of importedValueNames(source, alias)) {
        if (exported.has(name)) out.push({ file: path, from: clientPath, name });
      }
    }
  }
  return out;
}

export function formatClientValueImports(rows: readonly ClientValueImport[]): string {
  return rows.map((r) => `  · ${r.file} importiert „${r.name}" aus ${r.from}`).join("\n");
}
