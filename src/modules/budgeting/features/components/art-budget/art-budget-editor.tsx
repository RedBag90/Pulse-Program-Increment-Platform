"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArtBudgetBreakdown,
  type ArtBudgetState,
} from "@/modules/budgeting/features/components/art-budget/art-budget-breakdown";
import { SaveBar } from "@/modules/budgeting/features/components/round/save-bar";
import type { ArtBudgetModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import {
  numOr0,
  encodeSaveArtBudgetPayload,
} from "@/modules/budgeting/features/lib/allocation-payload";
import { saveArtBudgetAction } from "@/modules/budgeting/features/actions/budgeting";

interface Props {
  model: ArtBudgetModel;
  canEdit: boolean;
}

function stateFromModel(m: ArtBudgetModel): ArtBudgetState {
  const out: ArtBudgetState = {};
  for (const r of m.rows) {
    const cells: Record<string, string> = {};
    for (const p of m.periods) {
      cells[p.key] = r.budgetByPeriod[p.key] ? String(r.budgetByPeriod[p.key]) : "";
    }
    out[r.artId] = cells;
  }
  return out;
}

function mapChanged(cur: Record<string, string> = {}, base: Record<string, string> = {}): boolean {
  const keys = new Set([...Object.keys(cur), ...Object.keys(base)]);
  for (const k of keys) if (numOr0(cur[k] ?? "") !== numOr0(base[k] ?? "")) return true;
  return false;
}

/**
 * Standalone-ART-Editor für die Wertstrom-Detailseite: dieselbe kontrollierte
 * `ArtBudgetBreakdown` wie in der Budget-Runde, aber mit eigener Save-Bar für den
 * einen Wertstrom. (Der Editor ist von der Runde aus verlinkt — eine Datenquelle,
 * zwei Einstiege.)
 */
export function ArtBudgetEditor({ model, canEdit }: Props) {
  const router = useRouter();
  const [budgets, setBudgets] = useState<ArtBudgetState>(() => stateFromModel(model));
  const base = useRef(budgets);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyArtIds = Object.keys(budgets).filter((artId) =>
    mapChanged(budgets[artId], base.current[artId]),
  );

  async function save() {
    setPending(true);
    setError(null);
    try {
      for (const artId of dirtyArtIds) {
        const byPeriod: Record<string, number> = {};
        for (const [k, v] of Object.entries(budgets[artId] ?? {})) {
          const n = numOr0(v);
          if (n > 0) byPeriod[k] = n;
        }
        const res = await saveArtBudgetAction({}, encodeSaveArtBudgetPayload({ artId, byPeriod }));
        if (res.error) throw new Error(res.error);
      }
      base.current = budgets;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ArtBudgetBreakdown
        model={model}
        budgets={budgets}
        canEdit={canEdit}
        onChange={(artId, key, value) =>
          setBudgets((prev) => ({
            ...prev,
            [artId]: { ...prev[artId], [key]: value },
          }))
        }
      />
      <SaveBar
        count={dirtyArtIds.length}
        detail={`${dirtyArtIds.length} ART${dirtyArtIds.length > 1 ? "s" : ""}`}
        pending={pending}
        error={error}
        onSave={save}
        onDiscard={() => {
          setBudgets(base.current);
          setError(null);
        }}
      />
    </>
  );
}
