import {
  Network,
  Zap,
  Users,
  UsersRound,
  Layers,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { userLabel } from "@/components/detail/initiative-labels";
import { CreateValueStreamDialog } from "@/features/portfolio/components/create-value-stream-dialog";
import type { StructureTree } from "@/server/services/structure";
import type { PracticeFlags } from "@/domain/operating-model";

interface Props {
  tree: StructureTree;
  userLabels: Record<string, string>;
  epicsByValueStream: Record<string, number>;
  activePiCount: number;
  canCreateVs: boolean;
  /** The practices the tenant's target operating model enables — gaps for
   *  disabled practices (e.g. governance roles without portfolio level) are
   *  not shown. Defaults to all-on when no target is defined. */
  practices: PracticeFlags;
}

type GapItem = { name: string; href: string };
/** `show` lets a row be hidden when its practice is not part of the target. */
type GapRow = { label: string; items: GapItem[]; show: boolean };

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Structure Overview — a portfolio-structure health dashboard: key counts, the
 * setup gaps that need attention (with links to fix them), and per-value-stream
 * rollups. Distinct from delivery reporting (Berichte → Portfolio-Gesundheit).
 */
export function StructureOverview({
  tree,
  userLabels,
  epicsByValueStream,
  activePiCount,
  canCreateVs,
  practices,
}: Props) {
  const arts = tree.flatMap((vs) => vs.arts);
  const teams = arts.flatMap((a) => a.teams);
  const totalFte = teams.reduce((n, t) => n + (t.headcount ?? 0), 0);
  const totalEpics = Object.values(epicsByValueStream).reduce((n, c) => n + c, 0);

  const vsHref = (id: string) => `/capacity/value-streams/${id}`;
  const artHref = (id: string) => `/capacity/arts/${id}`;
  const teamHref = (id: string) => `/capacity/teams/${id}`;

  // Gaps are gauged against the declared target: governance-role gaps only
  // matter when the portfolio level is part of the target, RTE/team-structure
  // gaps only when the program level is. With no target, all practices are on.
  const gapRows: GapRow[] = [
    {
      label: "Wertströme ohne VMO",
      show: practices.portfolioLevel,
      items: tree.filter((vs) => !vs.vmoId).map((vs) => ({ name: vs.name, href: vsHref(vs.id) })),
    },
    {
      label: "Wertströme ohne Finance Approver",
      show: practices.portfolioLevel,
      items: tree
        .filter((vs) => !vs.financeApproverId)
        .map((vs) => ({ name: vs.name, href: vsHref(vs.id) })),
    },
    {
      label: "ARTs ohne RTE",
      show: practices.programLevel,
      items: arts.filter((a) => !a.rteId).map((a) => ({ name: a.name, href: artHref(a.id) })),
    },
    {
      label: "Teams ohne Scrum Master / Product Owner",
      show: true,
      items: teams
        .filter((t) => !t.scrumMasterId || !t.productOwnerId)
        .map((t) => ({ name: t.name, href: teamHref(t.id) })),
    },
    {
      label: "Teams ohne Headcount",
      show: true,
      items: teams
        .filter((t) => t.headcount == null)
        .map((t) => ({ name: t.name, href: teamHref(t.id) })),
    },
    {
      label: "Wertströme ohne ART",
      show: practices.portfolioLevel && practices.programLevel,
      items: tree
        .filter((vs) => vs.arts.length === 0)
        .map((vs) => ({ name: vs.name, href: vsHref(vs.id) })),
    },
    {
      label: "ARTs ohne Team",
      show: practices.programLevel,
      items: arts
        .filter((a) => a.teams.length === 0)
        .map((a) => ({ name: a.name, href: artHref(a.id) })),
    },
  ].filter((row) => row.show && row.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Network} label="Wertströme" value={tree.length} />
        <Stat icon={Zap} label="ARTs" value={arts.length} />
        <Stat icon={Users} label="Teams" value={teams.length} />
        <Stat icon={UsersRound} label="FTE" value={totalFte} />
        <Stat icon={Layers} label="Epics" value={totalEpics} />
        <Stat icon={CalendarClock} label="Aktive PIs" value={activePiCount} />
      </div>

      {/* Struktur-Lücken */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-heading text-sm font-medium">Struktur-Lücken</h2>
        {gapRows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Struktur vollständig — alle Rollen zugewiesen.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {gapRows.map((row) => (
              <li key={row.label} className="flex gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <span className="font-medium">
                    {row.items.length} {row.label}
                  </span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {row.items.map((it, i) => (
                      <span key={it.href}>
                        {i > 0 && ", "}
                        <Link href={it.href} className="text-primary hover:underline">
                          {it.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Wertstrom-Rollup */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-medium">Wertströme</h2>
        {canCreateVs && <CreateValueStreamDialog />}
      </div>

      {tree.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Noch keine Wertströme. Lege einen an, um die Struktur aufzubauen.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tree.map((vs) => {
            const vsTeams = vs.arts.flatMap((a) => a.teams);
            const fte = vsTeams.reduce((n, t) => n + (t.headcount ?? 0), 0);
            return (
              <Link
                key={vs.id}
                href={vsHref(vs.id)}
                className="block space-y-2 rounded-lg border p-5 transition-colors hover:bg-muted/50"
              >
                <h3 className="font-semibold">{vs.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {vs.budgetAmount
                    ? `${vs.budgetAmount.toString()} ${vs.budgetCurrency ?? ""}`
                    : "Kein Budget"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vs.arts.length} ART{vs.arts.length !== 1 ? "s" : ""} · {vsTeams.length} Team
                  {vsTeams.length !== 1 ? "s" : ""} · {fte} FTE · {epicsByValueStream[vs.id] ?? 0}{" "}
                  Epics
                </p>
                <p className="text-xs text-muted-foreground">
                  VMO: {vs.vmoId ? userLabel(vs.vmoId, userLabels) : "—"} · Finance:{" "}
                  {vs.financeApproverId ? userLabel(vs.financeApproverId, userLabels) : "—"}
                </p>
                {(!vs.vmoId || !vs.financeApproverId) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {!vs.vmoId && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        kein VMO
                      </span>
                    )}
                    {!vs.financeApproverId && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        kein Finance
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
