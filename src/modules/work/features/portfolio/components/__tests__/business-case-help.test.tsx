import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// `@/i18n/navigation` zieht next-intl nach, das unter vitest nicht auflöst —
// für diese Tests genügt ein einfacher Anker.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

import { BusinessCaseEditor } from "@/modules/work/features/portfolio/components/business-case-editor";
import {
  BUSINESS_CASE_FIELD_HELP,
  type HelpedBusinessCaseField,
} from "@/modules/work/features/portfolio/components/business-case-help";

/**
 * **Der Lean Business Case sagt, wonach er fragt.**
 *
 * Neun Freitextfelder trugen SAFe-Vokabular als Beschriftung und sonst nichts —
 * „What you need to believe in" sagt einem Erstautor nicht, was hineingehört.
 */
const felder: { id: string; field: HelpedBusinessCaseField }[] = [
  { id: "bc-stakeholders", field: "keyStakeholders" },
  { id: "bc-description", field: "initiativeDescription" },
  { id: "bc-outcome", field: "businessOutcomeHypothesis" },
  { id: "bc-inscope", field: "inScope" },
  { id: "bc-outscope", field: "outOfScope" },
  { id: "bc-believe", field: "whatYouNeedToBelieve" },
  { id: "bc-customers", field: "customersAffected" },
  { id: "bc-impact", field: "impactOnSolutions" },
  { id: "bc-summary", field: "analysisSummary" },
];

function renderEditor(readOnly = false) {
  return render(<BusinessCaseEditor epicId="e1" current={{}} history={[]} readOnly={readOnly} />);
}

describe("Hilfetexte im Lean Business Case", () => {
  it("der Katalog deckt genau die neun ausfüllbaren Felder ab", () => {
    // `leadingIndicators` ist ausgenommen — es zeigt die KPI-Namen und wird
    // nicht getippt. Der Typ leitet die übrigen aus der Domäne ab; dieser Test
    // haelt zusätzlich fest, dass die Formularfelder dieselbe Menge sind.
    expect(Object.keys(BUSINESS_CASE_FIELD_HELP).sort()).toEqual(felder.map((f) => f.field).sort());
  });

  it("jedes Feld trägt seinen Platzhalter", () => {
    const { container } = renderEditor();
    for (const { id, field } of felder) {
      const el = container.querySelector(`#${id}`);
      expect(el, `Feld ${id} fehlt`).not.toBeNull();
      expect(el!.getAttribute("placeholder"), `Platzhalter an ${id}`).toBe(
        BUSINESS_CASE_FIELD_HELP[field].placeholder,
      );
    }
  });

  it("neben jeder Beschriftung steht ein ⓘ", () => {
    renderEditor();
    expect(screen.getAllByLabelText("Erklärung")).toHaveLength(felder.length);
  });

  it("kein Text ist leer — ein ⓘ ohne Frage wäre schlimmer als keines", () => {
    for (const [field, help] of Object.entries(BUSINESS_CASE_FIELD_HELP)) {
      expect(help.question.trim().length, `${field}: Frage`).toBeGreaterThan(10);
      expect(help.placeholder.trim().length, `${field}: Platzhalter`).toBeGreaterThan(10);
    }
  });

  /**
   * Der Fall, an dem ein `<button>` stillschweigend versagt hätte: die Felder
   * stehen in `<fieldset disabled>`, und ein Button darin ist nach HTML-Spec
   * deaktiviert. Ausgerechnet der Abnehmer, der prüft, saehe dann keine Frage
   * mehr.
   */
  it("in der Nur-Lese-Ansicht bleiben die ⓘ bedienbar", () => {
    const { container } = renderEditor(true);
    // Das Feld erbt seinen gesperrten Zustand vom `fieldset` — die Eigenschaft
    // `disabled` am Element selbst bleibt dabei `false`, sie spiegelt nur das
    // eigene Attribut. Gemeint ist die Vererbung, also wird sie geprüft.
    const feld = container.querySelector("#bc-inscope");
    expect(feld).not.toBeNull();
    expect(feld!.closest("fieldset")?.hasAttribute("disabled")).toBe(true);

    const hints = screen.getAllByLabelText("Erklärung");
    expect(hints).toHaveLength(felder.length);
    for (const hint of hints) {
      // Kein Formularelement ⇒ vom deaktivierten fieldset nicht betroffen.
      expect(hint.tagName).toBe("SPAN");
      expect(hint.hasAttribute("disabled")).toBe(false);
      expect(hint.getAttribute("tabindex")).toBe("0");
    }
  });
});
