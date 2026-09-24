import type { Translate } from "@/i18n/translate";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { Page, PageHeader } from "@/components/layout";
import { Stat, StatStrip } from "@/components/ui/stat";
import { getStructureTree } from "@/modules/core/org/server/services/structure";
import { canOpenValueStream, canOpenArt } from "@/modules/core/org/domain/structure-access";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { userLabel } from "@/components/detail/initiative-labels";
import {
  buildRoleDirectory,
  directoryStats,
  targetKey,
  type DutyKey,
  type GateDuties,
} from "@/modules/core/org/domain/role-directory";
import {
  RoleDirectoryView,
  type DirectoryUserOption,
} from "@/modules/core/org/features/structure/components/role-directory-view";
import { listGateApproverRules } from "@/modules/work/server/services/stage-gate-transition";
import { resolveGatePolicy, type GateApproverRole } from "@/modules/work/domain/gate-policy";
import { GATE_STEPS, gateStepNumberKey } from "@/modules/work/domain/stage-gate";

/**
 * **Die Rollenverteilung** — wer ist in diesem Mandanten wofür benannt, und wer
 * darf das ändern.
 *
 * Es geht **nicht** um App-Rollen. Eine Rolle sagt, was jemand darf; eine
 * Benennung sagt, wen man fragt. Niemand muss eine Rolle tragen, um benannt zu
 * werden — die Personenfelder an Wertstrom, ART und Solution sind frei.
 *
 * Die Fläche steht neben dem Struktur-Baum statt darin: sie ist kein Knoten,
 * sondern eine Sicht über alle. Und sie steht hier statt im Wiki, weil sie
 * **schreibt** — das Wiki ist I/O-frei und ungegattert.
 *
 * Kompositionswurzel über zwei Module (ADR-0013): die Struktur samt ihren
 * Benennungen kommt aus **Core**, die Frage „woran zeichnet diese Rolle" aus
 * der Gate-Policy in **Work**. `buildRoleDirectory` selbst bleibt rein und
 * bekommt die Tor-Karte als einfache Daten.
 */

/** Welcher Gate-Platzhalter zu welcher Zuständigkeit gehört. */
const ROLE_TO_DUTY: Partial<Record<GateApproverRole, DutyKey>> = {
  "value_stream.finance_approver": "vs.finance",
  "epic.party.finance": "vs.finance",
  "value_stream.vmo": "vs.portfolio",
  "epic.party.lace_vmo": "vs.portfolio",
  "value_stream.business_owner": "vs.business",
  "epic.party.business_owner": "vs.business",
  "value_stream.architect_lead": "vs.architecture",
  "epic.party.architect": "vs.architecture",
  "solution.product_manager": "solution.product",
};

/**
 * Woran eine Zuständigkeit in **diesem** Wertstrom zeichnet — aus seiner
 * tatsächlichen Konfiguration, nicht aus dem Code-Default. Trägt jemand den
 * Architect Lead unter „Freigaben je Reifegrad" an ein Tor, erscheint es hier
 * von selbst.
 */
function gateDutiesOf(
  valueStreamIds: readonly string[],
  rules: Awaited<ReturnType<typeof listGateApproverRules>>,
  /** Die Marken sind Anzeigetext — reine Funktion, also hereingereicht. */
  t: Translate,
): GateDuties {
  const out: GateDuties = {};
  for (const vsId of valueStreamIds) {
    const perDuty: Partial<Record<DutyKey, string[]>> = {};
    for (const gate of GATE_STEPS) {
      const policy = resolveGatePolicy(gate, rules, vsId);
      if (!policy.required) continue;
      for (const role of policy.approverRoles) {
        const duty = ROLE_TO_DUTY[role];
        if (!duty) continue;
        const list = (perDuty[duty] ??= []);
        // `GateDuties` traegt reine Anzeigetexte — der rohe Schluessel stand
        // hier bis September 2026 buchstaeblich in der Zeile („L1 analysis L2
        // L3"), ein englisches Wort in einer deutschen Oberflaeche.
        const mark = t(gateStepNumberKey(gate));
        // Der Wertstrom-Platzhalter und die gleichnamige Epic-Partei treffen
        // dieselbe Person — das Tor soll trotzdem nur einmal dastehen.
        if (!list.includes(mark)) list.push(mark);
      }
    }
    out[vsId] = perDuty;
  }
  return out;
}

