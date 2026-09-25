/**
 * **Was sich geändert hat — aus dem Prüfpfad in die Zeitleiste.**
 *
 * Jede Änderung an einem Epic läuft durch `recordedUpdate` und schreibt eine
 * Feld-für-Feld-Aufstellung nach `auditEvent.changes`: dreizehn Felder, jedes
 * mit Vorher und Nachher. Geladen wurde sie längst; eine Zeile vor der Anzeige
 * hat der View sie weggeworfen und nur den Gate-Kommentar herausgezogen. Auf
 * dem Bildschirm stand deshalb neunmal „Angaben im Overview geändert" und nie,
 * welche.
 *
 * **Diese Datei liefert Schlüssel, keine Wörter** (ADR-0024, Regel 2). Was sich
 * nicht als Schlüssel ausdrücken lässt — ein aufgelöster Name, ein Datum —,
 * kommt als fertiger Text herein und geht als solcher hinaus; die Unterscheidung
 * steht im Typ, damit die Oberfläche nicht raten muss.
 *
 * Rein, kein I/O.
 */

import type { ChangeValue, FieldChange } from "@/modules/core/kernel/domain/change-log";

export type { ChangeValue, FieldChange };

/**
 * Die dreizehn Felder aus der `fields`-Liste von `updateEpic`.
 *
 * **Ein Feld ohne Eintrag wird weggelassen, nicht roh angezeigt.** Ein
 * Spaltenname auf dem Bildschirm wäre derselbe Fehler wie ein Katalog-Schlüssel,
 * nur mit anderen Zeichen.
 */
export const EPIC_FIELD_KEYS: Record<string, string> = {
  title: "work.auditField.title",
  description: "work.auditField.description",
  needsSteeringAttention: "work.auditField.needsSteeringAttention",
  stagedForBudgeting: "work.auditField.stagedForBudgeting",
  helpRequestedAt: "work.auditField.helpRequested",
  plannedStartAt: "work.auditField.plannedStartAt",
  plannedEndAt: "work.auditField.plannedEndAt",
  epicType: "work.auditField.epicType",
  investmentHorizon: "work.auditField.investmentHorizon",
  intendedClass: "work.auditField.intendedClass",
  valueStreamId: "work.auditField.valueStreamId",
  artId: "work.auditField.artId",
  primarySolutionId: "work.auditField.primarySolutionId",
};

/**
 * Felder, deren Wert **nicht** angezeigt wird — nur, dass sie sich geändert
 * haben.
 *
 * Ein Titel oder eine Beschreibung ist ein Absatz, und ein Absatz in einer
 * Zeitleiste ist keine Auskunft, sondern eine Wand. Wer den neuen Titel sehen
 * will, liest ihn oben auf der Seite.
 */
const OHNE_WERT = new Set(["title", "description"]);

/** Felder, die eine Id tragen — ohne aufgelösten Namen schweigen sie. */
const IDS = new Set(["valueStreamId", "artId", "primarySolutionId"]);

export interface FieldChangeContext {
  /**
   * Id → Anzeigename. Gibt `null` zurück, wenn der Name nicht zur Hand ist —
   * dann steht kein Wert da. Eine UUID auf dem Bildschirm wäre der schlechtere
   * Handel.
   */
  nameOf: (id: string) => string | null;
  /** Aufzählungswert → Katalog-Schlüssel, je Feld; `null` für Unbekanntes. */
  enumKey: (field: string, value: string) => string | null;
  /** ISO-Zeitstempel → Datum in Lesersprache. */
  formatDay: (iso: string) => string;
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}/;

function wertVon(field: string, wert: unknown, ctx: FieldChangeContext): ChangeValue | null {
  if (wert == null || wert === "") return null;

  if (IDS.has(field)) {
    if (typeof wert !== "string") return null;
    const name = ctx.nameOf(wert);
    return name == null ? null : { kind: "text", text: name };
  }
  if (typeof wert === "boolean") {
    return { kind: "key", key: wert ? "common.ja" : "common.nein" };
  }
  if (typeof wert === "number") return { kind: "text", text: String(wert) };
  if (typeof wert === "string") {
    const key = ctx.enumKey(field, wert);
    if (key != null) return { kind: "key", key };
    // Das Einzige, was hier sonst noch als Zeichenkette ankommt, ist ein
    // Zeitstempel — die Datums-Spalten serialisieren als ISO.
    return ISO_TAG.test(wert) ? { kind: "text", text: ctx.formatDay(wert) } : null;
  }
  return null;
}

/**
 * Die Aufstellung eines Ereignisses als lesbare Zeilen.
 *
 * Unbekannte Felder fallen weg; bleibt nichts übrig, ist die Liste leer, und
 * die Zeile sagt weiterhin nur, *dass* etwas geändert wurde.
 */
export function fieldChanges(changes: unknown, ctx: FieldChangeContext): FieldChange[] {
  if (changes == null || typeof changes !== "object") return [];

  const out: FieldChange[] = [];
  for (const [field, roh] of Object.entries(changes as Record<string, unknown>)) {
    const labelKey = EPIC_FIELD_KEYS[field];
    if (labelKey === undefined) continue;
    if (roh == null || typeof roh !== "object") continue;

    if (OHNE_WERT.has(field)) {
      out.push({ field, labelKey, from: null, to: null });
      continue;
    }
    const paar = roh as { before?: unknown; after?: unknown };
    out.push({
      field,
      labelKey,
      from: wertVon(field, paar.before, ctx),
      to: wertVon(field, paar.after, ctx),
    });
  }
  return out;
}
