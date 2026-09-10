/**
 * Die Bausteine, aus denen eine Anleitung besteht — **bewusst eine schmale
 * Union**.
 *
 * Pulse hat kein Markdown-Rendering und kein `prose`-Plugin; Langtext lebt hier
 * als Datenstruktur, gerendert von Komponenten (`onboarding/domain/role-playbook.ts`
 * ist das Vorbild). Das ist kein Umweg, sondern der Grund, warum sich der Inhalt
 * filtern, durchsuchen und **testen** laesst.
 *
 * Die Union traegt genau das, was die elf Prozess-Dokumente unter
 * `docs/concepts/` tatsaechlich benutzen — und nichts darueber hinaus. Wer einen
 * neunten Block braucht, soll erst nachsehen, ob acht nicht reichen.
 *
 * Rein, kein I/O, kein JSX.
 */

/** Ein Textabschnitt. `**fett**` und `` `code` `` werden beim Rendern erkannt. */
export interface ParagraphBlock {
  kind: "paragraph";
  text: string;
}

/** Aufzaehlung; `ordered` macht sie zur nummerierten Liste. */
export interface ListBlock {
  kind: "list";
  ordered?: boolean;
  items: string[];
}

/** Was ueberrascht — der bernsteinfarbene Kasten. Sparsam einsetzen. */
export interface NoteBlock {
  kind: "note";
  text: string;
}

/** Eine Randbemerkung: begruendet, statt zu warnen. */
export interface AsideBlock {
  kind: "aside";
  text: string;
}

/** Ein Merksatz, den man behalten soll. Ein Satz, kein Absatz. */
export interface QuoteBlock {
  kind: "quote";
  text: string;
}

/** Tabelle mit Kopfzeile. Scrollt waagerecht in ihrem eigenen Container. */
export interface TableBlock {
  kind: "table";
  head: string[];
  rows: string[][];
  caption?: string;
}

/**
 * Eine Figur — **deklarativ benannt, nicht abgeschrieben**.
 *
 * Der teuerste Fehler waere, die Leitern als Text zu kopieren:
 * `work/domain/epic-lifecycle-doc.ts` erzaehlt im eigenen Header, was dann
 * passiert (eine Parallelliste, die auseinanderlaeuft). Hier steht deshalb nur,
 * **welche** Figur gemeint ist; die Seite loest sie aus der Domaene auf, weil
 * im App-Root aus jedem Modul importiert werden darf.
 */
export interface FigureBlock {
  kind: "figure";
  figure: FigureKind;
  caption?: string;
}

/** Ein Codeblock — Routen, Formeln, kleine Diagramme in Monospace. */
export interface CodeBlock {
  kind: "code";
  text: string;
}

export type Block =
  | ParagraphBlock
  | ListBlock
  | NoteBlock
  | AsideBlock
  | QuoteBlock
  | TableBlock
  | FigureBlock
  | CodeBlock;

/**
 * Die Figuren, die es gibt. Jede hat genau eine Quelle in der Domaene — die
 * Tabelle steht im Bau-Plan und im Aufloeser
 * (`app/[locale]/(dashboard)/wiki/[slug]/page.tsx`).
 */
export const FIGURE_KINDS = [
  "gateLadder",
  "gateCriteria",
  "lifecycleSteps",
  "periodPhases",
  "horizonLadder",
  "solutionLifecycle",
  "allocationRule",
  "deliveryChain",
  "guardrailAxes",
  "moduleMap",
  "roleList",
  "kanbanColumns",
  "benefitKinds",
  "exposureMatrix",
  "roamAxes",
] as const;

export type FigureKind = (typeof FIGURE_KINDS)[number];
