import { describe, it, expect } from "vitest";
import { uid, uidFor } from "../seed-ids";

/**
 * **Die Zusage, an der der ganze Seed-Umbau haengt.**
 *
 * Die Seeds saeen seit Mai 2026 in dieselben Mandanten und sind idempotent,
 * weil ihre Ids aus dem Schluessel folgen: ein zweiter Lauf **ersetzt**. Ginge
 * beim Einziehen des Namensraums auch nur ein Id-Schema verloren, legte der
 * naechste `pnpm db:seed:demo` alles **doppelt** an — und zwar still, denn
 * scheitern wuerde er nicht.
 */
describe("uidFor", () => {
  it("der leere Namensraum ist uid selbst — kein Zeichen mehr, kein Trenner", () => {
    for (const key of [
      "vs:digital-banking",
      "art:accounts-onboarding",
      "large:tenant",
      "epic:0",
      "",
    ]) {
      expect(uidFor("")(key)).toBe(uid(key));
    }
  });

  it("ein Namensraum trennt zwei Mandanten", () => {
    const a = uidFor("tenant-a");
    const b = uidFor("tenant-b");
    expect(a("vs:0")).not.toBe(b("vs:0"));
    expect(a("vs:0")).not.toBe(uid("vs:0"));
  });

  it("derselbe Namensraum liefert dieselbe Id — sonst waere ein Reseed kein Reseed", () => {
    expect(uidFor("t")("epic:3")).toBe(uidFor("t")("epic:3"));
  });

  /**
   * Der Trenner `|` kommt in keinem Seed-Schluessel vor (die benutzen `:`).
   * Sonst koennte `uidFor("a")("b|c")` auf `uidFor("a|b")("c")` fallen.
   */
  it("Namensraum und Schluessel lassen sich nicht ineinander schieben", () => {
    expect(uidFor("a")("b|c")).not.toBe(uidFor("a|b")("c"));
  });

  it("liefert eine UUID der Version 4", () => {
    expect(uidFor("x")("y")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
