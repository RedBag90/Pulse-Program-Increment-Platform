"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntitySelect } from "@/features/create/entity-select";
import type { ActionState } from "@/server/http/server-action";
import type { RiskListRow } from "@/modules/risks/server/views/risks-list";
import { RISK_LEVELS } from "@/modules/risks/domain/risk-matrix";
import { RISK_CATEGORIES } from "@/modules/risks/domain/risk-category";
import { ROAM_STATUSES, ROAM_LABELS } from "@/modules/core/kernel/domain/roam";
import {
  updateRiskAction,
  assignRiskOwnerAction,
  setRiskRoamAction,
  addRiskMitigationAction,
  removeRiskMitigationAction,
  reassessRiskAction,
  deleteRiskAction,
  linkRiskToEpicAction,
  unlinkRiskFromEpicAction,
} from "@/modules/risks/features/risk/actions/risk";
import {
  LEVEL_LABELS,
  CATEGORY_LABELS,
  REVIEW_LABELS,
} from "@/modules/risks/features/risk/components/labels";

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface RiskCaps {
  canDocument: boolean;
  canUpdate: boolean;
  canRoam: boolean;
  canLink: boolean;
  canDelete: boolean;
  canReview: boolean;
  canManageSettings: boolean;
}

interface Props {
  risks: RiskListRow[];
  userLabels: Record<string, string>;
  caps: RiskCaps;
}

const initial: ActionState = {};

