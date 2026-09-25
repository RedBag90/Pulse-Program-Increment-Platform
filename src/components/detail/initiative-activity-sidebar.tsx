"use client";

import { useTranslations } from "next-intl";
import type { FieldChange } from "@/modules/core/kernel/domain/change-log";
import { useState } from "react";
import { Activity, FileText, Layers, Target, type LucideIcon } from "lucide-react";
import { useLocale } from "next-intl";
import {
  ACTIVITY_GROUPS,
  actionGroup,
  actionLabelKey,
  userLabel,
  initials,
} from "@/components/detail/initiative-labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/** A single audit entry, pre-serialised on the server for the client boundary. */
/**
 * **Was sich geändert hat, unter dem Ereignis.**
 *
 * Ein Wert kommt entweder als Katalog-Schlüssel (Aufzählungen, Ja/Nein) oder
 * als fertiger Text (ein aufgelöster Name, ein Datum) — die Unterscheidung
 * trifft der View, nicht diese Zeile. Fehlen beide Werte, steht nur der
 * Feldname da: bei Freitext ist das Absicht, bei einer Id heisst es „Name
 * nicht zur Hand".
 */
export function ChangeLines({ changes }: { changes: readonly FieldChange[] }) {
  const t = useTranslations();
  if (changes.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {changes.map((c) => {
        const wert = (v: FieldChange["from"]) =>
          v == null ? null : v.kind === "key" ? t(v.key) : v.text;
        const von = wert(c.from);
        const nach = wert(c.to);
        return (
          <li key={c.field} className="text-meta text-muted-foreground">
            <span className="text-foreground/80">{t(c.labelKey)}</span>
            {nach != null && (
              <>
                {": "}
                {von != null && (
                  <>
                    <span className="line-through opacity-70">{von}</span>
                    {" → "}
                  </>
                )}
                <span className="text-foreground/80">{nach}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface ActivityItem {
  id: string;
  action: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** The acting user's id (resolved to a label via `userLabels`). */
  actorId?: string | undefined;
  /** Free-text approval/feedback comment attached to this entry, if any. */
  comment?: string | undefined;
  /** Context for the comment, e.g. the party ("Finance") or section ("Breakdown"). */
  detail?: string | undefined;
  /**
   * **Welche Felder sich geändert haben** — aus `auditEvent.changes`, im View
   * aufgelöst. Leer, solange eine Fläche sie nicht liefert (Feature-Historie);
   * die Zeile sagt dann weiterhin nur, *dass* etwas geändert wurde.
   */
  changes?: FieldChange[] | undefined;
}

/**
 * **Ein Symbol je Reiter** — Kontext, keine Aussage.
 *
 * Vorher hing es am ersten Segment des Aktionsnamens und führte einen Eintrag
 * für `kpi`, der nie greifen konnte: KPI-Ereignisse schreiben
 * `resourceType: "kpi"` und erscheinen in diesem Feed gar nicht.
 */
const GROUP_ICON: Record<string, LucideIcon> = {
  overview: FileText,
  gate: Layers,
  kpis: Target,
};

/**
 * Relative Zeit in der Sprache des Lesers.
 *
 * Hier stand `vor ${min} Minute${min === 1 ? "" : "n"}` — eine deutsche
 * Pluralregel im Quelltext. `Intl.RelativeTimeFormat` kennt sie für jede
 * Sprache, die das Routing führt.
 */
function relativeTime(iso: string, now: number, locale: string): string {
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return fmt.format(0, "minute");
  if (min < 60) return fmt.format(-min, "minute");
  const hrs = Math.round(min / 60);
  if (hrs < 24) return fmt.format(-hrs, "hour");
  return fmt.format(-Math.round(hrs / 24), "day");
}

/**
 * Right-hand activity feed — an initiative's audit trail (Epic or Feature),
 * newest first, with a category filter. Read-only. Approval/feedback comments
 * (Hypothesis, Party- and Section-sign-offs) are surfaced inline via the
 * entry's `comment` field; the `detail` field carries their party/section
 * context.
 */
export function InitiativeActivitySidebar({
  events,
  userLabels = {},
  truncated = false,
}: {
  events: ActivityItem[];
  /** Resolved user-id → display label (email) map for the actor line. */
  userLabels?: Record<string, string>;
  /**
   * `true` ⇒ es gibt aeltere Ereignisse, die nicht geladen wurden. Ohne diesen
   * Hinweis behauptete die Spalte Vollstaendigkeit und schnitt still bei 50 ab.
   */
  truncated?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [filter, setFilter] = useState("all");
  const now = Date.now();

  /**
   * **Gefiltert und gruppiert wird nach dem Reiter**, nicht nach dem ersten
   * Segment des Aktionsnamens. Das bot bisher „epic" und „initiative" an — roh
   * gerendert, und beides bezeichnet dasselbe Ding: das Vokabular trägt
   * historisch beide Präfixe. Die Aufteilung war nicht bloss unübersetzt,
   * sondern bedeutungslos.
   */
  const vorhanden = new Set(events.map((e) => actionGroup(e.action)));
  const gruppen = ACTIVITY_GROUPS.filter((g) => vorhanden.has(g));
  const shown = filter === "all" ? events : events.filter((e) => actionGroup(e.action) === filter);

  // Unter `lg` rutscht die Spalte unter den Inhalt statt ihn zu verengen.
  return (
    <aside className="w-full shrink-0 border-t bg-surface-frame lg:w-72 lg:border-l lg:border-t-0">
      <div className="space-y-2 border-b p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("common.detail.aktivitaet")}
        </p>
        <select
          aria-label={t("common.detail.aktivitaetFiltern")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="all">{t("common.detail.allesAnzeigen")}</option>
          {gruppen.map((g) => (
            <option key={g} value={g}>
              {t(`common.activity.group.${g}`)}
            </option>
          ))}
        </select>
      </div>

      {/*
        **Die Spalte bestimmt nicht mehr die Seitenhöhe.** Die Schale legt
        Reiter, Inhalt und Spalte in eine Zeile mit `min-h-[70vh]` und ohne
        `max-h`: die Zeile wuchs also auf die Höhe ihres grössten Kindes, und
        das war diese Liste mit bis zu fünfzig dreizeiligen Einträgen. Das
        `overflow-auto` am Inhalt half nicht — was nie gestaucht wird, scrollt
        auch nie.

        Nichts wird versteckt: alle Einträge bleiben erreichbar, der Hinweis
        auf ältere ebenso. Es ändert sich nur, wer die Höhe vorgibt.
      */}
      <div className="lg:max-h-[70vh] lg:overflow-y-auto">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Activity className="h-5 w-5" />
            {t("common.detail.keineAktivitaet")}
          </div>
        ) : (
          <ul className="divide-y">
            {shown.map((e) => {
              const actor = e.actorId ? userLabel(e.actorId, userLabels) : null;
              const gruppe = actionGroup(e.action);
              const Icon = GROUP_ICON[gruppe] ?? Activity;
              return (
                <li
                  key={e.id}
                  className="flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <Avatar size="sm" className="mt-0.5">
                    <AvatarFallback>{actor ? initials(actor) : "—"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      {actor && <span className="font-medium text-foreground">{actor}</span>}{" "}
                      <span className="text-muted-foreground">{t(actionLabelKey(e.action))}</span>
                      {e.detail && (
                        <span className="ml-1 rounded-sm bg-muted px-1.5 py-0.5 text-meta text-muted-foreground">
                          {e.detail}
                        </span>
                      )}
                    </p>
                    {e.changes && <ChangeLines changes={e.changes} />}
                    {e.comment && (
                      <p className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-2 text-sm text-foreground/80">
                        {e.comment}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3 shrink-0" />
                      {t(`common.activity.group.${gruppe}`)}
                      {" · "}
                      {relativeTime(e.occurredAt, now, locale)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {truncated && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {t("common.detail.nurDieLetztenEreignisse")}
        </p>
      )}
    </aside>
  );
}
