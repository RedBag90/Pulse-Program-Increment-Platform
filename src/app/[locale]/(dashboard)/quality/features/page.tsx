import { redirect } from "next/navigation";

/**
 * Mit der Abschaffung des Feature-QA-Gates (2026-06) gibt es nichts mehr
 * zu reviewen — Features starten direkt im Delivery-Lebenszyklus. Diese
 * Route bleibt als Shim und leitet auf das Cockpit weiter; Filter
 * `?status=approved` oeffnet sinngemaess „Bereit"-Lane = ehemals
 * approved Features.
 */
export default function FeatureQualityRedirect(): never {
  redirect("/umsetzung?view=table&status=approved");
}
