import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { appRoutes, appRoutePaths } from "@/test/helpers/app-routes";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

// Imported after the mock is registered.
const { revalidateFor, REGISTRY } = await import("@/server/http/revalidation");

beforeEach(() => revalidatePath.mockClear());

/** Die Pfade, mit denen `revalidatePath` tatsächlich aufgerufen wurde. */
const emittiert = (): string[] => revalidatePath.mock.calls.map((c) => c[0] as string);

/** Registry-Schreibweise → der rohe App-Pfad, gegen den Next seine Tags baut. */
const route = (p: string): string => `/[locale]/(dashboard)${p}`;

describe("revalidateFor", () => {
  /**
   * **Der Test, der zwei Jahre lang gefehlt hat.**
   *
   * Bis September 2026 emittierte die Registry locale-lose Pfade
   * (`/portfolio/epics/[id]`), während `localePrefix: "always"` dafür sorgt,
   * dass es solche Routen gar nicht gibt. Jeder einzelne Aufruf lief folgenlos
   * durch — 25 Gruppen lang, ohne Fehler, ohne Warnung.
   *
   * Diese beiden Zusicherungen sind die einzigen, die das gemerkt hätten. Alle
   * anderen prüften Gruppenzugehörigkeit und Dedupe und waren die ganze Zeit
   * grün.
   */
  it("emittiert den rohen App-Pfad, nicht die Browser-Adresse", () => {
    // Beides muss mit: `[locale]`, weil `localePrefix: "always"` gilt, und die
    // Routen-Gruppe, weil `getImplicitTags` `store.page` nimmt und nicht
    // `store.route`. Fehlt eines, läuft der Aufruf folgenlos durch.
    revalidateFor("epic");
    const falsch = emittiert().filter((p) => !p.startsWith("/[locale]/(dashboard)/"));
    expect(
      falsch,
      falsch.length === 0 ? "" : `\nFalsche Schreibweise:\n  ${falsch.join("\n  ")}\n`,
    ).toEqual([]);
  });

  /**
   * **Der Präfix ist eine Annahme, und sie war schon einmal still gebrochen.**
   *
   * `ROUTE_PREFIX` steht als Konstante da, weil heute jede Registry-Route unter
   * genau einer Gruppe liegt. Zöge jemand eine Fläche in eine verschachtelte
   * Gruppe — `(dashboard)/(organisation)/structure` —, stimmte der Präfix für
   * sie nicht mehr, und die Revalidierung wäre dort wieder stumm. Ohne Fehler,
   * ohne Warnung, wie beim letzten Mal.
   *
   * Deshalb wird hier gegen den **Dateibaum** geprüft und nicht gegen eine
   * Abschrift.
   */
  it("trifft für jeden Registry-Pfad den echten App-Pfad im Dateibaum", () => {
    const echte = appRoutePaths();
    const abweichend: string[] = [];
    for (const [gruppe, pfade] of Object.entries(REGISTRY)) {
      for (const p of pfade) {
        const echt = echte.get(p);
        if (echt !== undefined && echt !== route(p)) abweichend.push(`${gruppe} → ${p}: ${echt}`);
      }
    }
    expect(
      abweichend,
      abweichend.length === 0 ? "" : `\nPräfix passt nicht:\n  ${abweichend.join("\n  ")}\n`,
    ).toEqual([]);
  });

  it("übergibt für jeden Pfad den Typ 'page' — auch für die statischen", () => {
    // Mit dem Segment trägt **jeder** Pfad eine eckige Klammer, ist für Next
    // also eine dynamische Route. Ohne `type` gäbe es dort nur eine Warnung
    // und keine Revalidierung; die frühere Fallunterscheidung an
    // `path.includes("[")` wäre jetzt schädlich.
    revalidateFor("art");
    const typen = revalidatePath.mock.calls.map((c) => c[1]);
    expect(new Set(typen)).toEqual(new Set(["page"]));
  });

  it("revalidates the full path set registered for a resource", () => {
    revalidateFor("art");
    expect(emittiert()).toEqual(
      expect.arrayContaining(
        ["/structure", "/structure/art/[id]", "/structure/value-stream/[id]"].map(route),
      ),
    );
  });

  it("revalidates the cross-resource pages a feature touches (epics, PI, planning)", () => {
    revalidateFor("feature");
    expect(emittiert()).toEqual(
      expect.arrayContaining(
        [
          "/umsetzung/feature/[id]",
          "/portfolio/epics/[id]",
          "/feature/[featureId]",
          "/pi/[piId]",
          "/pi-planning",
        ].map(route),
      ),
    );
  });

  it("issues one revalidatePath call per registered path — genau einen, keinen doppelt", () => {
    revalidateFor("valueStream");
    const paths = emittiert();
    // Aus der Registry abgeleitet statt abgeschrieben: eine neue Route in der
    // Gruppe ist eine Erweiterung, kein Fehlschlag.
    expect(paths).toHaveLength(REGISTRY.valueStream.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining(REGISTRY.valueStream.map(route)));
  });

  // Die Rollenverteilung schreibt über alle drei Ebenen; nach dem Benennen muss
  // sie den neuen Stand zeigen, ohne dass jemand neu lädt.
  it("frischt die Rollenverteilung auf, egal welche Ebene benannt wurde", () => {
    for (const resource of ["valueStream", "art", "solution"] as const) {
      revalidatePath.mockClear();
      revalidateFor(resource);
      expect(emittiert(), resource).toContain(route("/structure/rollen"));
    }
  });

  /**
   * **Die Flächen, auf denen ein eigenständiges Feature erscheint.** Für es ist
   * `/portfolio/epics/[id]` wirkungslos — es hat keine solche Seite. Ohne diese
   * vier Pfade bliebe es nach dem Anlegen sichtbar veraltet; genau das ist im
   * Haus schon zweimal passiert.
   */
  it("revalidiert für ein Feature auch die Flächen ohne Epic-Bezug", () => {
    for (const p of [
      "/umsetzung",
      "/implementation/features",
      "/portfolio",
      "/structure/solution/[id]",
    ]) {
      expect(REGISTRY.feature).toContain(p);
    }
  });

  /**
   * **Die zwei Geldlisten.** Beide standen in keiner einzigen Gruppe, obwohl
   * ihre Spalten nach jeder Finalisierung und jeder Verteilung veralten — der
   * dritte Fall derselben Art in diesem Haus.
   */
  it("revalidiert die Wertstrom-Liste, wenn sich Geld bewegt", () => {
    for (const group of ["budgetAllocation", "art", "rtbItem"] as const) {
      expect(REGISTRY[group]).toContain("/budgeting/value-streams");
    }
  });

  /**
   * **Die ART-Detailroute steht in keiner Gruppe mehr** — und das ist eine
   * Entscheidung, keine Lücke.
   *
   * Sie war in `art` und `rtbItem`, solange sie eine Fläche mit Geldzahlen war.
   * Seit der Zusammenlegung ist sie ein Redirect auf die Wertstromseite: nichts
   * daran kann veralten. Wer sie wieder einträgt, hat vermutlich übersehen,
   * dass die Fläche umgezogen ist — deshalb steht der Satz hier als Test und
   * nicht als Kommentar.
   */
  /**
   * **Keine `/budgeting/arts`-Route steht mehr in einer Gruppe** — und das ist
   * eine Entscheidung, keine Lücke.
   *
   * Liste und Detail waren dort, solange sie Flächen mit Geldzahlen waren. Beide
   * sind seit der Zusammenlegung reine Wegweiser auf die Wertstromseite: sie
   * laden nichts, also kann an ihnen nichts veralten. Wer sie wieder einträgt,
   * hat vermutlich übersehen, dass die Fläche umgezogen ist.
   */
  it("revalidiert die reinen Wegweiser-Routen nicht mehr", () => {
    for (const group of ["budgetAllocation", "art", "rtbItem"] as const) {
      expect(REGISTRY[group].filter((r) => r.startsWith("/budgeting/arts"))).toEqual([]);
    }
  });
});

