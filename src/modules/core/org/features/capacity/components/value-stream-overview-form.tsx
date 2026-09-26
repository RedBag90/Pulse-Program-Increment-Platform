"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/detail/user-picker";
import { userLabel } from "@/components/detail/initiative-labels";
import type { SearchSelectOption } from "@/components/ui/search-select";

export interface UserOption {
  userId: string;
  roles: string[];
}

/** UserOption[] → suchbare Optionen; Rollen werden als `hint` mitgesucht. */
function toUserOptions(
  users: UserOption[],
  userLabels: Record<string, string>,
): SearchSelectOption[] {
  return users.map((u) => ({
    value: u.userId,
    label: userLabel(u.userId, userLabels),
    ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
  }));
}

interface Props {
  id: string;
  name: string;
  description: string;
  financeApproverId: string;
  vmoId: string;
  businessOwnerId: string;
  architectLeadId: string;
  /** All tenant users — options for the Finance Approver picker. */
  users: UserOption[];
  /** Users holding the `portfolio_manager` role — options for the VS reviewer picker. */
  vmoUsers: UserOption[];
  userLabels: Record<string, string>;
}

/** Inline editor for a Value Stream's details — the Overview tab. */
export function ValueStreamOverviewForm({
  id,
  name,
  description,
  financeApproverId,
  vmoId,
  businessOwnerId,
  architectLeadId,
  users,
  vmoUsers,
  userLabels,
}: Props) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(updateValueStreamAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="id" value={id} />

      <div className="space-y-1.5">
        <Label htmlFor="vs-name">{t("org.ui.name")}</Label>
        <Input id="vs-name" name="name" defaultValue={name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vs-description">{t("org.ui.beschreibung")}</Label>
        <Textarea id="vs-description" name="description" defaultValue={description} rows={4} />
      </div>

      <div className="space-y-1.5">
        <Label>{t("org.ui.financeApprover")}</Label>
        <UserPicker
          name="financeApproverId"
          defaultValue={financeApproverId}
          options={toUserOptions(users, userLabels)}
          ariaLabel={t("org.ui.financeApprover")}
          placeholder={t("org.ui.niemand")}
          emptyLabel={t("org.ui.niemand")}
        />
        <p className="text-xs text-muted-foreground">{t("org.ui.nimmtDieEpicsDieses")}</p>
      </div>

      <div className="space-y-1.5">
        <Label>{t("org.ui.portfolioManager")}</Label>
        <UserPicker
          name="vmoId"
          defaultValue={vmoId}
          options={toUserOptions(vmoUsers, userLabels)}
          ariaLabel={t("org.ui.portfolioManager")}
          placeholder={t("org.ui.niemand")}
          emptyLabel={t("org.ui.niemand")}
        />
        {vmoUsers.length === 0 ? (
          <p className="text-xs text-warning">{t("org.ui.keineNutzerMitPortfolio")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("org.ui.zustaendigesValueManagementOffice")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t("org.ui.businessOwner")}</Label>
        <UserPicker
          name="businessOwnerId"
          defaultValue={businessOwnerId}
          options={toUserOptions(users, userLabels)}
          ariaLabel={t("org.ui.businessOwner")}
          placeholder={t("org.ui.niemand")}
          emptyLabel={t("org.ui.niemand")}
        />
        <p className="text-xs text-muted-foreground">{t("org.ui.stehtFuerDenFachlichen")}</p>
      </div>

      <div className="space-y-1.5">
        <Label>{t("org.ui.valueStreamArchitectLead")}</Label>
        <UserPicker
          name="architectLeadId"
          defaultValue={architectLeadId}
          options={toUserOptions(users, userLabels)}
          ariaLabel={t("org.ui.valueStreamArchitectLead")}
          placeholder={t("org.ui.niemand")}
          emptyLabel={t("org.ui.niemand")}
        />
        <p className="text-xs text-muted-foreground">{t("org.ui.architectLeadHinweis")}</p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-success">
          {t("org.ui.gespeichert")}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("org.ui.overviewSpeichert") : t("common.ui.aenderungenSpeichern")}
      </Button>
    </form>
  );
}
