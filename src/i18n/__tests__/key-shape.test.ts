import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import de from "../../../messages/de.json";

/**
 * **Ein Schlüssel steht genau einmal im Namensraum.**
 *
 * `useTranslations("auth")` setzt „auth." vor jeden Schlüssel. Wer in einer
 * solchen Datei `t("auth.page.willkommen")` schreibt, fragt nach
 * `auth.auth.page.willkommen` — und bekommt nichts. `next-intl` wirft dabei
 * **nicht**: es schreibt den Schlüssel als Text auf den Bildschirm.
 *
 * Genau das ist passiert, und zwar siebenmal, als die Umstellung von Zug 3
 * voll qualifizierte Schlüssel in Dateien schrieb, die schon einen Namensraum
 * hatten. Gefunden hat es kein Test, sondern der erste Aufruf der
 * Anmeldeseite im laufenden Server — die Vitest-Attrappe deckt Server-Seiten
 * nicht ab, und der Wächter über die Oberfläche prüft Quelltext, keine
 * Ausgabe.
 *
 * Deshalb dieser Test. Er ist billig und schliesst die Lücke an der Stelle, an
 * der sie entsteht: im Quelltext, nicht im Browser.
 */

const SRC = join(process.cwd(), "src");

/** Die obersten Ebenen des Katalogs — mehr braucht die Prüfung nicht. */
const NAMENSRAEUME = new Set(Object.keys(de as Record<string, unknown>));

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      return name === "generated" || name === "__tests__" ? [] : dateien(pfad);
    }
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [pfad] : [];
  });
}

