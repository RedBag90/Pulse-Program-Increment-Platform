"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";
import {
  GATE_APPROVER_ROLES,
  GATE_APPROVER_ROLE_LABELS,
  resolveGatePolicy,
  type GateApproverRole,
  type GateApproverRuleRow,
  type GatePolicy,
} from "@/modules/work/domain/gate-policy";
import { type Quorum } from "@/modules/work/domain/approval-primitives";
import { saveGateApproverRuleAction } from "@/modules/work/features/portfolio/actions/stage-gate";
import {
  MultiUserSelect,
  type TenantApprover,
} from "@/modules/work/features/portfolio/components/approver-picker";
import { STAGE_GATE_LABELS, userLabel } from "@/components/detail/initiative-labels";
import { SectionLabel } from "@/components/ui/section-label";

// L0 ist der Funnel-Start — dorthin führt kein Vorwärts-Antrag, also keine
// Freigabe-Regel. Konfiguriert werden die fünf Übergänge L1..L5.
// Je Schritt, nicht je Haupt-Gate: L3.2 und L4.2 werden eigens abgenommen und
// brauchen deshalb auch eine eigene Regel-Zeile. L0 hat keinen Vorwärts-Antrag.
const GATES: GateStep[] = GATE_STEPS.filter((g) => g !== "L0");

const SOURCE_LABELS: Record<GatePolicy["source"], string> = {
  value_stream: "Wertstrom-Regel",
  tenant: "Tenant-Default",
  code_default: "Standard",
};

interface Draft {
  required: boolean;
  quorum: Quorum;
  userIds: Set<string>;
  roles: Set<GateApproverRole>;
}

interface Props {
  valueStreamId: string;
  /** Tenant-Default- + Wertstrom-Regeln (aus `listGateApproverRules`). */
  rules: GateApproverRuleRow[];
  /** Governance-Felder des Wertstroms — lösen die Rollen-Platzhalter zu Personen auf. */
  vmoId: string | null;
  financeApproverId: string | null;
  approvers: TenantApprover[];
  userLabels: Record<string, string>;
  canConfigure: boolean;
}

/**
 * Wertstrom-Setup: **wer** jeden Reifegrad-Übergang (L1..L5) freigibt. Zeigt je
 * Gate die wirksame Regel read-only an; ein „Bearbeiten"-Toggle öffnet den
 * vollen Editor (Pflicht / Quorum / Rollen-Platzhalter / benannte Personen) und
 * speichert je geänderter Zeile über `saveGateApproverRuleAction`.
 *
 * Baut auf dem vorhandenen Backend auf (ADR-0018): die Auflösung selbst passiert
 * serverseitig beim Antrag; diese Komponente ist reine Konfig-UI.
 */