/**
 * **Die Registry zeigt auf Routen — und niemand prüfte, ob es sie gibt.**
 *
 * Ein `revalidatePath` auf einen Pfad, den es nicht mehr gibt, läuft folgenlos
 * durch: kein Fehler, keine Warnung, nur eine Fläche, die kalt bleibt. So
 * überlebte `/budgeting/rounds` (Plural, existiert nicht) einen Umbau, und so
 * wäre `/reporting/portfolio-health` beim Rückbau der Reporting-Flächen stumm
 * liegengeblieben. Die bisherigen Tests prüfen Gruppenzugehörigkeit und
 * Dedupe — nicht die Existenz.
 *
 * `appRoutes()` liest die `page.tsx` unter `src/app` und liefert die
 * Adressen in derselben Schreibweise, die die Registry benutzt
 * (`/structure/art/[id]`) — Routen-Gruppen verändern den Ordnerpfad, nicht die
 * Adresse.
 */
/**
 * **`revalidatePath` gehört einer Datei.**
 *
 * Die Registry war nur die Hälfte des Problems: daneben standen **siebzehn**
 * direkte Aufrufe in acht Dateien — Admin-Flächen, Integrationen, der
 * ART-Start, zwei Portfolio-Actions —, und alle siebzehn ohne das
 * Locale-Segment. Solange der Import überall erreichbar ist, muss jede neue
 * Fundstelle die Regel einzeln kennen, und genau das ist schief gegangen.
 *
 * Wer eine einzelne Route auffrischen will, nimmt `revalidateRoute`; wer eine
 * Ressource meint, `revalidateFor`. Beide setzen das Segment und den Typ.
 */
