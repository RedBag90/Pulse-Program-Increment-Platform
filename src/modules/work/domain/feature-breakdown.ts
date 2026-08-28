/**
 * `FeatureBreakdown` — der **Work-eigene Read-Port** für die Lesedarstellung eines
 * Features (ADR-0013 §3). Trägt die Work-eigenen Attribute eines Features: Titel,
 * Delivery-Status, ART-Zugehörigkeit, Parent-Epic und Owner. Upper-Module
 * (Drumbeat) konsumieren/erweitern diesen Port, statt die Feature-Lesegestalt
 * selbst zu definieren.
 *
 * Rein (nur Typ). Die drumbeat-spezifischen Anreicherungen (PI-Zuordnung,
 * Blocker-Signale, aufgelöster Owner-Name) hängt das Cockpit-Read-Model on top
 * (`CockpitFeature = FeatureBreakdown & { … }`).
 */

import type { FeatureDeliveryStatus } from "@/modules/work/domain/feature-status";

export interface FeatureBreakdown {
  id: string;
  title: string;
  status: FeatureDeliveryStatus;
  /** Owning ART (jedes Feature gehört zu genau einem ART). */
  artId: string;
  artName: string;
  /** Parent-Epic-Bezug; `null` = Orphan-Feature. */
  parentId: string | null;
  parentTitle: string | null;
  ownerId: string | null;
  wsjfComputed: number | null;
}
