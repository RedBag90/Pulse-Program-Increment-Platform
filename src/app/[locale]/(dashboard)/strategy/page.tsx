import { redirect } from "next/navigation";

/**
 * `/strategy` ist mit `/ziele` zusammengelegt (Übersicht + Pflege sind eine
 * Surface, Edit ist Capability-gesteuert). Diese Route bleibt nur als Redirect
 * bestehen, damit alte Bookmarks/Deeplinks (`?entity=goal&id=…`) weiter
 * funktionieren — SearchParams werden dabei erhalten.
 */
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StrategyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const query = qs.toString();
  redirect(`/ziele${query ? `?${query}` : ""}`);
}
