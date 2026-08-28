import { redirect } from "next/navigation";

/**
 * „Meine Freigaben" ist in „Meine Tasks" aufgegangen: beide Listen liegen jetzt
 * gestapelt auf /my-tasks. Diese Route bleibt als stabiles Deep-Link-/CTA-Ziel
 * erhalten (Sign-off-Banner, Epic-Freigaben-Tab, Onboarding-Playbook, Next-Step-
 * CTAs) und leitet auf die gemergte Seite um.
 */
export default function MyApprovalsPage() {
  redirect("/my-tasks");
}
