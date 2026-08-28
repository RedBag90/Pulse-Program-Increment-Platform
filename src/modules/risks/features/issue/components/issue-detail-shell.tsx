"use client";

import { useActionState, useState } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/ui/search-select";
import { UserPicker } from "@/components/detail/user-picker";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import type { ActionState } from "@/server/http/server-action";
import type { IssueListRow } from "@/modules/risks/server/views/issues-list";
import { RISK_LEVELS } from "@/modules/risks/domain/risk-matrix";
import { RISK_CATEGORIES, type RiskCategory } from "@/modules/risks/domain/risk-category";
import { ROAM_STATUSES, ROAM_LABELS, type RoamStatus } from "@/modules/core/kernel/domain/roam";
import { ExposureBadge, RoamBadge } from "@/modules/risks/features/lib/issue-badges";
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
import { LEVEL_LABELS, CATEGORY_LABELS } from "@/modules/risks/features/risk/components/labels";

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const initial: ActionState = {};

export interface IssueCaps {
  canDocument: boolean;
  canUpdate: boolean;
  canRoam: boolean;
  canLink: boolean;
  canDelete: boolean;
  canReview: boolean;
  canManageSettings: boolean;
}

const TABS: readonly DetailTab[] = [
  { key: "details", label: "Details" },
  { key: "assessment", label: "Bewertung" },
  { key: "mitigations", label: "Maßnahmen" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  issue: IssueListRow;
  userLabels: Record<string, string>;
  caps: IssueCaps;
  featureOptions?: { id: string; title: string }[];
  /** Aktiver Tab (URL bzw. Slide-Over-State). */
  activeTab?: string;
  /** Gesetzt = Tabs in-place (Slide-Over); undefined = URL-Routing (Voll-Route). */
  onTabChange?: (key: string) => void;
  onClose?: () => void;
  backHref?: string;
  backLabel?: string;
}

/**
 * Ein Issue-Detail auf dem geteilten `EntityDetailShell` — als Slide-Over (embed)
 * und als Voll-Route `/issues/[id]` identisch. ROAM-/Exposure-Badge + Kontext im
 * Header, deutsches Tab-Set Details · Bewertung · Maßnahmen · Verlauf.
 */
export function IssueDetailShell({
  issue,
  userLabels,
  caps,
  featureOptions,
  activeTab,
  onTabChange,
  onClose,
  backHref,
  backLabel,
}: Props) {
  const router = useRouter();
  const active = resolveTab(TABS, activeTab);
  const band = issue.band;
  // Nach dem Löschen: im Slide-Over schließen, auf der Voll-Route zurück ins Register.
  const handleDeleted = onClose ?? (() => router.push((backHref ?? "/issues") as never));

  const badge = (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RoamBadge status={issue.roamStatus as RoamStatus} />
      {band && <ExposureBadge band={band} />}
    </span>
  );

  const metaBits = [
    issue.category ? CATEGORY_LABELS[issue.category as RiskCategory] : null,
    issue.ownerLabel ? `Owner: ${issue.ownerLabel}` : "ohne Owner",
    issue.initiative?.title ?? null,
    issue.displayNumber ?? null,
  ].filter((x): x is string => Boolean(x));

  return (
    <EntityDetailShell
      title={issue.title}
      badge={badge}
      subHeader={<p className="text-sm text-muted-foreground">{metaBits.join(" · ")}</p>}
      tabs={TABS}
      activeTab={active}
      basePath={`/issues/${issue.id}`}
      {...(onTabChange ? { onTabChange } : {})}
      {...(backHref && backLabel ? { backHref, backLabel } : {})}
      {...(caps.canDelete
        ? { headerActions: <DeleteButton id={issue.id} onDone={handleDeleted} /> }
        : {})}
    >
      {active === "details" && (
        <div className="space-y-6">
          {caps.canUpdate && <EditSection issue={issue} />}
          {caps.canUpdate && <OwnerSection issue={issue} userLabels={userLabels} />}
          {caps.canLink && (
            <LinkSection issue={issue} {...(featureOptions ? { featureOptions } : {})} />
          )}
        </div>
      )}
      {active === "assessment" && (
        <div className="space-y-6">
          {caps.canRoam && <RoamSection issue={issue} />}
          {caps.canUpdate && <ReassessSection issue={issue} />}
        </div>
      )}
      {active === "mitigations" && (
        <div className="space-y-6">
          <MitigationSection issue={issue} canEdit={caps.canUpdate} />
        </div>
      )}
      {active === "history" && <HistoryTab issue={issue} />}
    </EntityDetailShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
      <Trash2 className="mr-1 size-4" />
      Löschen
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
          <Textarea
            name="description"
            rows={3}
            defaultValue={issue.description ?? ""}
            maxLength={5000}
          />
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
            <Input
              type="date"
              name="targetResolutionDate"
              defaultValue={issue.targetResolutionDate?.slice(0, 10) ?? ""}
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
  issue,
  userLabels,
}: {
  issue: IssueListRow;
  userLabels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(assignIssueOwnerAction, initial);
  return (
    <Section title="Owner">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={issue.id} />
        <div className="min-w-0 flex-1">
          <UserPicker
            name="ownerId"
            defaultValue={issue.ownerId ?? ""}
            options={Object.entries(userLabels).map(([uid, label]) => ({ value: uid, label }))}
            ariaLabel="Owner"
            placeholder="— kein Owner —"
            emptyLabel="— kein Owner —"
          />
        </div>
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
    <Section title="ROAM-Disposition">
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
    <Section title="Neubewertung">
      <p className="text-xs text-muted-foreground">
        {issue.assessments.length > 0
          ? `${issue.assessments.length} Bewertung(en) im Verlauf — jüngste zählt.`
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

function MitigationSection({ issue, canEdit }: { issue: IssueListRow; canEdit: boolean }) {
  const [addState, add, adding] = useActionState(addIssueMitigationAction, initial);
  const [, remove] = useActionState(removeIssueMitigationAction, initial);
  return (
    <Section title="Maßnahmen">
      <ul className="space-y-1">
        {issue.mitigations.map((m) => (
          <li
            key={m.id}
            className="flex items-start justify-between gap-2 rounded border px-2 py-1 text-sm"
          >
            <span>{m.description}</span>
            {canEdit && (
              <form action={remove}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="text-muted-foreground hover:text-destructive">
                  <X className="size-3.5" />
                </button>
              </form>
            )}
          </li>
        ))}
        {issue.mitigations.length === 0 && (
          <li className="text-xs text-muted-foreground">Keine Maßnahmen.</li>
        )}
      </ul>
      {canEdit && (
        <form action={add} className="flex items-center gap-2">
          <input type="hidden" name="issueId" value={issue.id} />
          <Input name="description" placeholder="Maßnahme hinzufügen…" maxLength={5000} required />
          <Button type="submit" size="sm" variant="outline" disabled={adding}>
            <Plus className="size-4" />
          </Button>
        </form>
      )}
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
  const epicResult = useEntityOptions<{ id: string; title?: string; name?: string }>(
    optionsEndpoint("epic"),
    true,
  );
  const epicOptions = epicResult.data.map((e) => ({
    value: e.id,
    label: e.title ?? e.name ?? e.id,
  }));
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
          <SearchSelect
            value={epicId}
            onChange={setEpicId}
            options={epicOptions}
            placeholder="Epic suchen …"
            searchPlaceholder="Epic suchen …"
            ariaLabel="Epic suchen"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={!epicId}>
          Epic
        </Button>
      </form>
    </Section>
  );
}

function HistoryTab({ issue }: { issue: IssueListRow }) {
  if (issue.assessments.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch kein Bewertungs-Verlauf.</p>;
  }
  return (
    <Section title="Bewertungs-Verlauf">
      <ul className="divide-y rounded-lg border">
        {issue.assessments.map((a, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span>
              {LEVEL_LABELS[a.probability as keyof typeof LEVEL_LABELS] ?? a.probability}
              <span className="mx-1.5 text-muted-foreground/60">×</span>
              {LEVEL_LABELS[a.impact as keyof typeof LEVEL_LABELS] ?? a.impact}
              {a.note && <span className="ml-2 text-muted-foreground">— {a.note}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(a.createdAt).toLocaleDateString("de-DE")}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
