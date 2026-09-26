"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateArtAction } from "@/modules/core/org/features/art/actions/art";
import { userLabel } from "@/components/detail/initiative-labels";
import { UserPicker } from "@/components/detail/user-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface UserOption {
  userId: string;
  roles: string[];
}

interface Props {
  id: string;
  name: string;
  description: string;
  rteId: string;
  technicalLeadId: string;
  /** Users holding the `rte` role — options for the RTE picker. */
  rteUsers: UserOption[];
  /**
   * Alle Nutzer des Mandanten — Auswahl für den Technical Lead. Es gibt keine
   * passende App-Rolle, nach der man filtern könnte, und niemand soll eine
   * bekommen müssen, nur um benannt werden zu können.
   */
  users: UserOption[];
  userLabels: Record<string, string>;
}

/** Inline editor for an ART's details — the Overview tab. */
export function ArtOverviewForm({
  id,
  name,
  description,
  rteId,
  technicalLeadId,
  rteUsers,
  users,
  userLabels,
}: Props) {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(updateArtAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="id" value={id} />

      <div className="space-y-1.5">
        <Label htmlFor="art-name">{t("org.ui.name")}</Label>
        <Input id="art-name" name="name" defaultValue={name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="art-description">{t("org.ui.beschreibung")}</Label>
        <Textarea id="art-description" name="description" defaultValue={description} rows={4} />
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label>{t("org.ui.rteReleaseTrainEngineer")}</Label>
        <UserPicker
          name="rteId"
          defaultValue={rteId}
          options={rteUsers.map((u) => ({
            value: u.userId,
            label: userLabel(u.userId, userLabels),
            ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
          }))}
          ariaLabel={t("org.ui.rteReleaseTrainEngineer")}
          placeholder={t("org.ui.niemand")}
          emptyLabel={t("org.ui.niemand")}
        />
        {rteUsers.length === 0 && (
          <p className="text-xs text-warning">{t("org.ui.keineNutzerMitRte")}</p>
        )}
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label>{t("org.ui.artTechnicalLead")}</Label>
        <UserPicker
          name="technicalLeadId"
          defaultValue={technicalLeadId}
          options={users.map((u) => ({
            value: u.userId,
            label: userLabel(u.userId, userLabels),
            ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
          }))}
          ariaLabel={t("org.ui.artTechnicalLead")}
          placeholder={t("org.ui.niemand")}
          emptyLabel={t("org.ui.niemand")}
        />
        <p className="text-xs text-muted-foreground">
          {t("org.ui.technischVerantwortlicheRDieses")}
        </p>
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
