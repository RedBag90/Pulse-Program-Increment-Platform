"use client";

import { useTranslations } from "next-intl";
import { useActionState, startTransition, useState } from "react";
import type { GoalFieldsPageModel } from "@/modules/core/goals/server/views/admin-goal-fields";
import {
  createCustomFieldDefAction,
  deleteCustomFieldDefAction,
} from "@/features/admin/actions/goal-custom-field";

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Zahl",
  select: "Auswahl",
};

/**
 * Admin-Verwaltung der Goal-Custom-Fields (Epic 7): Liste + Anlegen + Löschen.
 * Werte pro Ziel werden im Ziele-Drawer gepflegt.
 */
export function GoalFieldsPageShell({ model }: { model: GoalFieldsPageModel }) {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("admin.ui.customFields")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("admin.ui.tenantWeiteZusatzfelderFuer")}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("admin.ui.definierteFelder")}
        </h2>
        {model.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
            {t("admin.ui.nochKeineCustomFields")}
          </p>
        ) : (
          <ul className="divide-y rounded-lg bg-card shadow-card">
            {model.fields.map((f) => (
              <FieldRow key={f.id} id={f.id} name={f.name} type={f.type} options={f.options} />
            ))}
          </ul>
        )}
      </section>

      {model.canManage && <AddFieldForm />}
    </div>
  );
}

function FieldRow({
  id,
  name,
  type,
  options,
}: {
  id: string;
  name: string;
  type: string;
  options: string[];
}) {
  const t = useTranslations();
  const [state, run, pending] = useActionState(deleteCustomFieldDefAction, {});

  function remove() {
    if (!confirm(`Feld „${name}" löschen? Werte an allen Zielen werden mitentfernt.`)) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => run(fd));
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-meta text-muted-foreground">
          {TYPE_LABELS[type] ?? type}
          {type === "select" && options.length > 0 && ` · ${options.join(", ")}`}
        </p>
      </div>
      {state.error && <span className="text-meta text-destructive">{state.error}</span>}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md border px-2 py-1 text-meta font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        {t("admin.ui.loeschen")}
      </button>
    </li>
  );
}

function AddFieldForm() {
  const t = useTranslations();
  const [state, run, pending] = useActionState(createCustomFieldDefAction, {});
  const [type, setType] = useState("text");

  function submit(fd: FormData) {
    startTransition(() => run(fd));
  }

  return (
    <form
      action={submit}
      className="space-y-3 rounded-lg border border-dashed bg-muted/10 p-4"
      key={state.success ? "reset" : "form"}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("admin.ui.neuesFeld")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-meta font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {t("admin.ui.name")}
          </span>
          <input
            name="name"
            required
            maxLength={100}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("admin.ui.zBRisiko")}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-meta font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {t("admin.ui.typ")}
          </span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="text">{t("admin.ui.text")}</option>
            <option value="number">{t("admin.ui.zahl")}</option>
            <option value="select">{t("admin.ui.auswahl")}</option>
          </select>
        </label>
      </div>
      {type === "select" && (
        <label className="block space-y-1">
          <span className="text-meta font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {t("admin.ui.optionenEineProZeile")}
          </span>
          <textarea
            name="options"
            rows={3}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("admin.ui.hochNmittelNniedrig")}
          />
        </label>
      )}
      <div className="flex items-center justify-between">
        {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("admin.ui.feldAnlegen")}
        </button>
      </div>
    </form>
  );
}
