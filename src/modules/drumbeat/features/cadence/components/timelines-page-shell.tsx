"use client";

import { StructurePageShell } from "@/modules/core/org/features/structure/components/structure-page-shell";
import { CreateTimelineButton } from "@/modules/drumbeat/features/cadence/components/create-timeline-button";
import { TimelineDetailPane } from "@/modules/drumbeat/features/cadence/components/timeline-detail-pane";
import type { PiStandardOption } from "@/modules/drumbeat/features/cadence/components/add-standard-pis-control";
import type { StructurePageModel } from "@/modules/core/org/server/views/structure-page";

interface Props {
  model: StructurePageModel;
  /** Verfügbare PI-Standards für den „Standard anwenden"-Pfad im Detail-Pane. */
  piStandards: PiStandardOption[];
  canUpdateVs: boolean;
  canCreateArt: boolean;
  canUpdateArt: boolean;
  canDeleteArt: boolean;
  canManageTimeline: boolean;
}

/**
 * Client-Adapter für die Timelines-Seite.
 *
 * Die Kadenz-Slots der `StructurePageShell` sind eine **Render-Funktion**, weil
 * das Detail-Pane den `onSelectNode`-Callback der Shell braucht (er verdrahtet
 * „ART joinen" mit der Auswahl im linken Baum). Eine Funktion überlebt die
 * RSC-Grenze nicht — die Server-Page darf sie also nicht setzen, sonst wirft
 * React beim Serialisieren und die Seite läuft in die Error-Boundary.
 *
 * Dieser Adapter sitzt bereits auf der Client-Seite und schliesst die Lücke:
 * die Page reicht nur noch serialisierbare Daten durch, die Funktion entsteht
 * hier.
 *
 * Die Entkopplung aus ADR-0013 bleibt erhalten: die Core-Org-Shell importiert
 * weiterhin keine Kadenz-Komponenten, sondern bekommt sie injiziert — nur eben
 * von hier statt vom Composition-Root. Drumbeat → Core ist erlaubt.
 */
export function TimelinesPageShell({
  model,
  piStandards,
  canUpdateVs,
  canCreateArt,
  canUpdateArt,
  canDeleteArt,
  canManageTimeline,
}: Props) {
  return (
    <StructurePageShell
      title="Timelines"
      subtitle="Geteilte PI-Kadenzen — Timelines, ihre PIs und subscribierte ARTs."
      availableKinds={["timeline"]}
      model={model}
      canCreateVs={false}
      canUpdateVs={canUpdateVs}
      canCreateArt={canCreateArt}
      canUpdateArt={canUpdateArt}
      canDeleteArt={canDeleteArt}
      canManageTimeline={canManageTimeline}
      createTimelineSlot={<CreateTimelineButton />}
      renderTimelineDetail={(timeline, onSelectNode) => (
        <TimelineDetailPane
          timeline={timeline}
          canManage={canManageTimeline}
          piStandards={piStandards}
          onSelectNode={onSelectNode}
        />
      )}
    />
  );
}
