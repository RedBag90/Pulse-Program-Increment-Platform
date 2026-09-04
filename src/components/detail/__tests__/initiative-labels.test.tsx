import { describe, it, expect } from "vitest";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";

describe("Major-Gate-Labels", () => {
  it("lässt L4 das Major-Gate bleiben — es umfasst L4.1 und L4.2", () => {
    // Die Gegenprobe zu `GATE_STEP_LABELS.L4` im Work-Modul: dort heißt der
    // Schritt L4.1, hier bleibt das Gate L4. Wer beide gleich benennt, macht
    // die Trichter-Leiste falsch.
    expect(STAGE_GATE_LABELS.L4).toBe("L4 Implementierung");
  });
});
