"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AlertOctagon, Flame, Clock, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { setImpedimentRoamBatchAction } from "@/features/impediment/actions/impediment";
import {
  ROAM_STATUSES,
  IMPEDIMENT_WORKFLOW_STATUSES,
  IMPEDIMENT_SEVERITIES,
  type RoamStatus,
  type ImpedimentSeverity,
  type ImpedimentWorkflowStatus,
  type ImpedimentsOverviewModel,
  type ImpedimentOverviewRow,
} from "@/server/views/impediments-overview";
import { SEVERITY_BADGE, SEVERITY_LABEL, STATUS_LABEL } from "@/features/impediment/labels";

interface Props {
  model: ImpedimentsOverviewModel;
  canBulk: boolean;
}

const ROAM_LABEL: Record<RoamStatus, string> = {
  open: "Offen",
  resolved: "Resolved",
  owned: "Owned",
  accepted: "Accepted",
  mitigated: "Mitigated",
};

const ROAM_DOT: Record<RoamStatus, string> = {
  open: "bg-amber-500",
  resolved: "bg-emerald-500",
  owned: "bg-blue-500",
  accepted: "bg-slate-500",
  mitigated: "bg-purple-500",
};

function parseRoam(raw: string | null): RoamStatus | null {
  if (!raw) return null;
  return (ROAM_STATUSES as readonly string[]).includes(raw) ? (raw as RoamStatus) : null;
}
function parseStatus(raw: string | null): ImpedimentWorkflowStatus | null {
  if (!raw) return null;
  return (IMPEDIMENT_WORKFLOW_STATUSES as readonly string[]).includes(raw)
    ? (raw as ImpedimentWorkflowStatus)
    : null;
}
function parseSeverity(raw: string | null): ImpedimentSeverity | null {
  if (!raw) return null;
  return (IMPEDIMENT_SEVERITIES as readonly string[]).includes(raw)
    ? (raw as ImpedimentSeverity)
    : null;
}

/**
 * Cross-ART Impediments-Overview mit ROAM-Funnel als primärer Achse.
 * Filter: ART · PI · Severity · Workflow-Status · Owner · Suche.
 * Bulk-ROAM nur dann aktiv, wenn alle ausgewählten Impediments im
 * selben ART liegen (per-Item Auth ist ART-scoped).
 */
