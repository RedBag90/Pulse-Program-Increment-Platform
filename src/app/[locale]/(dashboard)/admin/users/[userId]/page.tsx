import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ userId: string }>;
}

/**
 * Deep-link target for legacy `/admin/users/<userId>` URLs (audit logs, old
 * emails). Redirects to the master-detail page with the user pre-selected so
 * the deep-link experience matches the new IA.
 */
export default async function UserDetailRedirect({ params }: Props) {
  const { userId } = await params;
  redirect(`/admin/users?selected=user_${userId}`);
}
