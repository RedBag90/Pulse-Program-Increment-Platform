import type { DomainError, Result } from "./errors";
import { ok, err } from "./errors";

/**
 * Custom Fields an Ziel-Knoten (Epic 7). Feld-Typen + Wert-Validierung.
 * `type` und `value` werden als String gehalten; hier ist der Domain-Seam,
 * der gegen den Typ prüft/normalisiert.
 */
export const CUSTOM_FIELD_TYPES = ["text", "number", "select"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export function isCustomFieldType(s: string): s is CustomFieldType {
  return (CUSTOM_FIELD_TYPES as readonly string[]).includes(s);
}

/** Select-Optionen aus dem Json-Feld lesen (nur Strings). */
export function parseOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/**
 * Validiert + normalisiert einen Roh-Wert gegen seinen Feldtyp.
 * Leerer Wert (nach Trim) ⇒ `ok("")` — Signal „löschen" an den Service.
 * - number: muss numerisch sein.
 * - select: muss eine der Optionen sein.
 * - text: frei.
 */
export function validateCustomFieldValue(
  type: CustomFieldType,
  value: string,
  options: string[],
): Result<string, DomainError> {
  const v = value.trim();
  if (v === "") return ok("");
  if (type === "number") {
    if (!Number.isFinite(Number(v))) {
      return err({ kind: "validation", issues: ["Wert muss numerisch sein."] });
    }
    return ok(v);
  }
  if (type === "select") {
    if (!options.includes(v)) {
      return err({
        kind: "validation",
        issues: [`Wert muss eine der Optionen sein: ${options.join(", ")}`],
      });
    }
    return ok(v);
  }
  return ok(v);
}
