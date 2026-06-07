import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listMyTasks } from "@/server/services/my-tasks";
import { buildMyTasksListModel } from "@/server/views/my-tasks-list";
import { MyTasksListShell } from "@/features/my-tasks/components/my-tasks-list-shell";

/**
 * "Meine Tasks" — Personal Inbox aller Epics und Features, deren Owner
 * oder Assignee der Principal ist. Bedient sich des Rich-List-Templates
 * (Funnel + Filter + Tabelle + URL-State) wie `/portfolio/epics`,
 * `/art/[artId]/features` und `/implementation/features`.
 */
export default async function MyTasksPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tasks = await listMyTasks(db, principal);

  const model = buildMyTasksListModel({ tasks });

  return (
    <Suspense fallback={null}>
      <MyTasksListShell model={model} />
    </Suspense>
  );
}