const NS_UEBERSETZER = /(?:useTranslations|getTranslations)\(\s*"(\w+)"/;
const AUFRUF = /\bt(?:\.rich)?\(\s*"([a-zA-Z][\w]*)\.([\w.]+)"/g;

describe("Schlüssel-Form", () => {
  it("kombiniert nirgends einen Namensraum-Übersetzer mit einem voll qualifizierten Schlüssel", () => {
    const fehler: string[] = [];

    for (const pfad of dateien(SRC)) {
      const quelle = readFileSync(pfad, "utf8");
      const ns = NS_UEBERSETZER.exec(quelle)?.[1];
      if (!ns) continue;

      for (const m of quelle.matchAll(AUFRUF)) {
        if (!NAMENSRAEUME.has(m[1]!)) continue;
        fehler.push(
          `${pfad.replace(SRC, "src")}: useTranslations("${ns}") + t("${m[1]}.${m[2]}")` +
            ` ⇒ gesucht wird "${ns}.${m[1]}.${m[2]}"`,
        );
      }
    }

    expect(fehler, fehler.length === 0 ? "" : `\n${fehler.join("\n")}\n`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Ein Schlüssel gehört in `t()`, nirgendwo sonst
// ---------------------------------------------------------------------------

/**
 * **Der Befund, für den es diese Prüfung gibt.**
 *
 * `rtb-section.tsx` baute die Überschrift einer Gruppe so:
 *
 * ```tsx
 * <RtbGroupTable title={`${RTB_KIND_KEYS.art_change}s`} … />
 * ```
 *
 * Vor der i18n-Umstellung war `RTB_KIND_LABELS` eine Etiketten-Liste, und das
 * angehängte `s` machte aus „ART-Rahmen" ein „ART-Rahmens". Die Umstellung hat
 * den Bezeichner umbenannt und die Zeile **daneben** korrekt auf `t(…)`
 * gezogen — diese nicht. Seither stand `BUDGETING.RTBKIND.ARTCHANGES` auf dem
 * Bildschirm: ein Schlüssel, den es in keinem der beiden Kataloge je gab.
 *
 * **Warum kein vorhandener Test das sah.** `catalog-parity` vergleicht nur de
 * gegen en — der Schlüssel fehlte in beiden, also war Parität grün.
 * `translated-surfaces` sucht rohe **Literale**; ein Schlüssel-Bezug sieht für
 * einen Regex wie eine gelungene Umstellung aus. Und die Prüfung oben greift
 * nur bei namensräumigen Übersetzern — diese Datei benutzt `useTranslations()`
 * ohne Argument.
 *
 * Zwei Regeln, beide eng gefasst, beide heute grün:
 *
 * 1. **Kein `*_KEYS`-Bezug in einer Zeichenketten-Verkettung.** Nur diese Form
 *    kann einen Schlüssel erzeugen, den es gar nicht gibt. Interpolationen, die
 *    ein `t(…)` enthalten, sind ausdrücklich in Ordnung — neun Stellen bauen
 *    so ihre Beschriftungen zusammen, und das ist richtig.
 * 2. **Kein `*_KEYS`-Bezug allein in einer JSX-Klammer.** Das war der Fall an
 *    drei weiteren Stellen (`period-result-tab`, `art-budget-tab`), die
 *    niemand gemeldet hatte.
 */
describe("Ein Schlüssel gehört in t()", () => {
  /** `${…KEYS…}` **ohne** `t(` darin — der Fall, der einen Schlüssel erfindet. */
  const VERKETTET = /\$\{([^{}]*_KEYS[^{}]*)\}/g;

  /** `{FOO_KEYS.bar}` bzw. `{FOO_KEYS[x]}` als ganzer JSX-Ausdruck. */
  const ROH_IN_JSX = /\{\s*[A-Z][A-Z0-9_]*_KEYS\s*(?:\[[^\]]*\]|\.\w+)\s*\}/g;

  const quellen = dateien(SRC).map((pfad) => [pfad, readFileSync(pfad, "utf8")] as const);

  it("verkettet keinen Schlüssel zu einem neuen zusammen", () => {
    const funde: string[] = [];
    for (const [pfad, quelle] of quellen) {
      for (const m of quelle.matchAll(VERKETTET)) {
        if (m[1]!.includes("t(")) continue;
        const zeile = quelle.slice(0, m.index ?? 0).split("\n").length;
        funde.push(`${pfad.replace(SRC, "src")}:${zeile}  ${m[0]}`);
      }
    }
    expect(funde.join("\n"), `Schlüssel in einer Verkettung:\n${funde.join("\n")}`).toBe("");
  });

  it("rendert keinen Schlüssel roh in einer JSX-Klammer", () => {
    const funde: string[] = [];
    for (const [pfad, quelle] of quellen) {
      for (const m of quelle.matchAll(ROH_IN_JSX)) {
        const zeile = quelle.slice(0, m.index ?? 0).split("\n").length;
        funde.push(`${pfad.replace(SRC, "src")}:${zeile}  ${m[0]}`);
      }
    }
    expect(funde.join("\n"), `Roher Schlüssel in JSX:\n${funde.join("\n")}`).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Eine `…Label`-Funktion in `domain/` nimmt einen Übersetzer
// ---------------------------------------------------------------------------

/**
 * **Viermal dasselbe Muster ist kein Zufall, sondern eine fehlende Regel.**
 *
 * `gateStepKey` gab bei unbekanntem Schritt den Rohwert zurück und liess
 * `t()` werfen. `horizonLabel` gab links ein Wort, rechts einen Schlüssel.
 * `horizonShort` schnitt aus einer Schlüssel-Tabelle ab, als wäre sie noch
 * eine Etiketten-Liste. `RTB_INTERVAL_KEYS` zeigte zweimal auf denselben
 * Eintrag. Jedes Mal `string` gegen `string`, jedes Mal schwieg der Compiler.
 *
 * Die Regel dagegen:
 *
 * > Eine exportierte Funktion in `domain/`, deren Name auf `Label` endet,
 * > nimmt einen `Translate` entgegen. Wer keinen nimmt, liefert kein Etikett,
 * > sondern einen Schlüssel — und heisst dann `…Key`.
 *
 * Sie hat zwei echte Lecks gefunden, die niemand gemeldet hatte:
 * `pbSourceLabel` gab „aus Lean Business Case" zurück, `costSliceLabel` baute
 * „Monate 1–6". Beide heissen jetzt anders und liefern Schlüssel bzw. Zahlen.
 */
describe("Eine …Label-Funktion in domain/ nimmt einen Übersetzer", () => {
  /**
   * **Fünf Ausnahmen, jede mit Grund** — und das ist die Grenze: wäre die
   * Liste lang, wäre der Wächter keiner mehr.
   *
   * Alle fünf bauen **sprachneutrale Codes**, keine Wörter: `H2 2026`,
   * `Q1 2026`, `FY 2026`. Ein Übersetzer hätte dort nichts zu übersetzen.
   */
  const AUSNAHMEN = new Map([
    ["halfYearLabel", "baut H2 2026 — eine Notation, kein Wort"],
    ["cycleLabel", "dasselbe für den Budget-Zyklus"],
    ["goalPeriodLabel", "Q1 2026 · H1 2026 · FY 2026"],
    ["goalPeriodDateLabel", "Datumsbereich eines Ziel-Zeitraums"],
    ["goalTimeframeLabel", "dasselbe, über mehrere Zeiträume"],
  ]);

  const LABEL_FN = /export function (\w*Label)\s*\(([\s\S]*?)\)\s*:/g;

  it("hat für jede Ausnahme noch eine Funktion", () => {
    // Eine Ausnahme, die auf nichts mehr zeigt, ist Ballast — und verdeckt,
    // dass die Regel inzwischen strenger sein könnte.
    const namen = new Set<string>();
    for (const pfad of dateien(SRC)) {
      if (!pfad.includes("/domain/")) continue;
      for (const m of readFileSync(pfad, "utf8").matchAll(LABEL_FN)) namen.add(m[1]!);
    }
    for (const name of AUSNAHMEN.keys()) {
      expect(namen.has(name), `Ausnahme ohne Funktion: ${name}`).toBe(true);
    }
  });

  it("nimmt überall sonst einen Translate entgegen", () => {
    const funde: string[] = [];
    for (const pfad of dateien(SRC)) {
      if (!pfad.includes("/domain/")) continue;
      const quelle = readFileSync(pfad, "utf8");
      for (const m of quelle.matchAll(LABEL_FN)) {
        const [, name, parameter] = m;
        if (AUSNAHMEN.has(name!)) continue;
        if (parameter!.includes("Translate")) continue;
        const zeile = quelle.slice(0, m.index ?? 0).split("\n").length;
        funde.push(`${pfad.replace(SRC, "src")}:${zeile}  ${name}`);
      }
    }
    expect(funde.join("\n"), `…Label ohne Übersetzer:\n${funde.join("\n")}`).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Wer auf derselben Route bleibt, scrollt nicht an den Anfang
// ---------------------------------------------------------------------------

/**
 * **Der Befund:** die Reiterleiste in `entity-detail-shell.tsx` navigierte ohne
 * `scroll={false}` — und Next scrollt dabei den **nächstgelegenen scrollbaren
 * Vorfahren** des neuen Inhalts. Das ist auf diesen Seiten nicht das Fenster,
 * sondern ein inneres `<main>`; der Leser sprang bei jedem Reiterwechsel an
 * den Anfang. Eine Stelle, sechs Detailseiten.
 *
 * **Die Regel ist eng, und das ist Absicht.** Sie gilt nur für Navigationen,
 * die auf **derselben Route** bleiben und bloss Suchparameter tauschen —
 * erkennbar daran, dass der Ziel-Pfad aus `pathname` oder `basePath` gebaut
 * wird. Wer die Seite wechselt, *soll* oben anfangen; eine Regel „jede
 * Navigation trägt `scroll: false`" hätte 33 Stellen gemeldet, von denen die
 * allermeisten richtig sind.
 *
 * Die fünfzehn Stellen, die Suchparameter setzen, halten sie heute schon —
 * festgehalten hat sie niemand, und genau deshalb ist die sechzehnte
 * durchgerutscht.
 */
describe("Gleiche Route, gleiche Bildlaufposition", () => {
  const ROUTER = /router\.(?:push|replace)\(\s*`\$\{(?:pathname|basePath)\}[\s\S]{0,200}?\)\s*;/g;
  const LINK = /<Link\b[^>]{0,400}?href=\{`\$\{(?:basePath|pathname)\}\?[^>]{0,300}?>/g;

  it("gibt bei jeder Navigation auf derselben Route `scroll: false` mit", () => {
    const funde: string[] = [];
    for (const pfad of dateien(SRC)) {
      const quelle = readFileSync(pfad, "utf8");
      for (const rx of [ROUTER, LINK]) {
        for (const m of quelle.matchAll(rx)) {
          // **Nicht `includes("scroll")`.** Der erste Anlauf prüfte auf die
          // Zeichenfolge — und übersah den Rückbau, weil im selben Tag ein
          // Kommentar über „scrollbare Vorfahren" stand. Geprüft wird der
          // Schalter, nicht das Wort.
          if (/scroll=\{false\}|scroll:\s*false/.test(m[0])) continue;
          const zeile = quelle.slice(0, m.index ?? 0).split("\n").length;
          funde.push(`${pfad.replace(SRC, "src")}:${zeile}`);
        }
      }
    }
    expect(funde.join("\n"), `Navigation ohne scroll:false:\n${funde.join("\n")}`).toBe("");
  });
});
