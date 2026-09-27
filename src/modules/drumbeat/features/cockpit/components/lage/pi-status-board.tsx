"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";
import { setFeatureDeliveryStatusAction } from "@/modules/work/features/feature/actions/feature";
import { setFeatureDeliveryStatus } from "@/modules/work/features/feature/lib/feature-actions-client";
import type { CockpitFeature } from "@/modules/drumbeat/domain/cockpit-types";
import {
  FEATURE_STATUS_KEYS,
  needsReasonForStatus,
  type FeatureStatus,
} from "@/modules/drumbeat/domain/status";
import { FEATURE_STATUS_LANE } from "@/modules/drumbeat/features/lib/status-badges";
import { StatusReasonDialog } from "@/modules/drumbeat/features/cockpit/components/status-reason-dialog";
import {
  FeatureCard,
  FeatureCardPreview,
} from "@/modules/drumbeat/features/cockpit/components/feature-card";
import { BoardDndProvider, useDropCell } from "@/modules/drumbeat/features/lib/board-dnd";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * **Board dieses PIs** — nur die Features des gewählten PIs, eine Spalte je
 * Status. Kein Backlog, keine anderen PIs: im laufenden PI geht es darum, was
 * hier liegt, nicht wohin es noch könnte. Ein PI-Wechsel bleibt Sache des
 * grossen Boards.
 *
 * Ziehen (Maus oder Finger, `board-dnd.tsx`) setzt den Status — über dieselbe Action und dieselbe Rückfrage bei
 * „blockiert"/„verworfen" wie das grosse Board, optimistisch wie dort. Das
 * Kartenmenü ist die Tastatur-Alternative. Verworfene stehen eingeklappt
 * darunter.
 */
const COLUMNS: readonly FeatureStatus[] = ["approved", "in_progress", "blocked", "completed"];

export function PiStatusBoard({
  features,
  piName,
  canSetDelivery,
  canScoreWsjf,
  attentionIds,
}: {
  /** Die Features des PIs aus dem Cockpit-Modell (folgen den Toolbar-Filtern). */
  features: CockpitFeature[];
  piName: string;
  canSetDelivery: boolean;
  canScoreWsjf: boolean;
  /** Was „Braucht jetzt Hilfe" meldet — für den Filter „Nur Auffällige". */
  attentionIds: ReadonlySet<string>;
}) {
  const t = useTranslations();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nurAuffaellige, setNurAuffaellige] = useState(false);
  const [prompt, setPrompt] = useState<{ id: string; to: FeatureStatus } | null>(null);

  const [view, patch] = useOptimistic<CockpitFeature[], { id: string; status: FeatureStatus }>(
    features,
    (current, p) => current.map((f) => (f.id === p.id ? { ...f, status: p.status } : f)),
  );

  const sichtbar = nurAuffaellige ? view.filter((f) => attentionIds.has(f.id)) : view;
  const verworfen = sichtbar.filter((f) => f.status === "cancelled");

  function commit(id: string, to: FeatureStatus, reason?: string) {
    startTransition(async () => {
      patch({ id, status: to });
      const res = await setFeatureDeliveryStatus(setFeatureDeliveryStatusAction, {
        id,
        to,
        ...(reason ? { reason } : {}),
      });
      setError(res.error ?? null);
    });
  }

  function move(id: string, to: FeatureStatus) {
    const f = features.find((x) => x.id === id);
    if (!f || f.status === to || !canSetDelivery) return;
    if (needsReasonForStatus(to)) {
      setPrompt({ id, to });
      return;
    }
    commit(id, to);
  }

  return (
    <BoardDndProvider
      onDrop={(id, status) => move(id, status as FeatureStatus)}
      renderOverlay={(id) => {
        const f = view.find((x) => x.id === id);
        return f ? <FeatureCardPreview feature={f} /> : null;
      }}
      describe={{
        card: (id) => view.find((x) => x.id === id)?.title ?? id,
        target: (status) => t(FEATURE_STATUS_KEYS[status as FeatureStatus]),
      }}
    >
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("drumbeat.lage.board.titel")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("drumbeat.lage.board.text", { pi: piName, n: features.length })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={nurAuffaellige ? "default" : "outline"}
            aria-pressed={nurAuffaellige}
            onClick={() => setNurAuffaellige((v) => !v)}
          >
            {t("drumbeat.lage.board.nurAuffaellige")}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((status) => {
            const karten = sichtbar.filter((f) => f.status === status);
            const js = karten.reduce((s, f) => s + (f.wsjfJobSize ?? 0), 0);
            return (
              <StatusColumn
                key={status}
                status={status}
                label={t(FEATURE_STATUS_KEYS[status])}
                summary={t("drumbeat.lage.board.summe", { n: karten.length, js })}
              >
                {karten.map((f) => (
                  <div key={f.id} className="group/card relative">
                    <FeatureCard feature={f} canDrag={canSetDelivery} canScore={canScoreWsjf} />
                    {canSetDelivery && <StatusMenu feature={f} onMove={move} />}
                  </div>
                ))}
              </StatusColumn>
            );
          })}
        </div>

        {verworfen.length > 0 && (
          <details className="group/v">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {t("drumbeat.lage.board.verworfen", { n: verworfen.length })}
            </summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {verworfen.map((f) => (
                <FeatureCard key={f.id} feature={f} canDrag={false} canScore={false} />
              ))}
            </div>
          </details>
        )}

        <StatusReasonDialog
          targetStatus={prompt?.to ?? null}
          onCancel={() => setPrompt(null)}
          onConfirm={(grund) => {
            if (prompt) commit(prompt.id, prompt.to, grund);
            setPrompt(null);
          }}
        />
      </Card>
    </BoardDndProvider>
  );
}

/** Eine Statusspalte als Ablage. */
function StatusColumn({
  status,
  label,
  summary,
  children,
}: {
  status: FeatureStatus;
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDropCell(status);
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`flex min-h-24 flex-col gap-2 rounded-md p-2 ${FEATURE_STATUS_LANE[status]} ${
        isOver ? "ring-2 ring-primary/60" : ""
      }`}
    >
      <div className="flex items-baseline justify-between px-0.5 pb-1">
        <span className="text-label font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="text-label tabular-nums text-muted-foreground">{summary}</span>
      </div>
      {children}
    </section>
  );
}

function StatusMenu({
  feature,
  onMove,
}: {
  feature: CockpitFeature;
  onMove: (id: string, to: FeatureStatus) => void;
}) {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("drumbeat.lage.board.statusSetzenFuer", { titel: feature.title })}
        className="absolute right-1 top-1 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <MoreVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {[...COLUMNS, "cancelled" as const].map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === feature.status}
            onClick={() => onMove(feature.id, s)}
          >
            {t(FEATURE_STATUS_KEYS[s])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
