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
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";
import { RISK_LEVELS } from "@/modules/risks/domain/risk-matrix";
import { RISK_CATEGORIES } from "@/modules/risks/domain/risk-category";
import { ROAM_STATUSES, ROAM_LABELS } from "@/modules/core/kernel/domain/roam";
import {
  updateIssueAction,
  assignIssueOwnerAction,
  setIssueRoamAction,
  addIssueMitigationAction,
  removeIssueMitigationAction,
  reassessIssueAction,
  deleteIssueAction,
  linkIssueToInitiativeAction,
} from "@/modules/risks/features/issue/actions/issue";
import {
  LEVEL_LABELS,
  CATEGORY_LABELS,
  REVIEW_LABELS,
} from "@/modules/risks/features/risk/components/labels";

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface IssueCaps {
  canDocument: boolean;
  canUpdate: boolean;
  canRoam: boolean;
  canLink: boolean;
  canDelete: boolean;
  canReview: boolean;
  canManageSettings: boolean;
}

interface Props {
  issues: IssueListRow[];
  userLabels: Record<string, string>;
  caps: IssueCaps;
  /** Features of the epic (Epic tab) — for the work-item link picker. */
  featureOptions?: { id: string; title: string }[];
}

const initial: ActionState = {};

/** URL-driven (`?issue=<id>`) detail + management panel. */
export function IssueDetailDrawer({ issues, userLabels, caps, featureOptions }: Props) {
  const { params, push } = useUrlState();
  const id = params.get("issue");
  const issue = id ? (issues.find((r) => r.id === id) ?? null) : null;
  const open = issue != null;
  const close = () => push({ issue: null });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {issue && (
          <>
            <SheetHeader className="flex-row items-start justify-between gap-3 pr-12">
              <div>
                <p className="text-xs text-muted-foreground">
                  {issue.displayNumber ?? REVIEW_LABELS[issue.reviewStatus] ?? "Vorschlag"}
                </p>
                <SheetTitle>{issue.title}</SheetTitle>
              </div>
              {caps.canDelete && <DeleteButton id={issue.id} onDone={close} />}
            </SheetHeader>

            <div className="space-y-6 p-4">
              {caps.canUpdate && <EditSection issue={issue} />}
              {caps.canUpdate && <OwnerSection issue={issue} userLabels={userLabels} />}
              {caps.canRoam && <RoamSection issue={issue} />}
              {caps.canUpdate && <ReassessSection issue={issue} />}
              {caps.canUpdate && <MitigationSection issue={issue} />}
              {caps.canLink && (
                <LinkSection issue={issue} {...(featureOptions ? { featureOptions } : {})} />
              )}
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(deleteIssueAction, initial);
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

function EditSection({ issue }: { issue: IssueListRow }) {
  const [state, action, pending] = useActionState(updateIssueAction, initial);
  return (
    <Section title="Details">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={issue.id} />
        <div className="space-y-1.5">
          <Label>Titel</Label>
          <Input name="title" defaultValue={issue.title} maxLength={300} />
        </div>
        <div className="space-y-1.5">
          <Label>Beschreibung</Label>
          <Textarea name="description" rows={2} defaultValue={issue.description ?? ""} maxLength={5000} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Wahrscheinlichkeit</Label>
            <select name="probability" defaultValue={issue.probability ?? ""} className={SELECT}>
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
            <select name="impact" defaultValue={issue.impact ?? ""} className={SELECT}>
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
            <select name="category" defaultValue={issue.category ?? ""} className={SELECT}>
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
            <Input type="date" name="targetResolutionDate" defaultValue={issue.targetResolutionDate?.slice(0, 10) ?? ""} />
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

function OwnerSection({ issue, userLabels }: { issue: IssueListRow; userLabels: Record<string, string> }) {
  const [state, action, pending] = useActionState(assignIssueOwnerAction, initial);
  return (
    <Section title="Owner">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={issue.id} />
        <select name="ownerId" defaultValue={issue.ownerId ?? ""} className={SELECT}>
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

function RoamSection({ issue }: { issue: IssueListRow }) {
  const [state, action, pending] = useActionState(setIssueRoamAction, initial);
  return (
    <Section title="ROAM">
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={issue.id} />
        <select name="roamStatus" defaultValue={issue.roamStatus} className={SELECT}>
          {ROAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROAM_LABELS[s]}
            </option>
          ))}
        </select>
        <Textarea
          name="roamRationale"
          rows={2}
          defaultValue={issue.roamRationale ?? ""}
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

function ReassessSection({ issue }: { issue: IssueListRow }) {
  const [state, action, pending] = useActionState(reassessIssueAction, initial);
  return (
    <Section title="Neubewertung (Residual)">
      <p className="text-xs text-muted-foreground">
        {issue.assessments.length > 0
          ? `${issue.assessments.length} Bewertung(en) im Verlauf.`
          : "Noch keine Neubewertung."}
      </p>
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={issue.id} />
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

function MitigationSection({ issue }: { issue: IssueListRow }) {
  const [addState, add, adding] = useActionState(addIssueMitigationAction, initial);
  const [, remove] = useActionState(removeIssueMitigationAction, initial);
  return (
    <Section title="Maßnahmen">
      <ul className="space-y-1">
        {issue.mitigations.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-2 rounded border px-2 py-1 text-sm">
            <span>{m.description}</span>
            <form action={remove}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            </form>
          </li>
        ))}
        {issue.mitigations.length === 0 && <li className="text-xs text-muted-foreground">Keine Maßnahmen.</li>}
      </ul>
      <form action={add} className="flex items-center gap-2">
        <input type="hidden" name="issueId" value={issue.id} />
        <Input name="description" placeholder="Maßnahme hinzufügen…" maxLength={5000} required />
        <Button type="submit" size="sm" variant="outline" disabled={adding}>
          <Plus className="size-4" />
        </Button>
      </form>
      {addState.error && <p className="text-xs text-destructive">{addState.error}</p>}
    </Section>
  );
}

function LinkSection({
  issue,
  featureOptions,
}: {
  issue: IssueListRow;
  featureOptions?: { id: string; title: string }[];
}) {
  const [, link] = useActionState(linkIssueToInitiativeAction, initial);
  const [epicId, setEpicId] = useState("");
  return (
    <Section title="Verknüpftes Arbeitselement">
      {issue.initiative ? (
        <div className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm">
          <span>
            {issue.initiative.title}
            <span className="ml-1 text-xs text-muted-foreground">
              {issue.initiative.level === 0 ? "(Epic)" : "(Feature)"}
            </span>
          </span>
          <form action={link}>
            <input type="hidden" name="id" value={issue.id} />
            <input type="hidden" name="initiativeId" value="" />
            <button type="submit" className="text-muted-foreground hover:text-destructive">
              <X className="size-3.5" />
            </button>
          </form>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nicht verknüpft.</p>
      )}

      {featureOptions && featureOptions.length > 0 && (
        <form action={link} className="flex items-center gap-2">
          <input type="hidden" name="id" value={issue.id} />
          <select name="initiativeId" defaultValue="" className={SELECT}>
            <option value="" disabled>
              Feature wählen…
            </option>
            {featureOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Feature
          </Button>
        </form>
      )}

      <form action={link} className="flex items-center gap-2">
        <input type="hidden" name="id" value={issue.id} />
        <input type="hidden" name="initiativeId" value={epicId} />
        <div className="flex-1">
          <EntitySelect kind="epic" name="epicPick" label="" value={epicId} onChange={setEpicId} labelField="title" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={!epicId}>
          Epic
        </Button>
      </form>
    </Section>
  );
}
