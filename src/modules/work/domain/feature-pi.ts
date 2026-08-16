/**
 * The Feature ↔ PI ↔ Timeline consistency invariant, in one pure place.
 *
 * A Feature may point at a PI only while its ART subscribes to that PI's
 * Timeline — i.e. the ART's `timelineId` equals the PI's `timelineId`. The rule
 * is enforced FORWARD when assigning a PI (Work's `setFeaturePi`) and repaired
 * BACKWARD when an ART leaves a Timeline (Drumbeat's `detachArtFromTimeline`,
 * which imports this predicate DOWN, ADR-0013). Both directions share this
 * single definition.
 *
 * Pure — no I/O, no Date.
 */

/**
 * Whether a Feature's PI assignment is consistent with its ART: true only when
 * the ART is on a Timeline and that Timeline is the PI's Timeline. A `null`
 * ART-Timeline (ART on no Timeline) is never consistent; a `null` PI-Timeline
 * (legacy, unlinked PI) never matches a real ART Timeline.
 */
export function featurePiConsistent(input: {
  artTimelineId: string | null;
  piTimelineId: string | null;
}): boolean {
  const { artTimelineId, piTimelineId } = input;
  return artTimelineId !== null && artTimelineId === piTimelineId;
}
