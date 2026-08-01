import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";

/**
 * Übergangs-Platzhalter für Plattform-Flächen, die in einer späteren Roadmap-
 * Phase gebaut werden. Hält die Route + Tab-Navigation ab P1 begehbar; jede
 * Phase ersetzt „ihren" Platzhalter durch die echte Fläche.
 */
export function PlatformPlaceholder({
  title,
  subtitle,
  phase,
}: {
  title: string;
  subtitle: string;
  phase: string;
}) {
  return (
    <Page>
      <PageHeader title={title} subtitle={subtitle} />
      <PageSection>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Diese Fläche wird in Roadmap-{phase} gebaut.
        </div>
      </PageSection>
    </Page>
  );
}
