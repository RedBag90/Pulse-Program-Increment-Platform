"use client";

import { useState } from "react";

interface ValueStream {
  id: string;
  name: string;
  arts: { id: string; name: string }[];
}

interface ScopePickerProps {
  valueStreams: ValueStream[];
  initialValueStreamIds?: string[];
  initialArtIds?: string[];
}

export function ScopePicker({
  valueStreams,
  initialValueStreamIds = [],
  initialArtIds = [],
}: ScopePickerProps) {
  const [selectedVsIds, setSelectedVsIds] = useState<Set<string>>(new Set(initialValueStreamIds));
  const [selectedArtIds, setSelectedArtIds] = useState<Set<string>>(new Set(initialArtIds));
  const [allVs, setAllVs] = useState(initialValueStreamIds.length === 0);

  const toggleVs = (id: string) => {
    const next = new Set(selectedVsIds);
    if (next.has(id)) {
      next.delete(id);
      // Remove arts that belong to this value stream
      const vs = valueStreams.find((v) => v.id === id);
      if (vs) {
        const nextArts = new Set(selectedArtIds);
        vs.arts.forEach((a) => nextArts.delete(a.id));
        setSelectedArtIds(nextArts);
      }
    } else {
      next.add(id);
    }
    setSelectedVsIds(next);
    setAllVs(false);
  };

  const toggleArt = (artId: string, vsId: string) => {
    if (!selectedVsIds.has(vsId) && !allVs) return;
    const next = new Set(selectedArtIds);
    if (next.has(artId)) next.delete(artId);
    else next.add(artId);
    setSelectedArtIds(next);
  };

  const availableArts = valueStreams
    .filter((vs) => allVs || selectedVsIds.has(vs.id))
    .flatMap((vs) => vs.arts.map((a) => ({ ...a, vsId: vs.id })));

  return (
    <fieldset className="border rounded p-4 space-y-4">
      <legend className="text-sm font-medium px-1">Visibility Scope</legend>

      {/* Value Stream level */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <input
            type="checkbox"
            checked={allVs}
            onChange={(e) => {
              setAllVs(e.target.checked);
              if (e.target.checked) {
                setSelectedVsIds(new Set());
                setSelectedArtIds(new Set());
              }
            }}
          />
          All Value Streams
        </label>
        {!allVs && (
          <div className="pl-4 space-y-1">
            {valueStreams.map((vs) => (
              <label key={vs.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedVsIds.has(vs.id)}
                  onChange={() => toggleVs(vs.id)}
                />
                {vs.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ART level */}
      {availableArts.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">ARTs</p>
          <div className="pl-4 space-y-1">
            {availableArts.map((art) => (
              <label key={art.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedArtIds.has(art.id)}
                  onChange={() => toggleArt(art.id, art.vsId)}
                />
                {art.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Hidden inputs for form submission */}
      <input type="hidden" name="valueStreamIds" value={[...selectedVsIds].join(",")} />
      <input type="hidden" name="artIds" value={[...selectedArtIds].join(",")} />
      <input type="hidden" name="teamIds" value="" />
    </fieldset>
  );
}
