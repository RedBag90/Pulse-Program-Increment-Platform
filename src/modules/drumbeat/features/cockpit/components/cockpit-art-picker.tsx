"use client";

import { useTranslations } from "next-intl";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import type { CockpitArtRef } from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

/**
 * Der ART-Wähler — die eine Hälfte des Scopes (die andere ist der Zeitraum).
 *
 * Er stand vorher in der Filterleiste, zwischen den Sicht-Reitern und den
 * Facetten: ein Scope-Wechsel sah dort aus wie ein Filter. Jetzt steht er im
 * Kopf, neben dem Namen, den er ändert.
 *
 * Bei genau einem ART gibt es nichts zu wählen — dann rendert er gar nichts,
 * denn der Name steht ohnehin als Titel darüber.
 */
export function CockpitArtPicker({
  availableArts,
  selectedArt,
}: {
  availableArts: CockpitArtRef[];
  selectedArt: CockpitArtRef | null;
}) {
  const t = useTranslations();
  const { setParams } = useUrlState();

  if (availableArts.length <= 1) return null;

  const options: SearchSelectOption[] = availableArts.map((a) => ({
    value: a.id,
    label: a.name,
    // Die Zahl in Klammern stand früher im Label und erklärte sich nicht. Als
    // Hinweis ist sie dort, wo Hinweise stehen, und sagt, was sie zählt.
    hint: `${a.activeFeatureCount} im aktiven PI`,
  }));

  return (
    <SearchSelect
      value={selectedArt?.id ?? ""}
      onChange={(v) =>
        // Der Zeitraum gehört zum alten ART: eine PI aus einer fremden Timeline
        // würde still auf das aktive zurückfallen. Lieber neu bestimmen.
        setParams({ art: v, pi: null, piw: null })
      }
      options={options}
      placeholder={t("drumbeat.ui.artWaehlen")}
      ariaLabel={t("drumbeat.ui.artAuswaehlen")}
      className="w-56"
    />
  );
}