export function ImpedimentsOverviewShell({ model, canBulk }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const roam = parseRoam(searchParams.get("roam"));
  const artId = searchParams.get("art");
  const piId = searchParams.get("pi");
  const severity = parseSeverity(searchParams.get("severity"));
  const status = parseStatus(searchParams.get("status"));
  const ownerId = searchParams.get("owner");
  const query = searchParams.get("q") ?? "";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRoam, setBulkRoam] = useState<RoamStatus>("mitigated");
  const [pending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const pushParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const filtered = useMemo<ImpedimentOverviewRow[]>(() => {
    const q = query.trim().toLowerCase();
    return model.rows.filter((r) => {
      if (roam != null && r.roamStatus !== roam) return false;
      if (artId && r.art.id !== artId) return false;
      if (piId === "backlog" && r.pi != null) return false;
      if (piId && piId !== "backlog" && r.pi?.id !== piId) return false;
      if (severity && r.severity !== severity) return false;
      if (status && r.status !== status) return false;
      if (ownerId && r.raisedById !== ownerId) return false;
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.art.name.toLowerCase().includes(q)) return true;
      if ((r.raisedByLabel ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [model.rows, roam, artId, piId, severity, status, ownerId, query]);

  // Bulk: nur erlaubt, wenn alle ausgewählten Impediments im selben ART.
  const selectedRows = useMemo(
    () => model.rows.filter((r) => selected.has(r.id)),
    [model.rows, selected],
  );
  const selectedArtIds = new Set(selectedRows.map((r) => r.art.id));
  const bulkArtId = selectedArtIds.size === 1 ? [...selectedArtIds][0]! : null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const ids = filtered.map((r) => r.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  }
  function clearSelection() {
    setSelected(new Set());
  }
  function runBulk() {
    if (!bulkArtId) return;
    const fd = new FormData();
    for (const r of selectedRows) fd.append("impedimentIds", r.id);
    fd.set("artId", bulkArtId);
    fd.set("roamStatus", bulkRoam);
    startTransition(async () => {
      setBulkError(null);
      const res = await setImpedimentRoamBatchAction({}, fd);
      if (res.error) setBulkError(res.error);
      else clearSelection();
    });
  }

  return (
    <main className="p-6 md:p-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Risks &amp; Impediments — ROAM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Impediments im Zugriff über ARTs hinweg. ROAM ist die Akzeptanz- Sicht (Resolved ·
          Owned · Accepted · Mitigated), Workflow-Status bleibt als zweite Filter-Achse.
        </p>
      </header>

      {/* ROAM-Funnel */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ROAM_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pushParam({ roam: roam === s ? null : s })}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
              roam === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-muted"
            }`}
          >
            <span className={`size-2 rounded-full ${ROAM_DOT[s]}`} />
            <span>{ROAM_LABEL[s]}</span>
            <span
              className={`tabular-nums ${roam === s ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              {model.roamFunnelCounts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter-Bar */}
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_repeat(5,auto)]">
        <input
          type="search"
          value={query}
          onChange={(e) => pushParam({ q: e.target.value || null })}
          placeholder="Suche Titel · ART · Owner …"
          className="rounded-md border border-input bg-card px-3 py-1.5 text-sm"
        />
        <select
          value={artId ?? ""}
          onChange={(e) => pushParam({ art: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle ARTs</option>
          {model.artOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={piId ?? ""}
          onChange={(e) => pushParam({ pi: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle PIs</option>
          <option value="backlog">— ohne PI</option>
          {model.piOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={severity ?? ""}
          onChange={(e) => pushParam({ severity: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle Schweren</option>
          {model.severityOptions.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={status ?? ""}
          onChange={(e) => pushParam({ status: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle Status</option>
          {IMPEDIMENT_WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={ownerId ?? ""}
          onChange={(e) => pushParam({ owner: e.target.value || null })}
          className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Alle Owner</option>
          {model.ownerOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabelle */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {canBulk && (
                <th className="py-2 pl-4 pr-2">
                  <input
                    type="checkbox"
                    aria-label="Alle auswählen"
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                    className="size-4 rounded border-border"
                  />
                </th>
              )}
              <th className="py-2 pr-3">Impediment</th>
              <th className="py-2 pr-3">ART · PI</th>
              <th className="py-2 pr-3">Schwere</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">ROAM</th>
              <th className="py-2 pr-4 text-right">Tage offen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canBulk ? 7 : 6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Keine Impediments im aktuellen Filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <ImpedimentRow
                  key={r.id}
                  row={r}
                  selected={selected.has(r.id)}
                  onToggle={() => toggleSelect(r.id)}
                  canBulk={canBulk}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {filtered.length} von {model.rows.length} Impediments im Zugriff.
      </p>

      {canBulk && selected.size > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-2 shadow-lg">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
              {selected.size} ausgewählt
            </span>
            {bulkArtId == null ? (
              <p className="text-xs text-amber-700">
                Bulk-ROAM nur innerhalb eines ARTs möglich — bitte die Auswahl auf einen ART
                einschränken.
              </p>
            ) : (
              <>
                <label className="ml-2 flex items-center gap-2 text-xs">
                  ROAM →
                  <select
                    value={bulkRoam}
                    onChange={(e) => setBulkRoam(e.target.value as RoamStatus)}
                    className="rounded-md border border-input bg-card px-2 py-1 text-xs"
                  >
                    {ROAM_STATUSES.filter((s) => s !== "open").map((s) => (
                      <option key={s} value={s}>
                        {ROAM_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={runBulk}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {pending ? "…" : "Setzen"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Auswahl aufheben"
              className="ml-auto rounded border border-input p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
            {bulkError && (
              <p role="alert" className="w-full text-xs text-destructive">
                {bulkError}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ImpedimentRow({
  row,
  selected,
  onToggle,
  canBulk,
}: {
  row: ImpedimentOverviewRow;
  selected: boolean;
  onToggle: () => void;
  canBulk: boolean;
}) {
  return (
    <tr className="border-b align-middle last:border-b-0 hover:bg-muted/30">
      {canBulk && (
        <td className="py-2 pl-4 pr-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`${row.title} auswählen`}
            className="size-4 rounded border-border"
          />
        </td>
      )}
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/art/${row.art.id}/impediments`}
            className="block max-w-[260px] truncate font-medium text-primary hover:underline"
            title={row.title}
          >
            {row.title}
          </Link>
          {row.isCritical && (
            <span
              title="Kritische Schwere"
              className="inline-flex size-5 items-center justify-center rounded bg-red-100 text-red-700"
            >
              <Flame className="size-3" />
            </span>
          )}
          {row.isOverdue && (
            <span
              title="Länger als 14 Tage offen"
              className="inline-flex size-5 items-center justify-center rounded bg-amber-100 text-amber-700"
            >
              <Clock className="size-3" />
            </span>
          )}
        </div>
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">
        <span className="block max-w-[200px] truncate">
          {row.art.name} · {row.pi?.name ?? "—"}
        </span>
      </td>
      <td className="py-2 pr-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${SEVERITY_BADGE[row.severity]}`}
        >
          {SEVERITY_LABEL[row.severity]}
        </span>
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">{STATUS_LABEL[row.status]}</td>
      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`size-1.5 rounded-full ${ROAM_DOT[row.roamStatus]}`} />
          <span className="text-muted-foreground">{ROAM_LABEL[row.roamStatus]}</span>
        </span>
      </td>
      <td className="py-2 pr-4 text-right text-xs tabular-nums text-muted-foreground">
        {row.daysOpen}d
      </td>
    </tr>
  );
}

// AlertOctagon ist als Fallback-Icon im Header reserviert; jetzt nicht
// im JSX direkt verwendet, aber im Funnel-Label sinnvoll falls erweitert.
void AlertOctagon;
