"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { setFeatureParentAction } from "@/modules/work/features/feature/actions/feature";

/**
 * **Ein Feature einem Epic zuordnen oder daraus lösen.**
 *
 * Bis hierhin war die Zuordnung beim Anlegen endgültig — es gab für Features
 * überhaupt keinen Umhäng-Pfad. Seit ein Feature eigenständig bestehen darf,
 * wäre das eine Falle: ein Fehlgriff liesse sich nur durch Löschen und
 * Neuanlegen heilen, und dabei gingen Abhängigkeiten, PI, WSJF und der Verlauf
 * verloren.
 *
 * Wählbar sind die Epics desselben Wertstroms — dieselbe Bedingung, die der
 * Service am Seam durchsetzt. Der Leerwert ist ausdrücklich abschickbar und
 * heisst „eigenständig".
 */
export function FeatureParentAssign({
  featureId,
  artId,
  parent,
  options,
  canEdit,
}: {
  featureId: string;
  artId: string;
  parent: { id: string; title: string; stageGate: string | null } | null;
  options: ReadonlyArray<{ id: string; title: string }>;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(parent?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const link = parent && current === parent.id && (
    <Link
      href={`/portfolio/epics/${parent.id}` as never}
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {parent.title}
      {parent.stageGate && (
        <span className="ml-1 rounded-sm bg-muted px-1 text-label text-muted-foreground">
          {parent.stageGate}
        </span>
      )}
      <ArrowRight className="size-3" />
    </Link>
  );

  if (!canEdit) {
    return (
      link || (
        <span className="text-muted-foreground">{t("work.feature.eigenstaendigOhneEpic")}</span>
      )
    );
  }

  function choose(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", featureId);
      fd.set("artId", artId);
      fd.set("parentId", next);
      const res = await setFeatureParentAction({}, fd);
      if (res.error) {
        setError(res.error);
        setCurrent(previous);
      }
    });
  }

  return (
    <div className="space-y-1">
      {link}
      <select
        value={current}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        aria-label={t("work.feature.elternEpic")}
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="">{t("work.feature.eigenstaendigOhneEpic2")}</option>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
