"use client";

import { useActionState, startTransition } from "react";
import { updateEpicAction } from "@/modules/work/features/portfolio/actions/epic";
import {
  EPIC_TYPES,
  EPIC_TYPE_LABEL,
  HORIZONS,
  HORIZON_LABEL,
} from "@/modules/work/domain/portfolio-guardrails";
import { epicHorizon, horizonEditDeniedReason } from "@/modules/work/domain/epic-horizon";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";

interface Props {
  epicId: string;
  epicType: string | null;
  /** Der am Epic gesetzte Horizont. `null` = aus der Primär-Solution ableiten. */
  ownHorizon: string | null;
  /** Der Horizont der Primär-Solution — die Ableitung, falls es eine gibt. */
  solutionHorizon: string | null;
  /** Der L3.1-Stempel als ISO-Tag; er entscheidet über das Einfrieren. */
  businessCaseApprovedAtIso: string | null;
  canEdit: boolean;
  /** `epic.portfolio_override` — nötig, sobald der Horizont eingefroren ist. */
  canOverrideHorizon: boolean;
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

/**
 * SAFe-Guardrails-Klassifikation: **Epic-Typ** und **Investitionshorizont**,
 * beide mit Auto-Submit.
 *
 * Der Horizont war bis September 2026 read-only und kam bei jedem Lesen aus der
 * Primär-Solution. Jetzt kann er am Epic stehen — nötig für Epics ohne Solution
 * (das Feld ist beim Anlegen optional) — und friert mit der
 * Business-Case-Freigabe ein, damit ein späterer Solution-Wechsel die
 * Geschichte nicht rückwirkend umschreibt.
 *
 * Die drei Zustände stehen im Untertext, damit niemand raten muss, woher der
 * angezeigte Wert kommt: *aus Primär-Solution* · *am Epic gesetzt* ·
 * *eingefroren mit der Business-Case-Freigabe am …*
 */
export function EpicClassificationForm({
  epicId,
  epicType,
  ownHorizon,
  solutionHorizon,
  businessCaseApprovedAtIso,
  canEdit,
  canOverrideHorizon,
}: Props) {
  const [state, submit, busy] = useActionState(updateEpicAction, {});

  const resolved = epicHorizon({
    investmentHorizon: ownHorizon,
    solutionHorizon,
    businessCaseApprovedAt: businessCaseApprovedAtIso ? new Date(businessCaseApprovedAtIso) : null,
  });
  const denied = horizonEditDeniedReason({
    frozen: resolved.frozen,
    mayEditEpic: canEdit,
    mayOverride: canOverrideHorizon,
  });

  function update(field: "epicType" | "investmentHorizon", value: string) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set(field, value);
    startTransition(() => submit(fd));
  }

  // Woher der Wert kommt — in Nutzersprache, nicht als Feldname.
  const origin =
    resolved.frozen && businessCaseApprovedAtIso
      ? `eingefroren mit der Business-Case-Freigabe am ${dateLabel(businessCaseApprovedAtIso)}`
      : resolved.source === "epic"
        ? "am Epic gesetzt"
        : resolved.source === "solution"
          ? "aus Primär-Solution"
          : "kein Horizont — weder am Epic gesetzt noch aus einer Solution ableitbar";

  return (
    <div className="space-y-2">
      {/* Untereinander, nicht nebeneinander: die Karte steht in der schmalen
          Akten-Spalte, und zwei Selects daneben ergeben zwei enge Streifen.
          Bisher stand hier `grid-cols-2` ganz ohne Breakpoint — auf dem Handy
          war es derselbe Fehler, nur früher. */}
      <div className="grid gap-3">
        <div>
          <label
            htmlFor="epic-type-select"
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Epic-Typ
          </label>
          {canEdit ? (
            <select
              id="epic-type-select"
              value={epicType ?? ""}
              disabled={busy}
              onChange={(e) => update("epicType", e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">— ungesetzt</option>
              {EPIC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EPIC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {epicType
                ? (EPIC_TYPE_LABEL[epicType as keyof typeof EPIC_TYPE_LABEL] ?? epicType)
                : "—"}
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="epic-horizon-select"
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Horizont
          </label>
          {denied === null ? (
            <select
              id="epic-horizon-select"
              value={ownHorizon ?? ""}
              disabled={busy}
              onChange={(e) => update("investmentHorizon", e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {/* Leerer Wert = wieder ableiten. Ohne Solution heisst das „ohne". */}
              <option value="">
                {solutionHorizon
                  ? `— aus Primär-Solution (${HORIZON_LABEL[solutionHorizon as keyof typeof HORIZON_LABEL] ?? solutionHorizon})`
                  : "— ohne Horizont"}
              </option>
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {HORIZON_LABEL[h]}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <HorizonBadge horizon={resolved.horizon} withHelp />
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{origin}</p>
          {denied !== null && canEdit && (
            <p className="mt-1 text-xs text-muted-foreground">{denied}</p>
          )}
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
