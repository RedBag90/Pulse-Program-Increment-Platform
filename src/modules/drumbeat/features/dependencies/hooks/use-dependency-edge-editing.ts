"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  linkDependencyAction,
  unlinkDependencyAction,
  changeDependencyTypeAction,
  relinkDependencyAction,
} from "@/modules/drumbeat/features/dependencies/actions/dependency";
import {
  linkDependency,
  unlinkDependency,
  changeDependencyType,
  relinkDependency,
  type DependencyEdgeType,
} from "@/modules/drumbeat/features/dependencies/lib/dependency-actions-client";

/** Minimal edge shape the editing callbacks need to resolve a dependency by id. */
interface EditableDependency {
  id: string;
  fromId: string;
  toId: string;
  type: DependencyEdgeType;
}

/**
 * Dependency-edge editing for the flat cockpit views (Netzplan + Roadmap).
 * Owns the `startTransition` + error state and routes every mutation through
 * the typed {@link linkDependency}/{@link unlinkDependency}/
 * {@link changeDependencyType} wrappers. Extracted because the `callLink` /
 * `callUnlink` / `callChangeType` trio was byte-for-byte identical between
 * `CockpitNetwork` and `CockpitRoadmap`.
 */
export function useDependencyEdgeEditing(
  artId: string,
  dependencies: readonly EditableDependency[],
) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const depById = (depId: string): EditableDependency | undefined =>
    dependencies.find((d) => d.id === depId);

  function callLink(sourceId: string, targetId: string, type: DependencyEdgeType = "blocks") {
    if (sourceId === targetId) return;
    startTransition(async () => {
      const res = await linkDependency(linkDependencyAction, {
        fromId: sourceId,
        toId: targetId,
        type,
        artId,
      });
      setError(res.error ?? null);
    });
  }

  function callUnlink(depId: string) {
    const d = depById(depId);
    if (!d) return;
    startTransition(async () => {
      const res = await unlinkDependency(unlinkDependencyAction, {
        fromId: d.fromId,
        toId: d.toId,
        type: d.type,
        artId,
      });
      setError(res.error ?? null);
    });
  }

  function callChangeType(depId: string, next: DependencyEdgeType) {
    const d = depById(depId);
    if (!d || d.type === next) return;
    startTransition(async () => {
      const res = await changeDependencyType(changeDependencyTypeAction, {
        fromId: d.fromId,
        toId: d.toId,
        fromType: d.type,
        toType: next,
        artId,
      });
      setError(res.error ?? null);
    });
  }

  /**
   * **Ein Ende aufnehmen und woanders ablegen.**
   *
   * Es wirkt **sofort** — und eine Meldung bietet „Rückgängig" an. Das ist die
   * flüssigere Bedienung als ein Bestätigungsdialog vor jeder Geste, und ein
   * Fehlgriff ist mit einem Klick geheilt: derselbe Aufruf mit vertauschten
   * Rollen.
   *
   * Der Server entscheidet — Zyklus, Selbstbezug, doppeltes Paar, gelöschtes
   * Ziel. Die Fläche prüft vorher nur, was sie ohne Rundreise wissen kann.
   */
  function callRelink(depId: string, newFromId: string, newToId: string) {
    const d = depById(depId);
    if (!d) return;
    if (newFromId === newToId) return;
    if (d.fromId === newFromId && d.toId === newToId) return;

    startTransition(async () => {
      const res = await relinkDependency(relinkDependencyAction, {
        fromId: d.fromId,
        toId: d.toId,
        type: d.type,
        newFromId,
        newToId,
        artId,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setError(null);
      toast.success("Abhängigkeit umgehängt", {
        action: {
          label: "Rückgängig",
          onClick: () => {
            startTransition(async () => {
              const zurueck = await relinkDependency(relinkDependencyAction, {
                fromId: newFromId,
                toId: newToId,
                type: d.type,
                newFromId: d.fromId,
                newToId: d.toId,
                artId,
              });
              if (zurueck.error) toast.error(zurueck.error);
            });
          },
        },
      });
    });
  }

  return { error, callLink, callUnlink, callChangeType, callRelink };
}
