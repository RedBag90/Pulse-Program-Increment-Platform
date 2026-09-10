import type { ReactNode } from "react";
import type { Block, FigureKind } from "@/modules/wiki/domain/blocks";
import { inline } from "@/modules/wiki/features/wiki/components/inline";

/**
 * Rendert die Bausteine einer Anleitung.
 *
 * **Figuren rendert diese Datei nicht.** Sie stehen im Datensatz nur als Name
 * (`{ kind: "figure", figure: "horizonLadder" }`); aufgeloest werden sie von der
 * Seite, weil im App-Root aus jedem Modul importiert werden darf und das Wiki
 * ein Blatt ueber Core bleibt (ADR-0013/0017). Was hier ankommt, ist das
 * fertige Element.
 */
export function Blocks({
  blocks,
  figures,
}: {
  blocks: readonly Block[];
  figures: Partial<Record<FigureKind, ReactNode>>;
}) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} figures={figures} />
      ))}
    </>
  );
}

function BlockView({
  block,
  figures,
}: {
  block: Block;
  figures: Partial<Record<FigureKind, ReactNode>>;
}) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="max-w-[var(--reading-max-w)] text-[15px] leading-relaxed text-muted-foreground">
          {inline(block.text)}
        </p>
      );

    case "list": {
      const cls =
        "max-w-[var(--reading-max-w)] space-y-1.5 pl-5 text-[15px] leading-relaxed text-muted-foreground";
      const items = block.items.map((t, i) => <li key={i}>{inline(t)}</li>);
      return block.ordered ? (
        <ol className={`list-decimal ${cls}`}>{items}</ol>
      ) : (
        <ul className={`list-disc ${cls}`}>{items}</ul>
      );
    }

    case "note":
      return (
        <p className="max-w-[var(--reading-max-w)] rounded-r border-l-2 border-amber-500/70 bg-amber-500/10 px-4 py-2.5 text-[15px] leading-relaxed text-amber-900 dark:text-amber-200">
          {inline(block.text)}
        </p>
      );

    case "aside":
      return (
        <p className="max-w-[var(--reading-max-w)] rounded-r border-l-2 border-border bg-muted/40 px-4 py-2.5 text-[15px] leading-relaxed text-muted-foreground">
          {inline(block.text)}
        </p>
      );

    case "quote":
      return (
        <p className="max-w-[var(--reading-max-w)] font-heading text-lg font-semibold leading-snug text-foreground">
          {inline(block.text)}
        </p>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
          {block.text}
        </pre>
      );

    case "table":
      return (
        <figure className="space-y-2">
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {block.head.map((h, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap border-b px-4 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td
                        key={j}
                        className="border-b border-border/60 px-4 py-2.5 align-top text-muted-foreground last:border-b-0"
                      >
                        {inline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="max-w-[var(--reading-max-w)] text-[13.5px] text-muted-foreground">
              {inline(block.caption)}
            </figcaption>
          )}
        </figure>
      );

    case "figure": {
      const el = figures[block.figure];
      // Eine unaufgeloeste Figur verschwindet lautlos statt die Seite zu
      // zerreissen — der Test faengt sie, die Lesenden sollen es nicht ausbaden.
      if (el == null) return null;
      return (
        <figure className="space-y-2">
          {el}
          {block.caption && (
            <figcaption className="max-w-[var(--reading-max-w)] text-[13.5px] text-muted-foreground">
              {inline(block.caption)}
            </figcaption>
          )}
        </figure>
      );
    }
  }
}
