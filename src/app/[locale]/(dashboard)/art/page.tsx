import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listArts } from "@/server/services/art";
import { listValueStreams } from "@/server/services/value-stream";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { DeleteArtButton } from "@/features/art/components/delete-art-button";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Zap } from "lucide-react";

export default async function ArtPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [arts, valueStreams] = await Promise.all([
    listArts(db, principal.tenantId),
    listValueStreams(db, principal.tenantId),
  ]);

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");

  const vsOptions = valueStreams.map((vs) => ({ id: vs.id, name: vs.name }));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agile Release Trains</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage ARTs and their Program Increments
          </p>
        </div>
        {canEdit && <CreateArtDialog valueStreams={vsOptions} />}
      </div>

      {arts.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No ARTs yet"
          description="Create an Agile Release Train to start planning Program Increments."
          action={canEdit ? <CreateArtDialog valueStreams={vsOptions} /> : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {arts.map((art) => (
            <Card
              key={art.id}
              className="p-5 space-y-3 hover:shadow-sm hover:border-primary/30 transition-all"
            >
              <div className="space-y-0.5">
                <Link
                  href={`/art/${art.id}`}
                  className="font-semibold hover:text-primary transition-colors block"
                >
                  {art.name}
                </Link>
                <p className="text-sm text-muted-foreground">{art.valueStream.name}</p>
                {art.piCadenceWeeks && (
                  <p className="text-xs text-muted-foreground">
                    PI Cadence: {art.piCadenceWeeks} weeks
                  </p>
                )}
                <p className="text-xs text-muted-foreground/60">
                  {art._count.pis} PI{art._count.pis !== 1 ? "s" : ""}
                </p>
              </div>
              {canEdit && (
                <div>
                  <DeleteArtButton id={art.id} name={art.name} />
                </div>
              )}
              <div className="flex gap-1.5 pt-1 border-t border-border">
                {[
                  { href: `/art/${art.id}/features`, label: "Features" },
                  { href: `/art/${art.id}/pi`, label: "PI Planning" },
                  { href: `/art/${art.id}/teams`, label: "Teams" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex-1 text-center rounded-md bg-muted/50 hover:bg-accent hover:text-accent-foreground px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
