export type ChangeMap = Record<string, { before: unknown; after: unknown }>;

/**
 * Builds an audit changelog by comparing before and after values for the given
 * keys. Only fields present in `after` (not undefined) that differ from `before`
 * are included. Undefined after-values are treated as "not in this update".
 */
export function buildChangelog<T extends object>(
  before: T,
  after: Partial<T>,
  keys: ReadonlyArray<keyof T>,
): ChangeMap {
  const changes: ChangeMap = {};
  for (const key of keys) {
    const afterVal = after[key];
    if (afterVal !== undefined && afterVal !== before[key]) {
      changes[String(key)] = { before: before[key], after: afterVal };
    }
  }
  return changes;
}

/**
 * **Die Anzeige-Form einer `ChangeMap`.**
 *
 * Sie steht hier und nicht im Work-Modul, weil die **Kern-Schale** sie
 * rendert: `initiative-activity-sidebar.tsx` ist Infrastruktur und darf kein
 * Feature-Modul importieren (ADR-0013). Was modul-spezifisch ist — welche
 * Felder es gibt, wie ihre Werte heissen — bleibt drüben in
 * `work/domain/audit-field-changes.ts`; hier steht nur die Form.
 */

/** Ein darstellbarer Wert: entweder ein Katalog-Schlüssel oder fertiger Text. */
export type ChangeValue = { kind: "key"; key: string } | { kind: "text"; text: string };

/** Eine Zeile unter einem Prüfpfad-Ereignis: welches Feld, von was auf was. */
export interface FieldChange {
  /** Der Spaltenname — nur als React-Schlüssel, nie auf dem Bildschirm. */
  field: string;
  /** Katalog-Schlüssel des Feldnamens. */
  labelKey: string;
  /** `null` = nicht darstellbar (Freitext, unbekannte Id) — dann nur der Name. */
  from: ChangeValue | null;
  to: ChangeValue | null;
}
