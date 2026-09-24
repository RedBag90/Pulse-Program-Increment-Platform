import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { canOpenArt } from "@/modules/core/org/domain/structure-access";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { RememberTab } from "@/modules/core/org/features/structure/components/remember-tab";
import { tabCookieName } from "@/modules/core/org/features/structure/components/tab-memory";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import { ArtOverviewForm } from "@/modules/core/org/features/capacity/components/art-overview-form";
import { DeleteArtButton } from "@/modules/core/org/features/art/components/delete-art-button";
import { mayReadArtBudget } from "@/modules/budgeting/server/services/art-budget-access";
import type { ArtId } from "@/modules/core/kernel/domain/types";

/**
 * Der ART-Knoten der Struktur-Fläche.
 *
 * Der Budget-Reiter bleibt **einer** — anders als beim Wertstrom. Deckung,
 * Rahmen, Verlauf und Aufteilung beantworten dort eine einzige Frage: reicht
 * mein Geld für meine Last. Sie zu zerschneiden nähme ihnen den Zusammenhang.
 *
 * Die frühere Trennung „Overview" (lesend) / „Settings" (schreibend) ist
 * entfallen: ein Formular, das ohne Recht als Definitionsliste rendert, kann
 * beides — so hält es der Wertstrom seit jeher.
 *
 * **Er ist der dünnste der drei Knoten** — und das ist Absicht. Abzeichen und
 * Solutions-Reiter sagten nur, was der Baum links ohnehin zeigt: den Wertstrom
 * darüber und die Solutions darunter. Was hier steht, steht nirgends sonst:
 * seine Stammdaten, seine Verantwortlichen, der Weg zu seinem Geld.
 */
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}

export default async function ArtNodePage({ params, searchParams }: Props) {
  const t = await getTranslations();
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, id as ArtId);
  if (!art) notFound();

  const inScope = canOpenArt(principal.scopes, {
    id: art.id,
    valueStreamId: art.valueStream.id,
  });

  // Das Budget dieses ARTs lebt im Budgeting-Bereich. Hier steht nur der Weg
  // dorthin — für die, die ihn öffnen dürfen.
  const showBudgetLink = await mayReadArtBudget(db, principal, {
    id: art.id,
    valueStreamId: art.valueStream.id,
    financeApproverId: art.valueStream.financeApproverId,
  });

  const tabs: DetailTab[] = [
    { key: "overview", label: "Allgemein" },
    ...(inScope ? [{ key: "history", label: "Verlauf" }] : []),
  ];

  const remembered = (await cookies()).get(tabCookieName("art"))?.value;
  const activeTab = resolveTab(tabs, tab ?? remembered);

  const canEdit =
    inScope &&
    hasCapability(principal, "art.update", { tenantId: principal.tenantId, artId: art.id });

  // **Löschen ist ein eigenes Recht.** Der Knopf hing an `art.update`, die
  // Aktion verlangt `art.delete` (nur Tenant-Admin): wer bearbeiten durfte, sah
  // ihn und lief beim Klick in einen Serverfehler.
  const canDelete =
    inScope &&
    hasCapability(principal, "art.delete", { tenantId: principal.tenantId, artId: art.id });

  return (
    <EntityDetailShell
      title={art.name}
      // Siehe Wertstrom-Knoten: der Baum trug den Pfad, jetzt trägt ihn die
      // Brotkrume. Der Wertstrom ist damit wieder anklickbar — als Weg nach
      // oben, nicht als Wiederholung.
      breadcrumb={[
        { label: "Struktur", href: "/structure" },
        { label: art.valueStream.name, href: `/structure/value-stream/${art.valueStream.id}` },
        { label: art.name },
      ]}
      tabs={tabs}
      activeTab={activeTab}
      basePath={`/structure/art/${art.id}`}
    >
      <RememberTab kind="art" tab={activeTab} />

      {!inScope && (
        <div className="mb-4 rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
          <p className="font-medium">{t("org.page.dieserArtLiegtAusserhalb")}</p>
          <p className="mt-1 text-muted-foreground">{t("org.page.nameUndVerantwortlicheStehen")}</p>
        </div>
      )}

      {activeTab === "overview" && (
        <>
          {showBudgetLink && (
            <p className="mb-4 rounded-lg bg-card shadow-card px-4 py-3 text-sm">
              Das Budget dieses ARTs — Zuteilung, Deckung und die Verteilung auf seine ART-Epics —
              liegt im Budgeting-Bereich.{" "}
              <Link
                href={`/budgeting/value-streams/${art.valueStream.id}?tab=art:${art.id}`}
                className="font-medium text-primary hover:underline"
              >
                {t("org.page.budgetDiesesArts")}
              </Link>
            </p>
          )}
          <OverviewTab
            db={db}
            art={art}
            principal={principal}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </>
      )}
      {activeTab === "history" && <HistoryTab db={db} tenantId={principal.tenantId} id={art.id} />}
    </EntityDetailShell>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- siehe Wertstrom-Knoten. */

async function OverviewTab({ db, art, principal, canEdit, canDelete }: any) {
  const t = await getTranslations();
  const [approvers, userLabels] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const rteUsers = approvers.filter((u: { roles: string[] }) => u.roles.includes("rte"));

  return (
    <div className="space-y-8">
      {canEdit ? (
        <ArtOverviewForm
          key={[
            art.id,
            art.name,
            art.description ?? "",
            art.rteId ?? "",
            art.technicalLeadId ?? "",
          ].join("|")}
          id={art.id}
          name={art.name}
          description={art.description ?? ""}
          rteId={art.rteId ?? ""}
          technicalLeadId={art.technicalLeadId ?? ""}
          rteUsers={rteUsers}
          users={approvers}
          userLabels={userLabels}
        />
      ) : (
        <dl className="max-w-xl space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("org.page.name")}
            </dt>
            <dd className="mt-0.5">{art.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("org.page.wertstrom")}
            </dt>
            <dd className="mt-0.5">{art.valueStream.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("org.page.beschreibung")}
            </dt>
            <dd className="mt-0.5">{art.description ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("org.page.rte")}
            </dt>
            <dd className="mt-0.5">{art.rteId ? userLabel(art.rteId, userLabels) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("org.page.artTechnicalLead")}
            </dt>
            <dd className="mt-0.5">
              {art.technicalLeadId ? userLabel(art.technicalLeadId, userLabels) : "—"}
            </dd>
          </div>
        </dl>
      )}

      {canDelete && (
        <section>
          <h2 className="mb-2 text-sm font-medium">{t("org.page.artLoeschen")}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t("org.page.entferntDenArtAus")}</p>
          <DeleteArtButton id={art.id} name={art.name} />
        </section>
      )}
    </div>
  );
}

async function HistoryTab({ db, tenantId, id }: any) {
  const t = await getTranslations();
  const history = await listAuditHistory(db, tenantId, "art", id);
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">{t("org.page.verlauf")}</h2>
      <AuditTimeline
        events={history.map((e: { id: string; action: string; occurredAt: Date }) => ({
          id: e.id,
          action: e.action,
          occurredAt: e.occurredAt.toISOString(),
        }))}
      />
    </section>
  );
}
