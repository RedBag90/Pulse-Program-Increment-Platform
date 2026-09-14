import type { ReactNode } from "react";

/**
 * Der schmalste denkbare Inline-Formatter: `**fett**` und `` `code` ``.
 *
 * Pulse hat kein Markdown-Rendering, und dieses Wiki fuehrt keines ein — zwei
 * Auszeichnungen tragen die elf Anleitungen vollstaendig, und mehr zu koennen
 * hiesse, eine Bibliothek und ihre Angriffsflaeche fuer nichts einzuhandeln.
 * Es wird **nichts** als HTML interpretiert; alles laeuft ueber React-Knoten.
 */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Ein Durchlauf, zwei Muster — die Reihenfolge im Regex entscheidet nichts,
  // weil sich `**` und `` ` `` in der Praxis nicht schachteln.
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) {
      out.push(
        <strong key={k++} className="font-semibold text-foreground">
          {m[1]}
        </strong>,
      );
    } else if (m[2] != null) {
      out.push(
        <code
          key={k++}
          className="rounded-sm bg-muted px-1 py-0.5 font-mono text-code text-foreground"
        >
          {m[2]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
