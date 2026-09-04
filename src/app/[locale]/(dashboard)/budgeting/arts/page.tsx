import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { getTenantPractices } from "@/server/services/target-model";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { openCycleKeys } from "@/modules/budgeting/domain/art-pot-window";
import { artEpicBudgetTotal } from "@/modules/budgeting/server/services/art-pot";
import { Page, PageHeader } from "@/components/layout";

/**
 * Die Liste, über die ein ART an sein Budget kommt — ohne Umweg über eine
 * Kachel und ohne Umweg über die Struktur.
 *
 * Sichtbar sind die ARTs, für die einer der Wege zum Lesen greift; das Recht
 * hängt am ART (`budget.read`, `art`-scoped) oder tenant-weit an der Rolle.
 */
const EUR = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export default async function ArtBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; vs?: string }>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const practices = await getTenantPractices(db, principal.tenantId);
  // REQ-19: ohne die Practice gibt es keine ART-Epics — und damit nichts zu zeigen.
  if (!practices.artEpics) redirect("/budgeting/periods");

  const { cycle, vs } = await searchParams;
  const now = new Date();
  const cycles = openCycleKeys(now);
  const cycleKey =
    cycle != null && (cycles as readonly string[]).includes(cycle) ? cycle : cycles[0];

  const arts = await db.art.findMany({
    where: {
      tenantId: principal.tenantId,
      ...(vs != null ? { valueStreamId: vs } : {}),
    },
    select: { id: true, name: true, valueStream: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  const rows = (
    await Promise.all(
      arts.map(async (a) => {
        // Dieselben drei Lesewege wie am Knoten — nur hier als Filter.
        const visible =
          hasCapability(principal, "budget.read", {
            tenantId: principal.tenantId,
            artId: a.id,
          }) ||
          hasCapability(principal, "art_budget.distribute", {
            tenantId: principal.tenantId,
            artId: a.id,
          });
        if (!visible) return null;
        const [total, allocations] = await Promise.all([
          artEpicBudgetTotal(db, principal.tenantId, a.id, cycleKey),
          db.artEpicAllocation.findMany({
            where: { tenantId: principal.tenantId, artId: a.id, cycleKey },
            select: { amount: true },
          }),
        ]);
        const distributed = allocations.reduce((s, x) => s + Number(x.amount), 0);
        return { ...a, total, distributed, remaining: total - distributed };
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r != null);

  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);

  return (
    <Page>
      <PageHeader eyebrow="Participatory Budgeting" title="ART-Budgets" />

      <nav className="flex flex-wrap items-center gap-2" aria-label="Halbjahr">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Halbjahr
        </span>
        {cycles.map((c) => (
          <Link
            key={c}
            href={`/budgeting/arts?cycle=${c}${vs != null ? `&vs=${vs}` : ""}`}
            aria-current={c === cycleKey ? "page" : undefined}
            className={`rounded-md border px-2.5 py-1 text-sm ${
              c === cycleKey
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {halfYearLabel(c)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Für dieses Halbjahr ist Ihnen kein ART-Budget zugänglich.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-frame text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">ART</th>
                <th className="px-3 py-2">Wertstrom</th>
                <th className="px-3 py-2 text-right">ART-Epic-Budget</th>
                <th className="px-3 py-2 text-right">Verteilt</th>
                <th className="px-3 py-2 text-right">Rest</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/budgeting/arts/${r.id}?cycle=${cycleKey}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStream?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.total > 0 ? EUR(r.total) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{EUR(r.distributed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{EUR(r.remaining)}</td>
                </tr>
              ))}
              <tr className="border-t bg-surface-frame font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  Summe
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{EUR(sum((r) => r.total))}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {EUR(sum((r) => r.distributed))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {EUR(sum((r) => r.remaining))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
