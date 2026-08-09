"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FeatureDetailShell } from "@/modules/drumbeat/features/umsetzung/components/feature-detail-shell";
import type { CockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";

/**
 * Slide-Over fuer das Feature-Detail. URL-State `?featureId=<id>`
 * persistiert die Auswahl (Entscheidung #3 Slide-Over + Deeplink-Route).
 * Schliessen entfernt den Param ueber router.replace.
 *
 * Layout: rechter Sheet mit max-w-3xl (ca. 40 % der Page), Backdrop-blur
 * vom Sheet-Primitive. ESC + Klick-ausserhalb schliessen via base-ui.
 */
interface Props {
  detail: CockpitFeatureDetail;
}

export function FeatureSlideOver({ detail }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const featureId = searchParams.get("featureId");
  // Lokaler Tab-State — Slide-Over swappt den Inhalt in-place, ohne
  // wie die Voll-Route auf eine andere URL zu navigieren. Reset auf
  // „overview" bei jedem Featurewechsel, damit man nicht im Detail
  // eines anderen Features auf dem History-Tab landet.
  const [tab, setTab] = useState<string>("overview");
  useEffect(() => {
    setTab("overview");
  }, [detail.model.id]);

  function setOpen(open: boolean) {
    if (open) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("featureId");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  }

  return (
    <Sheet open={!!featureId} onOpenChange={setOpen}>
      <SheetContent side="right" className="!max-w-3xl overflow-y-auto p-0 sm:!max-w-3xl">
        <div className="p-4">
          <FeatureDetailShell
            model={detail.model}
            canEdit={detail.canEdit}
            canTransition={detail.canTransition}
            canLinkDependency={detail.canLinkDependency}
            outgoing={detail.outgoing}
            incoming={detail.incoming}
            candidates={detail.candidates}
            historyEvents={detail.historyEvents}
            userLabels={detail.userLabels}
            activeTab={tab}
            onTabChange={setTab}
            embed
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