/** URL-driven (`?risk=<id>`) detail + management panel. */
export function RiskDetailDrawer({ risks, userLabels, caps }: Props) {
  const { params, push } = useUrlState();
  const id = params.get("risk");
  const risk = id ? (risks.find((r) => r.id === id) ?? null) : null;
  const open = risk != null;
  const close = () => push({ risk: null });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {risk && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {risk.displayNumber ?? REVIEW_LABELS[risk.reviewStatus] ?? "Vorschlag"}
                </p>
                <SheetTitle>{risk.title}</SheetTitle>
              </div>
              {caps.canDelete && <DeleteButton id={risk.id} onDone={close} />}
            </SheetHeader>

            <div className="space-y-6 p-4">
              {caps.canUpdate && <EditSection risk={risk} />}
              {caps.canUpdate && <OwnerSection risk={risk} userLabels={userLabels} />}
              {caps.canRoam && <RoamSection risk={risk} />}
              {caps.canUpdate && <ReassessSection risk={risk} />}
              {caps.canUpdate && <MitigationSection risk={risk} />}
              {caps.canLink && <EpicLinkSection risk={risk} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(deleteRiskAction, initial);
  const [confirm, setConfirm] = useState(false);
  if (state.success) onDone();
  return confirm ? (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        Wirklich löschen
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        <X className="size-4" />
      </Button>
    </form>
  ) : (
    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(true)}>
      <Trash2 className="size-4" />
    </Button>
  );
}

function EditSection({ risk }: { risk: RiskListRow }) {
  const [state, action, pending] = useActionState(updateRiskAction, initial);
  return (
    <Section title="Details">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={risk.id} />
        <div className="space-y-1.5">
          <Label>Titel</Label>
          <Input name="title" defaultValue={risk.title} maxLength={300} />
        </div>
        <div className="space-y-1.5">
          <Label>Beschreibung</Label>
          <Textarea
            name="description"
            rows={2}
            defaultValue={risk.description ?? ""}
            maxLength={5000}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Wahrscheinlichkeit</Label>
            <select name="probability" defaultValue={risk.probability ?? ""} className={SELECT}>
              <option value="">—</option>
              {RISK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Auswirkung</Label>
            <select name="impact" defaultValue={risk.impact ?? ""} className={SELECT}>
              <option value="">—</option>
              {RISK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <select name="category" defaultValue={risk.category ?? ""} className={SELECT}>
              <option value="">—</option>
              {RISK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Zieltermin</Label>
            <Input
              type="date"
              name="targetResolutionDate"
              defaultValue={risk.targetResolutionDate?.slice(0, 10) ?? ""}
            />
          </div>
        </div>
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          Speichern
        </Button>
      </form>
    </Section>
  );
}

function OwnerSection({
  risk,
  userLabels,
}: {
  risk: RiskListRow;
  userLabels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(assignRiskOwnerAction, initial);
  return (
    <Section title="Owner">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={risk.id} />
        <select name="ownerId" defaultValue={risk.ownerId ?? ""} className={SELECT}>
          <option value="">— kein Owner —</option>
          {Object.entries(userLabels).map(([uid, label]) => (
            <option key={uid} value={uid}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Setzen
        </Button>
      </form>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </Section>
  );
}

function RoamSection({ risk }: { risk: RiskListRow }) {
  const [state, action, pending] = useActionState(setRiskRoamAction, initial);
  return (
    <Section title="ROAM">
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={risk.id} />
        <select name="roamStatus" defaultValue={risk.roamStatus} className={SELECT}>
          {ROAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROAM_LABELS[s]}
            </option>
          ))}
        </select>
        <Textarea
          name="roamRationale"
          rows={2}
          defaultValue={risk.roamRationale ?? ""}
          placeholder="Begründung / Maßnahmenplan"
          maxLength={5000}
        />
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          ROAM setzen
        </Button>
      </form>
    </Section>
  );
}

function ReassessSection({ risk }: { risk: RiskListRow }) {
  const [state, action, pending] = useActionState(reassessRiskAction, initial);
  return (
    <Section title="Neubewertung (Residual)">
      <p className="text-xs text-muted-foreground">
        {risk.assessments.length > 0
          ? `${risk.assessments.length} Bewertung(en) im Verlauf.`
          : "Noch keine Neubewertung."}
      </p>
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={risk.id} />
        <div className="grid grid-cols-2 gap-2">
          <select name="probability" defaultValue="" required className={SELECT}>
            <option value="" disabled>
              Wahrscheinlichkeit
            </option>
            {RISK_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
          <select name="impact" defaultValue="" required className={SELECT}>
            <option value="" disabled>
              Auswirkung
            </option>
            {RISK_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <Input name="note" placeholder="Notiz (optional)" maxLength={5000} />
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Neu bewerten
        </Button>
      </form>
    </Section>
  );
}

function MitigationSection({ risk }: { risk: RiskListRow }) {
  const [addState, add, adding] = useActionState(addRiskMitigationAction, initial);
  const [, remove] = useActionState(removeRiskMitigationAction, initial);
  return (
    <Section title="Maßnahmen">
      <ul className="space-y-1">
        {risk.mitigations.map((m) => (
          <li
            key={m.id}
            className="flex items-start justify-between gap-2 rounded border px-2 py-1 text-sm"
          >
            <span>{m.description}</span>
            <form action={remove}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </form>
          </li>
        ))}
        {risk.mitigations.length === 0 && (
          <li className="text-xs text-muted-foreground">Keine Maßnahmen.</li>
        )}
      </ul>
      <form action={add} className="flex items-center gap-2">
        <input type="hidden" name="riskId" value={risk.id} />
        <Input name="description" placeholder="Maßnahme hinzufügen…" maxLength={5000} required />
        <Button type="submit" size="sm" variant="outline" disabled={adding}>
          <Plus className="size-4" />
        </Button>
      </form>
      {addState.error && <p className="text-xs text-destructive">{addState.error}</p>}
    </Section>
  );
}

function EpicLinkSection({ risk }: { risk: RiskListRow }) {
  const [, link] = useActionState(linkRiskToEpicAction, initial);
  const [, unlink] = useActionState(unlinkRiskFromEpicAction, initial);
  const [epicId, setEpicId] = useState("");
  return (
    <Section title="Verknüpfte Epics">
      <ul className="space-y-1">
        {risk.epics.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
          >
            <span>{e.title}</span>
            <form action={unlink}>
              <input type="hidden" name="riskId" value={risk.id} />
              <input type="hidden" name="epicId" value={e.id} />
              <button type="submit" className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </form>
          </li>
        ))}
        {risk.epics.length === 0 && <li className="text-xs text-muted-foreground">Keine Epics.</li>}
      </ul>
      <form action={link} className="flex items-center gap-2">
        <input type="hidden" name="riskId" value={risk.id} />
        <input type="hidden" name="epicId" value={epicId} />
        <div className="flex-1">
          <EntitySelect
            kind="epic"
            name="epicPick"
            label=""
            value={epicId}
            onChange={setEpicId}
            labelField="title"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={!epicId}>
          <Plus className="size-4" />
        </Button>
      </form>
    </Section>
  );
}
