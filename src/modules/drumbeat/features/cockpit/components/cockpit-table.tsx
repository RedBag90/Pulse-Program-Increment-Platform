"use client";

import { useMemo, useState, useTransition } from "react";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import {
  setFeaturePiAction,
  setFeatureDeliveryStatusAction,
  bulkSetFeatureDeliveryStatusAction,
} from "@/modules/work/features/feature/actions/feature";
import {
  setFeaturePi,
  setFeatureDeliveryStatus,
  bulkSetFeatureDeliveryStatus,
} from "@/modules/work/features/feature/lib/feature-actions-client";
import type {
  CockpitFeature,
  CockpitPiSlot,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { normalizePiKey, BACKLOG_COLUMN_ID } from "@/modules/drumbeat/domain/board-matrix";
import { FEATURE_STATUS_LABELS } from "@/modules/drumbeat/domain/status";
import { StatusBadge, WsjfBadge } from "@/modules/drumbeat/features/lib/status-badges";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { CockpitBulkBar } from "./cockpit-bulk-bar";

/**
 * Tabelle-Sicht des Delivery-Cockpits. Inline-Dropdowns auf jeder Zeile
 * fuer PI und Status; Bulk-Auswahl steuert die Sticky-Bar (P3.2).
 *
 * Filter- + Scope-Quelle ist identisch zur Board-Sicht (URL-State),
 * deshalb braucht die Komponente keinen eigenen Filter-Header — der sitzt
 * in der Top-Bar.
 */
interface Props {
  pis: CockpitPiSlot[];
  features: CockpitFeature[];
  artId: string;
  canUpdate: boolean;
  canSetDelivery: boolean;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: FeatureStatus; label: string }> = [
  { value: "approved", label: FEATURE_STATUS_LABELS.approved },
  { value: "in_progress", label: FEATURE_STATUS_LABELS.in_progress },
  { value: "blocked", label: FEATURE_STATUS_LABELS.blocked },
  { value: "completed", label: FEATURE_STATUS_LABELS.completed },
  { value: "cancelled", label: FEATURE_STATUS_LABELS.cancelled },
];

export function CockpitTable({ pis, features, artId, canUpdate, canSetDelivery }: Props) {
  const { setParam } = useUrlState();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openSlideOver(id: string) {
    setParam("featureId", id);
  }

  const piOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: BACKLOG_COLUMN_ID, label: "— Backlog —" },
      ...pis.map((p) => ({ value: p.id, label: p.name })),
    ],
    [pis],
  );

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(check: boolean) {
    setSelected(check ? new Set(features.map((f) => f.id)) : new Set());
  }

  function setPi(id: string, piId: string) {
    startTransition(async () => {
      const res = await setFeaturePi(setFeaturePiAction, {
        featureIds: [id],
        piId,
        artId,
      });
      setError(res.error ?? null);
    });
  }

  function setStatus(id: string, status: FeatureStatus) {
    startTransition(async () => {
      const res = await setFeatureDeliveryStatus(setFeatureDeliveryStatusAction, {
        id,
        to: status,
      });
      setError(res.error ?? null);
    });
  }

  function applyBulk(patch: { piId?: string; status?: FeatureStatus }) {
    if (selected.size === 0) return;
    const ids = [...selected];
    startTransition(async () => {
      try {
        if (patch.piId !== undefined) {
          const res = await setFeaturePi(setFeaturePiAction, {
            featureIds: ids,
            piId: patch.piId,
            artId,
          });
          if (res.error) throw new Error(res.error);
        }
        if (patch.status !== undefined) {
          const res = await bulkSetFeatureDeliveryStatus(bulkSetFeatureDeliveryStatusAction, {
            featureIds: ids,
            to: patch.status,
          });
          if (res.error) throw new Error(res.error);
        }
        setError(null);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk-Aktion fehlgeschlagen");
      }
    });
  }

  const allChecked = features.length > 0 && selected.size === features.length;
  const noneChecked = selected.size === 0;
  const someChecked = !allChecked && !noneChecked;

  return (
    <div className="space-y-2 pb-24">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border" data-tour="cockpit-table">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  aria-label="Alle waehlen"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="px-2 py-2 text-left">Titel</th>
              <th className="px-2 py-2 text-left">ART</th>
              <th className="px-2 py-2 text-left">PI</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-right">WSJF</th>
              <th className="px-2 py-2 text-left">Blocker</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => {
              const checked = selected.has(f.id);
              return (
                <tr
                  key={f.id}
                  className={`border-t ${checked ? "bg-primary/5" : "hover:bg-muted/20"}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`${f.title} waehlen`}
                      checked={checked}
                      onChange={() => toggleRow(f.id)}
                    />
                  </td>
                  <td className="max-w-[320px] truncate px-2 py-1.5 font-medium">
                    <button
                      type="button"
                      className="text-left hover:text-primary hover:underline"
                      onClick={() => openSlideOver(f.id)}
                    >
                      {f.title}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{f.artName}</td>
                  <td className="px-2 py-1.5">
                    {canUpdate ? (
                      <SearchSelect
                        value={normalizePiKey(f.piId)}
                        onChange={(v) => setPi(f.id, v)}
                        options={piOptions}
                        placeholder="PI wählen"
                        ariaLabel={`PI für ${f.title}`}
                        className="min-w-36"
                      />
                    ) : (
                      <span className="text-xs">
                        {piOptions.find((o) => o.value === normalizePiKey(f.piId))?.label ??
                          "— Backlog —"}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {canSetDelivery ? (
                      <SearchSelect
                        value={f.status}
                        onChange={(v) => setStatus(f.id, v as FeatureStatus)}
                        options={STATUS_OPTIONS}
                        placeholder="Status wählen"
                        ariaLabel={`Status für ${f.title}`}
                        className="min-w-36"
                      />
                    ) : (
                      <StatusBadge status={f.status} />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <WsjfBadge value={f.wsjfComputed} className="px-1.5 py-0" />
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    {f.hasBlocker && f.blockerHint ? (
                      <span className="text-amber-700">⚠ {f.blockerHint}</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {features.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Keine Features im aktuellen Scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CockpitBulkBar
        selectedCount={selected.size}
        pis={pis}
        statusOptions={STATUS_OPTIONS}
        canUpdate={canUpdate}
        canSetDelivery={canSetDelivery}
        onApply={applyBulk}
        onClear={() => setSelected(new Set())}
      />
    </div>
  );
}
