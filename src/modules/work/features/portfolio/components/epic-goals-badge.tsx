"use client";

import { useState, useActionState, startTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { EpicGoalLinkRow } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { SectionCard } from "@/components/ui/section-card";
import { GoalTreePicker } from "@/modules/core/goals/features/components/goal-tree-picker";
import {
  linkEpicToGoalAction,
  unlinkEpicFromGoalAction,
} from "@/modules/core/goals/features/actions/ziele";
import { formatDecimal } from "@/lib/formatting";
import type { Locale } from "@/i18n/routing";

/**
 * **Strategische Beiträge** — die per `GoalEpicLink` verknüpften Ziele dieses
 * Epics, je Ziel die Umrechnung „1 KPI-Einheit → x Ziel-Einheit".
 *
 * **Bis September 2026 war sie read-only**, und der einzige Weg zu einer
 * Verknüpfung führte über das Ziele-Modul: Epic verlassen, Ziel suchen, Epic
 * anhängen, zurück. Dabei gibt es den Picker längst — `GoalTreePicker`, ein
 * Baum mit Suche, benutzt vom Anlege-Dialog. Hier fehlte nur die Verdrahtung.
 *
 * **Zwei Handlungen, zwei Rechte** (ADR-0024 / Wiki „Die Wirkung"): das blosse
 * Anhängen ist Autorenarbeit am eigenen Epic und läuft unter `epic.update`;
 * einen **bezifferten** Beitrag zu binden — KPI, Umrechnungsfaktor,
 * Wirkungsart — ist eine Zusage und verlangt `kpi.bind`. Diese Kachel bietet
 * nur das Erste an; die Bezifferung bleibt im KPI-Reiter. `linkEpicToGoal`
 * entscheidet die Rechtefrage selbst (`epicLinkDeniedReason`), deshalb genügt
 * hier der Aufruf ohne KPI.
 *
 * **Sie rendert jetzt auch leer.** Vorher verschwand sie ohne Verknüpfung
 * ganz — auf einem frischen Epic also genau dann, wenn man sie gebraucht
 * hätte.
 */
interface Props {
  epicId: string;
  /** Einheiten-Kaskaden-Verknüpfungen (GoalEpicLink); leer = keine. */
  goalLinks?: EpicGoalLinkRow[];
  /** Das Verknüpfen von Zielen gehört zum Reifegrad, auf dem das Epic steht. */
  atGate?: boolean;
  /** `epic.update` — ohne das Recht bleibt die Kachel eine Leseansicht. */
  canEdit?: boolean;
}

export function EpicGoalsBadge({ epicId, goalLinks = [], atGate = false, canEdit = false }: Props) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [goalId, setGoalId] = useState("");
  const [open, setOpen] = useState(false);
  const [linkState, link, linking] = useActionState(linkEpicToGoalAction, {});
  const [unlinkState, unlink, unlinking] = useActionState(unlinkEpicFromGoalAction, {});
  const fehler = linkState.error ?? unlinkState.error;

  function verknuepfen() {
    if (!goalId) return;
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("goalId", goalId);
    startTransition(() => link(fd));
    setGoalId("");
    setOpen(false);
  }

  return (
    <SectionCard
      title={t("work.epic.strategischeBeitraege")}
      atGate={atGate}
      action={
        <Link
          href="/ziele"
          className="text-meta text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("work.epic.zieleModul")}
        </Link>
      }
    >
      {goalLinks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("work.epic.nochKeinZielVerknuepft")}</p>
      ) : (
        <ul className="space-y-1.5">
          {goalLinks.map((l) => (
            <li
              key={l.objectiveId}
              className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.goalTitle}</p>
                <p className="truncate text-label text-muted-foreground">
                  {l.kpiId && l.conversionFactor != null
                    ? `1 ${l.kpiUnit || t("work.epic.kpiEinheit")} → ${formatDecimal(
                        l.conversionFactor,
                        0,
                        locale,
                      )} ${l.goalUnit || ""}`
                    : t("work.epic.kpiFaktorImKpiTab")}
                </p>
              </div>
              <Link
                href={`/ziele?entity=objective&id=${l.objectiveId}`}
                className="text-label text-muted-foreground hover:text-foreground hover:underline"
                title={t("work.epic.imStrategieModulOeffnen")}
              >
                →
              </Link>
              {canEdit && (
                <button
                  type="button"
                  disabled={unlinking}
                  aria-label={t("work.epic.verknuepfungLoesenFuer", { titel: l.goalTitle })}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("epicId", epicId);
                    fd.set("goalId", l.objectiveId);
                    startTransition(() => unlink(fd));
                  }}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit &&
        (open ? (
          <div className="mt-2 space-y-2 border-t pt-2">
            <GoalTreePicker value={goalId} onChange={setGoalId} />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={linking || !goalId}
                onClick={verknuepfen}
                className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {t("work.epic.verknuepfen")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setGoalId("");
                }}
                className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
              >
                {t("common.ui.abbrechen")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {t("work.epic.zielVerknuepfen")}
          </button>
        ))}

      {fehler && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {fehler}
        </p>
      )}
    </SectionCard>
  );
}
