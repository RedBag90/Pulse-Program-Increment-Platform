"use client";

import { useActionState, useState } from "react";
import { Link } from "@/i18n/navigation";
import { updateFeatureAction } from "@/features/art/actions/feature";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import { DeleteFeatureButton } from "@/features/art/components/delete-feature-button";
import { FeaturePiSelect } from "@/features/art/components/feature-pi-select";
import { SubmitReviewButton } from "@/features/quality/components/submit-review-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Pi {
  id: string;
  name: string;
}

export interface BreakdownFeature {
  id: string;
  title: string;
  status: string;
  description: string;
  artId: string;
  artName: string;
  piId: string | null;
  acceptanceCriteria: string[];
  wsjf: { bv: number; tc: number; rr: number; js: number; computed: number };
}

interface Props {
  epicId: string;
  epicTitle: string;
  canEdit: boolean;
  features: BreakdownFeature[];
  /** PI options keyed by ART — a child Feature's PI picker only lists its ART's PIs. */
  pisByArt: Record<string, Pi[]>;
}

function FeatureRow({
  feature,
  canEdit,
  pis,
}: {
  feature: BreakdownFeature;
  canEdit: boolean;
  pis: Pi[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, isPending] = useActionState(updateFeatureAction, {});

  const wsjfFields = [
    { name: "wsjfBusinessValue", label: "Business Value", value: feature.wsjf.bv },
    { name: "wsjfTimeCriticality", label: "Time Criticality", value: feature.wsjf.tc },
    { name: "wsjfRiskReduction", label: "Risk Reduction", value: feature.wsjf.rr },
    { name: "wsjfJobSize", label: "Job Size", value: feature.wsjf.js },
  ];

  return (
    <div className="rounded border">
      <div className="flex items-center gap-3 p-3">
        <Link
          href={`/feature/${feature.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
        >
          {feature.title}
        </Link>
        <span className="shrink-0 text-xs text-muted-foreground">{feature.artName}</span>
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs">{feature.status}</span>
        <span className="shrink-0 text-xs text-muted-foreground">WSJF {feature.wsjf.computed}</span>
        {canEdit && (
          <>
            <FeaturePiSelect
              featureId={feature.id}
              artId={feature.artId}
              currentPiId={feature.piId}
              pis={pis}
            />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              {expanded ? "Schließen" : "Bearbeiten"}
            </button>
            {feature.status === "draft" && <SubmitReviewButton id={feature.id} kind="feature" />}
            <DeleteFeatureButton id={feature.id} artId={feature.artId} title={feature.title} />
          </>
        )}
      </div>

      {canEdit && expanded && (
        <form action={action} className="space-y-4 border-t p-4">
          <input type="hidden" name="id" value={feature.id} />
          <input type="hidden" name="artId" value={feature.artId} />

          <div className="space-y-1.5">
            <Label htmlFor={`title-${feature.id}`}>Titel</Label>
            <Input id={`title-${feature.id}`} name="title" defaultValue={feature.title} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`desc-${feature.id}`}>Beschreibung</Label>
            <Textarea
              id={`desc-${feature.id}`}
              name="description"
              defaultValue={feature.description}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`ac-${feature.id}`}>Akzeptanzkriterien</Label>
            <Textarea
              id={`ac-${feature.id}`}
              name="acceptanceCriteria"
              defaultValue={feature.acceptanceCriteria.join("\n")}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">Ein Kriterium pro Zeile</p>
          </div>

          <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {wsjfFields.map((f) => (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`${f.name}-${feature.id}`}>{f.label}</Label>
                <select
                  id={`${f.name}-${feature.id}`}
                  name={f.name}
                  defaultValue={f.value}
                  className={SELECT_CLASS}
                >
                  {FIBONACCI.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="text-sm text-emerald-600">
              Gespeichert.
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Speichert…" : "Änderungen speichern"}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * Breakdown tab — manages the Features attached to an Epic in place: create,
 * inline-edit content + WSJF, assign a PI, and remove, without leaving the page.
 */
export function EpicBreakdownTab({ epicId, epicTitle, canEdit, features, pisByArt }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Breakdown</h2>
        {canEdit && (
          <CreateFeatureDialog epics={[{ id: epicId, title: epicTitle }]} context={{ epicId }} />
        )}
      </div>

      {features.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Features in diesem Epic.</p>
      ) : (
        <div className="space-y-2">
          {features.map((f) => (
            <FeatureRow key={f.id} feature={f} canEdit={canEdit} pis={pisByArt[f.artId] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
