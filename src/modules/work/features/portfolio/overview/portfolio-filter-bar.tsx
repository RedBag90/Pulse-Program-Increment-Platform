"use client";

import { useActionState, startTransition, useState } from "react";
import { Star, Save, Trash2 } from "lucide-react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { MultiSelectFilter, type MultiSelectSection } from "@/components/ui/multi-select-filter";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import { STAGE_GATES, STAGE_GATE_LABEL } from "@/modules/work/server/views/portfolio-overview";
import {
  savePortfolioFilterAction,
  deletePortfolioFilterAction,
} from "@/modules/work/features/portfolio/actions/saved-filter";
import type { SavedPortfolioFilterDTO } from "@/modules/work/server/services/saved-portfolio-filter";

/** Epic-Status, die als Filter angeboten werden (Lifecycle-relevante Teilmenge). */
const STATUS_OPTIONS = ["draft", "in_progress", "blocked", "completed", "cancelled"] as const;

interface Props {
  valueStreams: { id: string; name: string }[];
  owners: { id: string; label: string }[];
  savedFilters: SavedPortfolioFilterDTO[];
}

/**
 * Filterleiste der Portfolio-Übersicht: Wertstrom · Stage Gate · Status · Owner
 * (Mehrfachauswahl, CSV im URL-State). Rechts die gespeicherten Filter des
 * Nutzers (anwenden / speichern / löschen); einer kann als Standard markiert
 * werden und wird beim Öffnen automatisch angewandt (Server, page.tsx).
 */
export function PortfolioFilterBar({ valueStreams, owners, savedFilters }: Props) {
  const { params, push } = useUrlState();
  const [saveOpen, setSaveOpen] = useState(false);

  const readSet = (key: string): Set<string> =>
    new Set((params.get(key) ?? "").split(",").filter(Boolean));
  const writeSet = (key: string, set: Set<string>): void =>
    push({ [key]: set.size ? [...set].join(",") : null, f: null });

  const handlers = (key: string, set: Set<string>) => ({
    onToggle: (v: string) => {
      const next = new Set(set);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      writeSet(key, next);
    },
    onToggleSection: (values: string[], on: boolean) => {
      const next = new Set(set);
      for (const v of values) {
        if (on) next.add(v);
        else next.delete(v);
      }
      writeSet(key, next);
    },
    onClear: () => push({ [key]: null, f: null }),
  });

  const vsSel = readSet("vs");
  const gateSel = readSet("gate");
  const statusSel = readSet("status");
  const ownerSel = readSet("owner");
  const anyActive = vsSel.size + gateSel.size + statusSel.size + ownerSel.size > 0;

  const vsSections: MultiSelectSection[] = [
    { options: valueStreams.map((v) => ({ value: v.id, label: v.name })) },
  ];
  const gateSections: MultiSelectSection[] = [
    { options: STAGE_GATES.map((g) => ({ value: g, label: `${g} · ${STAGE_GATE_LABEL[g]}` })) },
  ];
  const statusSections: MultiSelectSection[] = [
    { options: STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })) },
  ];
  const ownerSections: MultiSelectSection[] = [
    { options: owners.map((o) => ({ value: o.id, label: o.label })) },
  ];

  const csv = (arr: string[]) => (arr.length ? arr.join(",") : null);
  function applySaved(f: SavedPortfolioFilterDTO) {
    push({
      vs: csv(f.criteria.vs),
      gate: csv(f.criteria.gate),
      status: csv(f.criteria.status),
      owner: csv(f.criteria.owner),
      f: null,
    });
  }

  // Save/Delete server actions (FormData style).
  const [, submitSave, savingBusy] = useActionState(savePortfolioFilterAction, {});
  const [, submitDelete] = useActionState(deletePortfolioFilterAction, {});

  function handleSave(formData: FormData) {
    const criteria = {
      vs: [...vsSel],
      gate: [...gateSel],
      status: [...statusSel],
      owner: [...ownerSel],
    };
    formData.set("criteria", JSON.stringify(criteria));
    startTransition(() => submitSave(formData));
    setSaveOpen(false);
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => submitDelete(fd));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2.5 shadow-xs">
      <MultiSelectFilter
        label="Wertstrom"
        sections={vsSections}
        selected={vsSel}
        {...handlers("vs", vsSel)}
      />
      <MultiSelectFilter
        label="Stage Gate"
        sections={gateSections}
        selected={gateSel}
        {...handlers("gate", gateSel)}
      />
      <MultiSelectFilter
        label="Status"
        sections={statusSections}
        selected={statusSel}
        {...handlers("status", statusSel)}
      />
      <MultiSelectFilter
        label="Owner"
        sections={ownerSections}
        selected={ownerSel}
        {...handlers("owner", ownerSel)}
      />

      {anyActive && (
        <button
          type="button"
          onClick={() => push({ vs: null, gate: null, status: null, owner: null, f: "0" })}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          Zurücksetzen
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {savedFilters.length > 0 && (
          <select
            aria-label="Gespeicherten Filter anwenden"
            defaultValue=""
            onChange={(e) => {
              const f = savedFilters.find((x) => x.id === e.target.value);
              if (f) applySaved(f);
              e.currentTarget.value = "";
            }}
            className="rounded-md border bg-background px-2 py-1.5 text-xs"
          >
            <option value="" disabled>
              Gespeicherte Filter…
            </option>
            {savedFilters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.isDefault ? "★ " : ""}
                {f.name}
              </option>
            ))}
          </select>
        )}

        {anyActive && !saveOpen && (
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Save className="size-3.5" /> Speichern
          </button>
        )}

        {saveOpen && (
          <form action={handleSave} className="flex items-center gap-1.5">
            <input
              name="name"
              required
              maxLength={80}
              placeholder="Filter-Name"
              autoFocus
              className="w-36 rounded-md border bg-background px-2 py-1.5 text-xs"
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" name="isDefault" value="true" /> Standard
            </label>
            <button
              type="submit"
              disabled={savingBusy}
              className="rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Abbrechen
            </button>
          </form>
        )}
      </div>

      {savedFilters.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {savedFilters.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
            >
              {f.isDefault && <Star className="size-3 fill-amber-400 text-amber-500" />}
              <button
                type="button"
                onClick={() => applySaved(f)}
                className="hover:text-primary hover:underline"
              >
                {f.name}
              </button>
              <button
                type="button"
                aria-label={`Filter „${f.name}" löschen`}
                onClick={() => handleDelete(f.id)}
                className="text-muted-foreground hover:text-rose-500"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
