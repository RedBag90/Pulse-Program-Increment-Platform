import { Link } from "@/i18n/navigation";
import { CreateTeamDialog } from "@/modules/core/org/features/team/components/create-team-dialog";
import { EditTeamDialog } from "@/modules/core/org/features/team/components/edit-team-dialog";
import { DeleteTeamButton } from "@/modules/core/org/features/team/components/delete-team-button";

interface Team {
  id: string;
  name: string;
}

interface Props {
  artId: string;
  teams: Team[];
  canEdit: boolean;
}

export function ArtTeamsTab({ artId, teams, canEdit }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Teams</h2>
        {canEdit && <CreateTeamDialog artId={artId} />}
      </div>

      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No teams yet. Create one to start assigning sprints.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="border rounded-lg p-5 space-y-3 hover:shadow-sm transition-shadow"
            >
              <div className="space-y-1">
                <h3 className="font-semibold">{team.name}</h3>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={`/team/${team.id}/settings`}
                  className="inline-block text-xs font-medium text-primary hover:underline"
                >
                  Einstellungen →
                </Link>
                {canEdit && (
                  <>
                    <EditTeamDialog id={team.id} artId={artId} name={team.name} />
                    <DeleteTeamButton id={team.id} artId={artId} name={team.name} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