export function GateApproverRulesSection({
  valueStreamId,
  rules,
  vmoId,
  financeApproverId,
  approvers,
  userLabels,
  canConfigure,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // Wirksame Regel je Gate (Wertstrom → Tenant → Code-Default). Eine Quelle für
  // die Read-only-Anzeige, das Prefill des Editors und die Dirty-Prüfung.
  const baselines = useMemo(() => {
    const m: Record<string, GatePolicy> = {};
    for (const g of GATES) m[g] = resolveGatePolicy(g, rules, valueStreamId);
    return m;
  }, [rules, valueStreamId]);

  function beginEdit() {
    const next: Record<string, Draft> = {};
    for (const g of GATES) {
      const b = baselines[g]!;
      next[g] = {
        required: b.required,
        quorum: b.quorum,
        userIds: new Set(b.approverUserIds),
        roles: new Set(b.approverRoles),
      };
    }
    setDrafts(next);
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDrafts({});
    setError(null);
  }

  function patch(gate: string, change: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [gate]: { ...prev[gate]!, ...change } }));
  }

  function toggleRole(gate: string, role: GateApproverRole) {
    setDrafts((prev) => {
      const roles = new Set(prev[gate]!.roles);
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return { ...prev, [gate]: { ...prev[gate]!, roles } };
    });
  }

  function toggleUser(gate: string, userId: string) {
    setDrafts((prev) => {
      const userIds = new Set(prev[gate]!.userIds);
      if (userIds.has(userId)) userIds.delete(userId);
      else userIds.add(userId);
      return { ...prev, [gate]: { ...prev[gate]!, userIds } };
    });
  }

  /** Weicht der Entwurf einer Zeile von der wirksamen Regel ab? Nur dann speichern. */
  function isDirty(gate: string): boolean {
    const b = baselines[gate]!;
    const d = drafts[gate]!;
    return (
      d.required !== b.required ||
      d.quorum !== b.quorum ||
      !sameSet(d.userIds, b.approverUserIds) ||
      !sameSet(d.roles, b.approverRoles)
    );
  }

  function buildFd(gate: string, d: Draft): FormData {
    const fd = new FormData();
    fd.set("valueStreamId", valueStreamId);
    fd.set("toGate", gate);
    // `z.coerce.boolean()`: jeder nichtleere String ⇒ true; fehlend ⇒ false.
    if (d.required) fd.set("required", "1");
    fd.set("quorum", d.quorum);
    for (const id of d.userIds) fd.append("approverUserIds", id);
    for (const r of d.roles) fd.append("approverRoles", r);
    return fd;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const changed = GATES.filter(isDirty);
      for (const g of changed) {
        const res = await saveGateApproverRuleAction({}, buildFd(g, drafts[g]!));
        if (res.error) {
          setError(`${STAGE_GATE_LABELS[g]}: ${res.error}`);
          return;
        }
      }
      setEditing(false);
      setDrafts({});
      setSaved(true);
      // Neue Regeln vom Server nachladen, damit die Read-only-Anzeige stimmt.
      router.refresh();
    });
  }

  /** Personen-Label eines Rollen-Platzhalters (VMO/Finance → konkret, Epic-Owner → je Epic). */
  function rolePersonHint(role: GateApproverRole): string {
    switch (role) {
      case "value_stream.vmo":
        return vmoId ? userLabel(vmoId, userLabels) : "kein VMO hinterlegt";
      case "value_stream.finance_approver":
        return financeApproverId
          ? userLabel(financeApproverId, userLabels)
          : "kein Finance-Approver hinterlegt";
      case "epic.owner":
        return "je Epic";
      // Die Business-Case-Parteien: zwei ziehen die Wertstrom-Governance, die
      // anderen drei werden am Antrag je Epic benannt.
      case "epic.party.lace_vmo":
        return vmoId ? userLabel(vmoId, userLabels) : "kein VMO hinterlegt";
      case "epic.party.finance":
        return financeApproverId
          ? userLabel(financeApproverId, userLabels)
          : "kein Finance-Approver hinterlegt";
      case "epic.party.mgmt":
      case "epic.party.business_owner":
      case "epic.party.irt_owner":
        return "je Epic am Antrag";
      // Hängt an der Primär-Solution des Epics, nicht am Wertstrom — und an L4
      // nur bei ART-Epics.
      case "solution.product_manager":
        return "je Solution des Epics";
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Freigaben je Reifegrad</h2>
          <p className="text-xs text-muted-foreground">
            Wer nimmt jeden Reifegrad-Übergang (L1–L5) in diesem Wertstrom ab. Rollen-Platzhalter
            (VMO, Finance) treffen beim Antrag automatisch die hinterlegte Person.
          </p>
        </div>
        {canConfigure && !editing && (
          <button
            type="button"
            onClick={beginEdit}
            className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
            Bearbeiten
          </button>
        )}
      </div>

      {saved && !editing && (
        <p role="status" className="text-xs text-emerald-600">
          Freigabe-Regeln gespeichert.
        </p>
      )}

      <ul className="space-y-2">
        {GATES.map((gate) => {
          const b = baselines[gate]!;
          const d = editing ? drafts[gate]! : null;
          const required = d ? d.required : b.required;
          return (
            <li key={gate} className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{STAGE_GATE_LABELS[gate] ?? gate}</span>
                {!editing && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {SOURCE_LABELS[b.source]}
                  </span>
                )}
              </div>

              {/* ---------- Read-only ---------- */}
              {!d && (
                <div className="mt-1.5 text-xs">
                  {!b.required ? (
                    <span className="text-muted-foreground">Keine Abnahme erforderlich.</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {b.approverRoles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary"
                        >
                          {GATE_APPROVER_ROLE_LABELS[role]}
                          <span className="text-primary/60">· {rolePersonHint(role)}</span>
                        </span>
                      ))}
                      {b.approverUserIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5"
                        >
                          {userLabel(id, userLabels)}
                        </span>
                      ))}
                      {b.approverRoles.length === 0 && b.approverUserIds.length === 0 && (
                        <span className="text-amber-700">
                          Erforderlich, aber niemand hinterlegt.
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        · {b.quorum === "all" ? "alle müssen zustimmen" : "eine Zustimmung genügt"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ---------- Edit ---------- */}
              {d && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={d.required}
                      onChange={(e) => patch(gate, { required: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    Abnahme erforderlich
                  </label>

                  {required && (
                    <>
                      <div className="flex items-center gap-2">
                        <SectionLabel>Quorum</SectionLabel>
                        <select
                          value={d.quorum}
                          onChange={(e) => patch(gate, { quorum: e.target.value as Quorum })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="all">alle müssen zustimmen</option>
                          <option value="any">eine Zustimmung genügt</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <SectionLabel>Rollen-Platzhalter</SectionLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {GATE_APPROVER_ROLES.map((role) => {
                            const active = d.roles.has(role);
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(gate, role)}
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                  active
                                    ? "bg-primary text-primary-foreground"
                                    : "border bg-background hover:bg-muted"
                                }`}
                                title={rolePersonHint(role)}
                              >
                                {GATE_APPROVER_ROLE_LABELS[role]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <SectionLabel>Benannte Personen</SectionLabel>
                        <MultiUserSelect
                          options={approvers}
                          selected={d.userIds}
                          onToggle={(userId) => toggleUser(gate, userId)}
                          userLabels={userLabels}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing && (
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "Speichern…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Set-Gleichheit gegen eine Werteliste (Reihenfolge-unabhängig). */
function sameSet(a: Set<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false;
  for (const v of b) if (!a.has(v)) return false;
  return true;
}
