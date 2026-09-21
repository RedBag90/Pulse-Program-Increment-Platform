import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectionCard } from "@/components/ui/section-card";

/**
 * **`atGate` ist additiv — ohne die Prop ändert sich nichts.**
 *
 * `SectionCard` trägt 28 Routen. Die Prop kam für eine einzige Fläche dazu (die
 * Epic-Overview bei L0); dieser Test ist die Zusicherung an alle übrigen, dass
 * sie davon nichts merken.
 *
 * Ring **und** Akzentschiene gehören zusammen: die Schiene allein sagt in diesem
 * Haus „Arbeitsfläche" (`work`/`step`), und der Ring allein wäre in einer Reihe
 * gleich aussehender Karten zu leise.
 */
const ring = (c: HTMLElement) => c.querySelector("h2 span[aria-hidden]");
const schiene = (c: HTMLElement) => c.querySelector(".border-l-primary");

describe("SectionCard — atGate", () => {
  it("setzt Ring und Akzentschiene", () => {
    const { container } = render(
      <SectionCard title="Einordnung" atGate>
        <p>Inhalt</p>
      </SectionCard>,
    );

    expect(ring(container)).not.toBeNull();
    expect(schiene(container)).not.toBeNull();
  });

  it("lässt eine Karte ohne die Prop unverändert", () => {
    const { container } = render(
      <SectionCard title="Governance">
        <p>Inhalt</p>
      </SectionCard>,
    );

    expect(ring(container)).toBeNull();
    expect(schiene(container)).toBeNull();
  });

  it("lässt die Arbeitsfläche ihre Schiene — ohne Ring", () => {
    // `work` und `atGate` teilen sich die Schiene. Das geht nur gut, solange
    // sie sich nicht auf einer Fläche begegnen; der Ring ist das, was sie heute
    // unterscheidet.
    const { container } = render(
      <SectionCard title="Verteilen" work>
        <p>Inhalt</p>
      </SectionCard>,
    );

    expect(schiene(container)).not.toBeNull();
    expect(ring(container)).toBeNull();
  });
});
