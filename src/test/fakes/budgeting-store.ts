/**
 * Ein kleiner Speicher, der sich wie Prisma **verhält** — für die Loader des
 * Budget-Moduls.
 *
 * Warum nicht der übliche Beutel aus `vi.fn()`: der gibt feste Zeilen zurück,
 * ganz gleich, was im `where` steht. Ein Test kann damit nur behaupten, **wie**
 * die Abfrage aussah (`expect(query.mock.calls[0][0])`), nicht **was** sie
 * ergibt. Solche Behauptungen brechen, sobald jemand die Abfrage umbaut,
 * obwohl das Verhalten stimmt — in dieser Sitzung ist das zweimal passiert.
 *
 * Dieser Speicher wertet das `where` gegen gesetzte Zeilen aus. Damit lässt
 * sich schreiben: „eine deaktivierte Position, und die Summe bleibt 0" — also
 * Verhalten, ohne Datenbank.
 *
 * **Er ist absichtlich klein und kein Prisma-Nachbau.** Unterstützt werden:
 *
 *  - Gleichheit (`{ kind: "art_change" }`), `in`, `not`, und `null`
 *  - **eine** Ebene Relationsfilter, und nur die hier erklärten Relationen
 *  - `select` wird ignoriert; die Zeile kommt vollständig zurück, plus die
 *    aufgelöste Relation
 *
 * Alles darüber hinaus gehört in einen Integrationstest gegen eine echte
 * Datenbank (`*.integration.test.ts`). Wo dieser Speicher nicht reicht, ist das
 * ein Hinweis, dass die Frage eine Datenbank braucht — nicht, dass er wachsen
 * sollte.
 */

/** Die Relationen, die dieser Speicher kennt. Bewusst eine kurze, explizite Liste. */
const RELATIONS: Record<string, Record<string, { model: string; localKey: string }>> = {
  rtbItemAward: { rtbItem: { model: "runTheBusinessItem", localKey: "rtbItemId" } },
  budgetCandidate: { round: { model: "budgetRound", localKey: "roundId" } },
};

type Row = Record<string, unknown>;
export type Rows = Record<string, Row[]>;

/** Passt eine Zeile auf einen Filterwert? */
function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (typeof expected === "object" && expected !== null && !(expected instanceof Date)) {
    const op = expected as Record<string, unknown>;
    if ("in" in op) return (op.in as unknown[]).includes(actual);
    if ("notIn" in op) return !(op.notIn as unknown[]).includes(actual);
    if ("not" in op) {
      // `{ not: null }` heißt „gesetzt".
      return op.not === null ? actual != null : actual !== op.not;
    }
    if ("gt" in op) return Number(actual) > Number(op.gt);
    if ("gte" in op) return Number(actual) >= Number(op.gte);
    if ("lt" in op) return Number(actual) < Number(op.lt);
    if ("contains" in op) return String(actual ?? "").includes(String(op.contains));
    return false;
  }
  return actual === expected;
}

function matches(model: string, row: Row, where: Row | undefined, all: Rows): boolean {
  if (!where) return true;
  for (const [field, expected] of Object.entries(where)) {
    const rel = RELATIONS[model]?.[field];
    if (rel) {
      const target = all[rel.model]?.find((r) => r.id === row[rel.localKey]);
      if (!target) return false;
      if (!matches(rel.model, target, expected as Row, all)) return false;
      continue;
    }
    if (field === "OR") {
      const any = (expected as Row[]).some((w) => matches(model, row, w, all));
      if (!any) return false;
      continue;
    }
    if (!matchValue(row[field], expected)) return false;
  }
  return true;
}

/** Hängt die erklärten Relationen an die Zeile, damit `select` sie findet. */
function withRelations(model: string, row: Row, all: Rows): Row {
  const rels = RELATIONS[model];
  if (!rels) return row;
  const out: Row = { ...row };
  for (const [name, rel] of Object.entries(rels)) {
    out[name] = all[rel.model]?.find((r) => r.id === row[rel.localKey]) ?? null;
  }
  return out;
}

export interface BudgetingStore {
  /** Als Prisma-Client an die Loader zu reichen. */
  db: never;
  /** Zeilen nachlegen — die Loader sehen sie beim nächsten Aufruf. */
  put: (model: string, rows: Row[]) => void;
}

/**
 * Baut den Speicher. Die Modelle, die nicht gesetzt werden, sind leer — kein
 * Test muss deklarieren, was er nicht braucht.
 */
export function budgetingStore(seed: Rows = {}) {
  const rows: Rows = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, [...v]]));

  const model = (name: string) => ({
    findMany: async (args?: { where?: Row }) =>
      (rows[name] ?? [])
        .filter((r) => matches(name, r, args?.where, rows))
        .map((r) => withRelations(name, r, rows)),
    findFirst: async (args?: { where?: Row }) => {
      const hit = (rows[name] ?? []).find((r) => matches(name, r, args?.where, rows));
      return hit ? withRelations(name, hit, rows) : null;
    },
    findUnique: async (args?: { where?: Row }) => {
      const hit = (rows[name] ?? []).find((r) => matches(name, r, args?.where, rows));
      return hit ? withRelations(name, hit, rows) : null;
    },
    count: async (args?: { where?: Row }) =>
      (rows[name] ?? []).filter((r) => matches(name, r, args?.where, rows)).length,
  });

  // Jeder Modellname wird beim Zugriff erzeugt — der Speicher muss die Liste
  // der Tabellen nicht kennen.
  const db = new Proxy(
    {},
    {
      get: (_t, prop: string) => (prop === "then" ? undefined : model(prop)),
    },
  );

  return {
    db: db as never,
    put: (name: string, add: Row[]) => {
      rows[name] = [...(rows[name] ?? []), ...add];
    },
  };
}
