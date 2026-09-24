// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

/**
 * **Was in `reason` und `detail` steht, ist ein Katalog-Schlüssel** (ADR-0024,
 * Regel 2). Ein Service kennt die Sprache seines Lesers nicht — er sagt, *was*
 * schiefging, und die Anzeigenaht sagt es in der Sprache des Nutzers.
 *
 * `values` trägt die Zahlen und Namen, die im Satz vorkommen. Ohne dieses Feld
 * wäre die Umstellung an 22 Meldungen gescheitert, die nicht ohne Wert
 * auskommen („Die Summe überschreitet den Rahmen um 4.200 €"): ein Schlüssel
 * mit Platzhaltern passt nicht in eine Zeichenkette, und den Satz vorab
 * zusammenzusetzen hiesse, ihn auf Deutsch festzulegen.
 *
 * Ein Wert, den der Katalog nicht kennt, kommt unverändert zurück — deshalb
 * liess sich der Umbau überhaupt stückweise machen.
 */
export type MessageValues = Record<string, string | number>;

export type DomainError =
  | {
      kind: "hierarchy_violation";
      violatedConstraint: string;
      detail: string;
      values?: MessageValues;
    }
  | { kind: "not_found"; resourceType: string; id: string }
  | { kind: "forbidden"; reason: string; values?: MessageValues }
  | { kind: "conflict"; reason: string; values?: MessageValues }
  | { kind: "validation"; issues: unknown[] }
  | { kind: "tenant_mismatch"; detail: string; values?: MessageValues }
  | { kind: "pyramid_violated"; kpiId: string; existingKeyResultId: string };

// ---------------------------------------------------------------------------
// Result monad — services return this, never throw for expected errors
// ---------------------------------------------------------------------------

export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends DomainError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } {
  return !result.ok;
}