describe("niemand ruft revalidatePath selbst auf", () => {
  const ERLAUBT = "src/server/http/revalidation.ts";

  function dateien(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const pfad = join(dir, e.name);
      if (e.isDirectory()) return e.name === "generated" ? [] : dateien(pfad);
      return e.name.endsWith(".ts") || e.name.endsWith(".tsx") ? [pfad] : [];
    });
  }

  it("importiert `revalidatePath` nur in der Revalidierungs-Naht", () => {
    // Gesucht wird der **Import**, nicht das Wort: `unstable_cache` aus
    // demselben Modul ist eine andere Sache und steht zu Recht anderswo
    // (`server/services/tenant-users.ts`), und über `revalidatePath` wird in
    // Docblocks geredet, ohne es aufzurufen.
    const IMPORT = /import\s*\{[^}]*\brevalidatePath\b[^}]*\}\s*from\s*"next\/cache"/;
    const src = join(process.cwd(), "src");
    const treffer = dateien(src)
      .filter((p) => !p.includes("__tests__"))
      .filter((p) => IMPORT.test(readFileSync(p, "utf8")))
      .map((p) => p.replace(`${process.cwd()}/`, ""))
      .filter((p) => p !== ERLAUBT);

    expect(
      treffer,
      treffer.length === 0 ? "" : `\nDirekte Aufrufer:\n  ${treffer.join("\n  ")}\n`,
    ).toEqual([]);
  });
});

describe("jeder Pfad der Registry zeigt auf eine echte Route", () => {
  const routes = appRoutes();

  it("der Melder liest überhaupt Routen", () => {
    expect(routes.size).toBeGreaterThan(30);
    // Eine statische und eine dynamische, beide über eine Routen-Gruppe hinweg.
    expect(routes.has("/structure")).toBe(true);
    expect(routes.has("/structure/art/[id]")).toBe(true);
    expect(routes.has("/gibt-es-nicht")).toBe(false);
  });

  it("findet keinen Pfad ohne page.tsx", () => {
    const tot: string[] = [];
    for (const [gruppe, pfade] of Object.entries(REGISTRY)) {
      for (const p of pfade) if (!routes.has(p)) tot.push(`${gruppe} → ${p}`);
    }
    expect(tot, tot.length === 0 ? "" : `\nTote Ziele:\n  ${tot.join("\n  ")}\n`).toEqual([]);
  });
});
