/**
 * Der **Verlauf eines Ziels** als eine Spur — **als reine Regel**.
 *
 * Drei Quellen laufen zusammen: Status-Check-ins, freie Kommentare und das
 * Prüfprotokoll. Zwei davon tragen Text, die dritte nur die Tatsache, dass
 * etwas geschah.
 *
 * **Warum das nicht einfach ein `concat().sort()` ist.** Ein Status-Check-in
 * wird auf **UTC-Mitternacht des gewählten Tages** gestempelt, sein
 * Prüf-Ereignis `goal.checkin` dagegen auf *jetzt*. Beide heißen im Feed
 * „Status-Check-in", sortiert wird nach Zeit — also stand bis zu 24 Stunden
 * lang die **inhaltslose** Zeile über der inhaltstragenden. Wer ein
 * Status-Update mit Kommentar schrieb, sah obenauf ein „Status-Check-in" ohne
 * ein Wort darin und schloss daraus, der Kommentar sei nicht gespeichert
 * worden.
 *
 * Dass die Kollision echt ist, stand schon im Code: `goal-detail-panel.tsx`
 * leitet „Latest status" ausdrücklich **nicht** aus dem Feed ab, „dort
 * kollidiert das gleichnamige Audit-Event `goal.checkin` (ohne detail)". Bisher
 * wurde sie umgangen; hier wird sie behoben.
 *
 * Die Regel: **wer eine eigene Zeile hat, bekommt keine zweite.** Für die drei
 * Ereignisse, die aus einer Check-in- oder Kommentarzeile entstehen, ist diese
 * Zeile der Eintrag — sie trägt Verfasser, Zeit, Status, Wert und Text. Im
 * Prüfprotokoll selbst bleiben sie selbstverständlich stehen; dort ist die
 * Doppelung keine, sondern der Zweck.
 *
 * Rein, kein I/O.
 */

/** One block of a structured status update. */
export interface GoalUpdateSection {
  title: string;
  body: string;
}

/** Ein Check-in, so wie er aus der Zeile kommt. */
export interface ActivityCheckin {
  id: string;
  status: string | null;
  value: number | null;
  note: string | null;
  sections: GoalUpdateSection[] | null;
  at: string;
  by: string;
}

/** Ein freier Kommentar. */
export interface ActivityComment {
  id: string;
  body: string;
  at: string;
  by: string;
}

/** Eine Zeile aus dem Prüfprotokoll. */
export interface ActivityAudit {
  id: string;
  action: string;
  at: string;
  by?: string | undefined;
}

/** Woraus die Zeile stammt — entscheidet, welche Aktion sie bearbeiten kann. */
export type GoalEntryKind = "checkin" | "comment" | "audit";

export interface GoalActivityEntry {
  id: string;
  /** audit action, or synthetic `goal.checkin` / `goal.comment` / `goal.progress`. */
  action: string;
  at: string;
  by?: string | undefined;
  /** Free-text (check-in note or comment body). */
  comment?: string | undefined;
  /** Context, e.g. the check-in status label. */
  detail?: string | undefined;
  /** Structured status-update sections (Epic 4), when present. */
  sections?: GoalUpdateSection[] | undefined;
  /** Welche Quelle — `audit` ist unveränderlich. */
  kind: GoalEntryKind;
  /** Die Roh-Id der Zeile (ohne `checkin-`/`comment-`-Präfix); `null` bei Audit. */
  entryId: string | null;
}

/**
 * Die Prüf-Ereignisse, die schon eine eigene, reichere Zeile haben. Sie stammen
 * aus `recordGoalCheckin`, `recordGoalProgress` und `addGoalComment`
 * (`server/audit/emit.ts`).
 */
const DOUBLED_AUDIT_ACTIONS: ReadonlySet<string> = new Set([
  "goal.checkin",
  "goal.progress.updated",
  "goal.comment.added",
]);

/**
 * Neueste zuerst. Bei gleichem Zeitstempel entscheidet die Id, damit die Spur
 * stabil bleibt (zwei Einträge derselben Sekunde sollen nicht bei jedem Laden
 * die Plätze tauschen).
 */
export function buildGoalActivity(
  checkins: readonly ActivityCheckin[],
  comments: readonly ActivityComment[],
  audits: readonly ActivityAudit[],
): GoalActivityEntry[] {
  const entries: GoalActivityEntry[] = [
    // Status-Check-ins vs. reine Fortschritts-Einträge (status = null).
    ...checkins.map((c) => ({
      id: `checkin-${c.id}`,
      action: c.status != null ? "goal.checkin" : "goal.progress",
      at: c.at,
      by: c.by,
      comment: c.note ?? undefined,
      detail: c.status ?? (c.value != null ? `→ ${c.value}` : undefined),
      sections: c.sections && c.sections.length > 0 ? c.sections : undefined,
      kind: "checkin" as const,
      entryId: c.id,
    })),
    ...comments.map((c) => ({
      id: `comment-${c.id}`,
      action: "goal.comment",
      at: c.at,
      by: c.by,
      comment: c.body,
      kind: "comment" as const,
      entryId: c.id,
    })),
    ...audits
      .filter((a) => !DOUBLED_AUDIT_ACTIONS.has(a.action))
      .map((a) => ({
        id: a.id,
        action: a.action,
        at: a.at,
        by: a.by,
        kind: "audit" as const,
        entryId: null,
      })),
  ];
  return entries.sort((x, y) => (x.at === y.at ? (x.id < y.id ? 1 : -1) : x.at < y.at ? 1 : -1));
}
