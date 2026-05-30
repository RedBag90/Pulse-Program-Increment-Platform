import { redirect } from "next/navigation";

/**
 * The Feature-QS dashboard has moved into the broader "Meine Freigaben" inbox
 * at /my-approvals (Features in review now appear alongside Epic approvals,
 * hypothesis decisions, and section sign-offs). This shim keeps existing
 * bookmarks working.
 */
export default function FeatureQualityRedirect(): never {
  redirect("/my-approvals");
}
