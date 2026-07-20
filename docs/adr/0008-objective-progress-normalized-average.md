# ADR-0008: Objective-Fortschritt ist der normalisierte Ø der Key Results; €-Trio bleibt separate Geld-Sicht

Status: Accepted
Date: 2026-07-20

## Context

Die Asana-Adaption (Backlog, Epic 2) macht den Fortschritt eines Objectives
(„Theme" in der UI) zu einer echten, aus den Key Results aggregierten Metrik.
Heute leitet die UI den Theme-Fortschritt gemischt aus dem €-Rollup-Trio
(`goals-rollup.ts`, `RollupTrio` planned/realized/runRate) ab.

Mit Epic 1 tragen Key Results künftig unterschiedliche Metrik-Einheiten
(Zahl, Prozent, Währung). Damit stellt sich die Frage: Wie aggregiert ein
Objective den Fortschritt über KRs **unterschiedlicher Einheiten** (z. B. ein
%-KR + ein €-KR + ein Zahl-KR)?

Asana-Regel (Recherche): Bei Sub-Goals als Quelle wird Prozent als Durchschnitt,
Zahl/Währung als Summe aggregiert. Eine reine Summe über gemischte Einheiten ist
jedoch undefiniert (man kann € nicht zu % addieren).

## Decision

**Objective-Completion = (gewichteter) Durchschnitt der KR-Fortschritte in 0..1,
einheiten-unabhängig. Das Objective trägt keinen aggregierten Rohwert.**

- Jeder KR hat einen normalisierten Fortschritt `0..1`
  (`normalizeKrValue(current, baseline, target)`).
- Objective-Completion = Durchschnitt dieser Werte; mit Gewichten (Epic 3)
  `Σ(weight_i · progress_i) / Σ weight_i`. Gleiche Gewichte ⇒ arithmetischer Ø.
- Das Objective hat **keinen** Rohwert-/Summen-Wert; „Current value" am
  Objective zeigt nur Completion-%. Rohwert-Summen bleiben auf KR-Ebene.
- Kein Cross-Currency-Summieren (D3). Ein Objective-Euro-Wert entsteht nur, falls
  ein späterer Zusatz explizit alle KRs derselben Währung voraussetzt — nicht
  Teil dieser Entscheidung.
- Die Aggregation lebt als eine Domänen-Funktion (`rollupObjectiveProgress`) und
  wird von `ziele-view.ts` **und** `portfolio-overview.ts` genutzt, damit Liste,
  Detail und Portfolio-Dashboards denselben Wert zeigen.

**Das €-Trio bleibt bestehen** als eigenständige **Geld-Sicht** (Money-Sheet,
Budget-Rollups) und wird nicht durch den Fortschritts-Rollup ersetzt. Die zwei
Begriffe werden im Code klar getrennt benannt.

## Consequences

- **Breaking für Konsumenten des Fortschritts**: `loadStrategyTree` speist auch
  `portfolio-overview.ts` (Dashboards/Reporting). Der neue Fortschrittsbegriff
  wirkt dort. Regressions-Check vor Merge: `/portfolio` (alle Views),
  Money-Sheet (€-Trio unverändert), `strategy-table-view`, `okr-board-view`.
- Immer definiert — auch bei gemischten Einheiten oder fehlenden Baselines
  (KR ohne Baseline/Target trägt Fortschritt 0 bzw. wird ausgeklammert, siehe
  `normalizeKrValue`).
- Zwei parallele Aggregate (Fortschritt vs. €-Trio) erhöhen die
  Begriffslast — deshalb die explizite Trennung als Teil dieser ADR.
- Verworfen: einheiten-gruppierte Summen (kein einheitlicher Objective-Wert,
  höhere Komplexität ohne klaren Nutzen).
