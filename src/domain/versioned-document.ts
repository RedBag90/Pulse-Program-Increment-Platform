/**
 * VersionedDocument — the shared shape of a long-form artefact persisted on an
 * Initiative with a saved-version history. Used today by the Epic's Business
 * Case and Benefit Hypothesis; the two modules used to declare parallel
 * `Version` + wrapper types and parallel parse functions. This module owns the
 * envelope and the parse + save-new-version mechanics; the artefact modules
 * own the `Fields` shape and the "has content" predicate.
 *
 * Concentration test: any future change to history semantics (cap size,
 * pruning rule, soft-delete marker, signed-off-by metadata) flips here, not
 * in every artefact module. A new artefact (e.g. Solution Vision) imports
 * the envelope rather than re-coding it.
 */

export interface VersionSnapshot<TFields> {
  content: TFields;
  /** ISO timestamp of when this version was superseded. */
  savedAt: string;
  /** userId that saved this version. */
  savedBy: string;
}

export interface VersionedDocument<TFields> {
  current: TFields;
  history: VersionSnapshot<TFields>[];
}

/**
 * Reads a stored versioned-document JSON value. Accepts both the versioned
 * shape (`{ current, history }`) and a legacy flat shape (fields at the top
 * level, no history). `normalize` lets an artefact migrate per-field legacy
 * shapes (e.g. Business Case's `costRows` → `costSlices`) before the result
 * is returned.
 */
export function parseVersionedDocument<TFields>(
  raw: unknown,
  normalize: (fields: TFields) => TFields = (f) => f,
  fallback: TFields = {} as TFields,
): VersionedDocument<TFields> {
  if (raw == null || typeof raw !== "object") {
    return { current: fallback, history: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("current" in obj) {
    return {
      current: normalize((obj["current"] as TFields | null) ?? fallback),
      history: Array.isArray(obj["history"]) ? (obj["history"] as VersionSnapshot<TFields>[]) : [],
    };
  }
  return { current: normalize(obj as TFields), history: [] };
}

/**
 * Build the next document when the caller writes `nextFields`: if the previous
 * `current` carried content, snapshot it into history (with `savedAt`/`savedBy`),
 * capped at `historyLimit`. Otherwise leave history untouched — the previous
 * empty draft isn't worth a snapshot.
 */
export function appendVersion<TFields>(args: {
  previous: VersionedDocument<TFields>;
  nextFields: TFields;
  hasContent: (fields: TFields) => boolean;
  savedBy: string;
  historyLimit: number;
  /** Timestamp source — injectable for deterministic tests. */
  now?: () => Date;
}): VersionedDocument<TFields> {
  const now = args.now ?? (() => new Date());
  const carry = args.hasContent(args.previous.current)
    ? [
        {
          content: args.previous.current,
          savedAt: now().toISOString(),
          savedBy: args.savedBy,
        },
        ...args.previous.history,
      ].slice(0, args.historyLimit)
    : args.previous.history;
  return { current: args.nextFields, history: carry };
}