export default async function RollenPage() {
  const t = await getTranslations();
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [tree, userLabels, approvers, rules] = await Promise.all([
    getStructureTree(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    listTenantApprovers(db, principal.tenantId),
    listGateApproverRules(db, principal.tenantId),
  ]);

  const streams = buildRoleDirectory(
    tree,
    (id) => userLabel(id, userLabels),
    gateDutiesOf(
      tree.map((vs) => vs.id),
      rules,
      t,
    ),
  );

  const users: DirectoryUserOption[] = approvers.map((u) => ({
    value: u.userId,
    label: userLabel(u.userId, userLabels),
    ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
  }));

  /**
   * **Je Objekt geprüft, nicht einmal global.** Lässt man `valueStreamId` im
   * Ressourcen-Objekt weg, ist der `value_stream`-Scope *vakuös* erfüllt — ein
   * eingegrenzter Nutzer sähe dann überall einen Bearbeiten-Knopf und liefe erst
   * beim Speichern in die Ablehnung. Die Durchsetzung bleibt ohnehin am Service;
   * das hier entscheidet nur, ob ein Platz anfassbar **aussieht**.
   */
  const editable = new Set<string>();
  for (const vs of tree) {
    const artIds = vs.arts.map((a) => a.id);
    const inScope = canOpenValueStream(principal.scopes, { id: vs.id, artIds });
    if (
      inScope &&
      hasCapability(principal, "value_stream.update", {
        tenantId: principal.tenantId,
        valueStreamId: vs.id,
      })
    ) {
      editable.add(targetKey("valueStream", vs.id));
    }
    for (const art of vs.arts) {
      if (
        canOpenArt(principal.scopes, { id: art.id, valueStreamId: vs.id }) &&
        hasCapability(principal, "art.update", {
          tenantId: principal.tenantId,
          valueStreamId: vs.id,
          artId: art.id,
        })
      ) {
        editable.add(targetKey("art", art.id));
      }
    }
    for (const sol of vs.solutions) {
      // Der benannte Produkt-Manager darf sein Produkt pflegen, auch ohne die
      // Capability — derselbe Seam, den `updateSolution` serverseitig kennt.
      const mine = sol.productManagerId === principal.id;
      if (
        inScope &&
        (mine || hasCapability(principal, "solution.manage", { tenantId: principal.tenantId }))
      ) {
        editable.add(targetKey("solution", sol.id));
      }
    }
  }

  const canEditAnything = editable.size > 0;
  const stats = directoryStats(streams);

  return (
    <Page>
      <PageHeader
        eyebrow={t("org.page.struktur")}
        title={t("org.page.rollenverteilung")}
        subtitle={canEditAnything ? t("org.page.rolesSubtitleEdit") : t("org.page.rolesSubtitle")}
      />

      {/*
        „Personen" zählt **Köpfe, nicht Posten**. Das ist die Aussage: in einem
        gewachsenen Portfolio tragen auffallend wenige Menschen auffallend viele
        Zuständigkeiten. Wer die besetzten Plätze zählte, bekäme eine beruhigend
        große Zahl und übersähe genau das.
      */}
      <StatStrip>
        <Stat label={t("org.page.personenBenannt")} value={stats.people} />
        <Stat
          label={t("org.page.plaetzeOffen")}
          value={stats.unfilled}
          {...(stats.unfilled > 0 && {
            valueClassName: "text-warning",
          })}
        />
        <Stat label={t("org.page.wertstroeme")} value={stats.streams} />
      </StatStrip>

      <p className="max-w-[var(--reading-max-w)] text-sm text-muted-foreground">
        {t("org.page.dasSind")}{" "}
        <strong className="font-medium text-foreground">{t("org.page.benennungen")}</strong>, keine
        App-Rollen: eine Rolle sagt, was jemand darf, eine Benennung sagt, wen man fragt. Niemand
        muss eine Rolle tragen, um benannt zu werden. Auf Portfolio-Ebene steht niemand — über dem
        Wertstrom gibt es in Pulse keine namentliche Benennung.
      </p>

      <RoleDirectoryView streams={streams} users={users} editable={editable} />
    </Page>
  );
}
