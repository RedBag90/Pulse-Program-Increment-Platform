"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { EditValueStreamDialog } from "@/features/portfolio/components/edit-value-stream-dialog";
import { DeleteValueStreamButton } from "@/features/portfolio/components/delete-value-stream-button";
import type { VsDetail } from "@/server/views/structure-page";

interface Props {
  vs: VsDetail;
  canCreateArt: boolean;
  /** Bearbeiten + Löschen — beide gated über `value_stream.update`,
   *  da der Delete-Action im Backend ebenfalls auf der Update-Capability
   *  läuft (siehe `deleteValueStreamAction` in
   *  `src/features/portfolio/actions/value-stream.ts`). */
  canUpdateVs: boolean;
  onSelectArt: (id: string) => void;
}

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Right pane for a selected Value Stream. Three cards:
 *
 * - **Header** — name, VMO/Finance approver, ART/Team counts. Gaps show as
 *   amber chips so the user can see what's missing without expanding rows.
 * - **ARTs** — list of child ARTs as compact links that re-select into the
 *   same shell (no navigation). "+ ART hinzufügen" opens the existing
 *   `<CreateArtDialog>`.
 * - **Budget** — total allocated participatory budget (read-only; the full
 *   budget editor lives on `/controlling`).
 */
export function VsDetailPane({ vs, canCreateArt, canUpdateVs, onSelectArt }: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Wertstrom</p>
            <h2 className="font-heading text-lg font-medium">{vs.name}</h2>
          </div>
          {canUpdateVs && (
            <div className="flex items-center gap-1">
              <EditValueStreamDialog id={vs.id} name={vs.name} description={vs.description} />
              <DeleteValueStreamButton id={vs.id} name={vs.name} />
            </div>
          )}
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">VMO</dt>
          <dd>{vs.vmoLabel ?? <GapHint>Nicht zugewiesen</GapHint>}</dd>
          <dt className="text-muted-foreground">Finance-Approver</dt>
          <dd>{vs.financeApproverLabel ?? <GapHint>Nicht zugewiesen</GapHint>}</dd>
          <dt className="text-muted-foreground">ARTs / Teams</dt>
          <dd className="tabular-nums">
            {vs.artCount} / {vs.teamCount}
          </dd>
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-medium">ARTs</h2>
          {canCreateArt && <CreateArtDialog />}
        </div>
        {vs.artIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine ARTs — mit „ART anlegen“ den ersten erstellen.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {vs.artIds.map((artId) => (
              <li key={artId}>
                <button
                  type="button"
                  onClick={() => onSelectArt(artId)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>ART {artId.slice(0, 8)}…</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-heading text-sm font-medium">Budget (Partizipativ)</h2>
        <p className="text-sm">
          {vs.budgetTotal != null ? (
            <span className="text-xl font-semibold tabular-nums">
              {eur.format(Math.round(vs.budgetTotal))}
            </span>
          ) : (
            <span className="text-muted-foreground">Kein Budget zugewiesen</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Die volle Budget-Allokation wird unter{" "}
          <Link href="/controlling" className="text-primary hover:underline">
            Controlling
          </Link>{" "}
          verwaltet.
        </p>
      </section>
    </div>
  );
}

function GapHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
      {children}
    </span>
  );
}
