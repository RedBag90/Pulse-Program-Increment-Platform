import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import type { ValueStreamRoundResult } from "@/modules/budgeting/server/views/value-stream-round-result";
import { SectionCard } from "@/components/ui/section-card";

/**
 * **Was aus der Kachel herausgekommen ist** — ein Nachschlagewerk über der
 * Arbeitsfläche, die es begründet (REQ-4).
 *
 * Die Kachel selbst liegt woanders; hier steht ihr Ergebnis und ein Weg
 * dorthin. Drei Lagen, drei Fassungen: keine Kachel · sie läuft noch · sie ist
 * durch (REQ-12). Die mittlere ist die wichtigste — eine Fläche, die schwiege,
 * bis die Kachel abgeschlossen ist, sähe genauso aus wie eine ohne Kachel.
 */
export function RoundResult({ result }: { result: ValueStreamRoundResult }) {
  const t = useTranslations();
  const hj = halfYearLabel(result.cycleKey);
  const title = `Ergebnis der Kachel · ${hj}`;
  const zurKachel =
    result.roundId == null ? null : (
      <Link
        href={`/budgeting/periods/${result.roundId}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        {t("budgeting.art.zurKachel")}
      </Link>
    );

  if (result.state === "none") {
    return (
      <SectionCard title={title}>
        {/*
          **„Steht auf keiner Kachel", nicht „es gibt keine Kachel".** Der Lader
          sieht nur die Kandidaten **dieses** Wertstroms; ob für das Halbjahr
          anderswo eine Kachel läuft, weiss er nicht. Der Satz sagt deshalb nur,
          was er weiss.
        */}
        <p className="text-sm text-muted-foreground">
          Für {hj} steht dieser Wertstrom auf keiner Budgeting-Kachel. Ohne sie ist ihm nichts
          zugesprochen — es gibt nichts aufzuteilen.{" "}
          <Link href="/budgeting/periods" className="font-medium text-primary hover:underline">
            {t("budgeting.art.zuDenKacheln")}
          </Link>
        </p>
      </SectionCard>
    );
  }

  if (result.state === "running") {
    return (
      <SectionCard title={title} action={zurKachel}>
        <p className="text-sm text-muted-foreground">
          Die Kachel für {hj} läuft noch — festgeschrieben ist nichts. Beantragt sind{" "}
          <strong className="font-medium text-foreground">{formatEUR(result.askTotal)}</strong>.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={title}
      description={t("budgeting.art.wasDieKachelDiesem")}
      action={zurKachel}
      bleed
    >
      <div className="overflow-x-auto border-y">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-meta uppercase tracking-[0.1em] text-muted-foreground">
              <th className="p-2 text-left font-medium">{t("budgeting.art.posten")}</th>
              <th className="p-2 text-right font-medium">{t("budgeting.art.beantragt")}</th>
              <th className="p-2 text-right font-medium">{t("budgeting.art.zugesprochen")}</th>
              <th className="p-2 text-right font-medium">
                {t("budgeting.art.anteil")}
                <span className="ml-1 normal-case tracking-normal">
                  {t("budgeting.art.anDieserKachel")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.key} className="border-b">
                <td className="p-2">{r.label}</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {formatEUR(r.ask)}
                </td>
                <td className="p-2 text-right tabular-nums">{formatEUR(r.amount)}</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {Math.round(r.share * 100)} %
                </td>
              </tr>
            ))}
            <tr className="border-t-2 font-semibold">
              <td className="p-2">{t("budgeting.art.ausDieserKachel")}</td>
              <td className="p-2 text-right tabular-nums">{formatEUR(result.askTotal)}</td>
              <td className="p-2 text-right tabular-nums">{formatEUR(result.total)}</td>
              <td className="p-2 text-right tabular-nums">100 %</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
