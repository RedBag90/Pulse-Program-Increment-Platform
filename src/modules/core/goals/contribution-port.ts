/**
 * Goals-Contribution-/Scope-Resolver-Port — der Seam, über den **Goals (Core)**
 * auf Work-/Drumbeat-Entitäten zugreift, ohne aufwärts zu importieren
 * (ADR-0013 Inversion, ADR-0015). Heute lesen die Goal-Link-Services
 * (`goal-epic-link`, `goal-related-work`, `goal-scope-link`) die `initiative`-
 * Zeilen direkt per `level`; Ziel ist, dass die oberen Layer einen **Adapter**
 * für diesen Port stellen und Goals nur noch gegen das Interface arbeitet.
 *
 * Dieses File definiert nur den **Vertrag** (P2). Adapter (Work/Drumbeat) +
 * Verdrahtung folgen in P3+; bis dahin bleiben die bestehenden Services die
 * De-facto-Implementierung.
 */

/** Art des verknüpften Ziel-Beitrags-Objekts (Work-/Drumbeat-Entität). */
export type GoalScopeKind = "epic" | "feature" | "value_stream" | "art";

/** Referenz auf ein beitragendes Scope-Objekt eines oberen Layers. */
export interface GoalScopeRef {
  kind: GoalScopeKind;
  id: string;
}

/** Aufgelöste Anzeige-/Rollup-Daten eines Scope-Objekts — ohne dass Goals die
 *  Work-/Drumbeat-Tabellen kennt. */
export interface ResolvedGoalScope extends GoalScopeRef {
  /** Menschlicher Titel (für Baum/Related-Work-Anzeige). */
  label: string;
  /** Existiert das Objekt (noch) und ist es im Tenant sichtbar? */
  exists: boolean;
  /** Optionaler Fortschritts-/Beitragswert 0..1 (z. B. Epic-Delivery), falls der
   *  Layer einen liefert; `null` wenn nicht anwendbar. */
  contribution: number | null;
}

/**
 * Read-Port: löst eine Menge von Scope-Referenzen auf. Wird von einem
 * Work-/Drumbeat-Adapter erfüllt (die den `initiative`-Zugriff kapseln), damit
 * Goals selbst keine obere Schicht importiert.
 */
export interface GoalScopeResolver {
  resolve(refs: readonly GoalScopeRef[]): Promise<readonly ResolvedGoalScope[]>;
}

/**
 * Contribution-Port (Schreibrichtung, Inversion): obere Layer melden Beiträge
 * nach unten in Goals hinein, statt dass Goals ihre Links selbst gegen fremde
 * Tabellen schreibt. In P3+ läuft die eigentliche Zustellung über Domain-Events
 * (ADR-0015); dieses Interface hält den synchronen Vertrag für Adapter/Tests.
 */
export interface GoalContributionPort {
  register(goalId: string, ref: GoalScopeRef): Promise<void>;
  unregister(goalId: string, ref: GoalScopeRef): Promise<void>;
}
