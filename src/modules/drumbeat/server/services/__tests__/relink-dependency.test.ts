import { describe, it, expect } from "vitest";
import { detectCycle } from "@/modules/core/kernel/domain/dependency-graph";

/**
 * **Umhängen ist Löschen + Neuanlegen — in einer Transaktion.**
 *
 * `relinkDependency` selbst braucht die Datenbank; sein Verhalten steht im
 * Integrationslauf, und der läuft in diesem Projekt nirgends (siehe die offene
 * Liste). Was sich hier **rein** prüfen lässt, ist die Aussage, an der die
 * Geste im Browser hängt und die beim Bauen zweimal falsch war:
 *
 * Die Vorprüfung im Netzplan darf die Kante, die gerade gezogen wird, **nicht**
 * mitzählen — sonst meldet sie einen Zyklus gegen sich selbst und die Geste
 * scheitert immer.
 */
describe("die Zyklus-Vorprüfung beim Umhängen", () => {
  const kanten = [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "c" },
  ];

  it("meldet einen Zyklus gegen sich selbst, wenn die eigene Kante mitzählt", () => {
    // Genau die Falle: `a → b` soll zu `c → a` werden. Zählt `e1` mit, führt
    // der Weg a → b → c zurück auf a, und die Geste wäre nie möglich.
    const alleKanten = kanten.map((e) => ({ fromId: e.source, toId: e.target }));
    expect(detectCycle("c", "a", alleKanten)).toBe(true);
  });

  it("lässt sie zu, sobald die eigene Kante ausgeschlossen ist", () => {
    const ohneSichSelbst = kanten
      .filter((e) => e.id !== "e1")
      .map((e) => ({ fromId: e.source, toId: e.target }));
    expect(detectCycle("c", "a", ohneSichSelbst)).toBe(false);
  });

  it("findet einen echten Zyklus trotzdem", () => {
    // Der Ausschluss darf nicht alles durchwinken: `c → a` bei bestehendem
    // `a → c` bleibt ein Zyklus, auch ohne `e1`.
    const mitRueckweg = [
      { fromId: "a", toId: "c" },
      { fromId: "b", toId: "c" },
    ];
    expect(detectCycle("c", "a", mitRueckweg)).toBe(true);
  });

  it("hält einen Selbstbezug auf", () => {
    expect(detectCycle("a", "a", [])).toBe(true);
  });
});
