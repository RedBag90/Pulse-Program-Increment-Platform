import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { getValueStreamBudgetTotals } from "@/modules/budgeting/server/services/budgeting";
import { Page, PageHeader } from "@/components/layout";

/**
 * Die Wertströme aus Budget-Sicht — der Einstieg in die Fläche, auf der ein
 * ART-Epic-Budget entsteht und der Zuspruch aufgeteilt wird.
 *
 * Löst `/budgeting/run-the-business` ab, das dieselben Positionen zeigte, aber
 * ohne Detailebene und ohne Nav-Eintrag.
 */
const EUR = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export default async function BudgetingValueStreamsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [valueStreams, totals] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    getValueStreamBudgetTotals(db, principal.tenantId),
  ]);

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Wertströme"
        subtitle="Betriebskosten und ART-Epic-Budgets pflegen, und den Zuspruch einer abgeschlossenen Kachel darauf aufteilen."
      />

      {valueStreams.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          Noch keine Wertströme.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {valueStreams.map((vs) => (
            <li key={vs.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <Link
                href={`/budgeting/value-streams/${vs.id}`}
                className="font-medium hover:underline"
              >
                {vs.name}
              </Link>
              <span className="text-sm tabular-nums text-muted-foreground">
                {EUR(totals[vs.id] ?? 0)} zugeteilt insgesamt
              </span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
