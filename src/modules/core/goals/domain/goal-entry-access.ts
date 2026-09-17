/**
 * Wer einen Eintrag im Ziel-Verlauf ändern oder entfernen darf — **als reine
 * Regel**.
 *
 * Der Verlauf eines Ziels ist ein Protokoll: Status-Check-ins und freie
 * Kommentare, jeder mit Verfasser und Zeitpunkt. Bisher war er
 * unveränderlich — es gab keinen Weg, einen Tippfehler zu berichtigen oder
 * einen versehentlich geposteten Eintrag zurückzunehmen.
 *
 * Die Regel, die den Zuschnitt trägt:
 *
 * > **Man darf einen Eintrag aus dem Protokoll entfernen, aber niemandem Worte
 * > in den Mund legen.**
 *
 * Daraus folgt die Asymmetrie:
 *
 * |            | Verfasser | `target.manage` |
 * |------------|-----------|-----------------|
 * | Bearbeiten | ja        | **nein**        |
 * | Löschen    | ja        | ja              |
 *
 * Wer ein Ziel pflegt, muss einen fehlgeleiteten oder unangemessenen Eintrag
 * wegnehmen können — das ist Moderation und sichtbar (die Zeile verschwindet).
 * Ihn *umzuschreiben* wäre es nicht: danach stünde unter fremdem Namen ein Satz,
 * den dieser Name nie gesagt hat. Wer inhaltlich widersprechen will, schreibt
 * einen eigenen Eintrag — dafür ist der Verlauf da.
 *
 * Dasselbe Muster wie `epicLinkDeniedReason`: `null` heißt erlaubt, sonst steht
 * da, **warum** nicht.
 *
 * Rein, kein I/O.
 */

export interface GoalEntryAccessFacts {
  /** Wer den Eintrag geschrieben hat (`createdBy`). */
  authorId: string;
  /** Wer gerade handelt. */
  actorId: string;
  /** Der Handelnde hält `target.manage` im Mandanten. */
  mayManage: boolean;
}

const NOT_AUTHOR_EDIT =
  "Einen fremden Eintrag kann niemand umschreiben — auch die Ziel-Pflege nicht. Wer widersprechen will, schreibt einen eigenen.";
const NOT_AUTHOR_DELETE =
  "Nur der Verfasser oder die Ziel-Pflege (Capability `target.manage`) kann einen Eintrag entfernen.";

/** `null` = erlaubt, sonst der Grund. Bearbeiten kann **nur** der Verfasser. */
export function goalEntryEditDeniedReason(facts: GoalEntryAccessFacts): string | null {
  return facts.authorId === facts.actorId ? null : NOT_AUTHOR_EDIT;
}

/** `null` = erlaubt, sonst der Grund. Löschen kann der Verfasser **oder** die Pflege. */
export function goalEntryDeleteDeniedReason(facts: GoalEntryAccessFacts): string | null {
  if (facts.authorId === facts.actorId) return null;
  return facts.mayManage ? null : NOT_AUTHOR_DELETE;
}

/** Für die Fläche: welche Affordances ein Eintrag zeigt. */
export interface GoalEntryPermissions {
  mayEdit: boolean;
  mayDelete: boolean;
}

export function goalEntryPermissions(facts: GoalEntryAccessFacts): GoalEntryPermissions {
  return {
    mayEdit: goalEntryEditDeniedReason(facts) === null,
    mayDelete: goalEntryDeleteDeniedReason(facts) === null,
  };
}
