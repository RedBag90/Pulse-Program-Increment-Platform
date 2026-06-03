import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

/**
 * Small inline ART list for the PI header. A PI now lives on a Timeline that
 * may serve several ARTs — these chips spell out which ones, so the user can
 * jump back to any of them.
 */
export function PiArtChips({ arts }: { arts: Array<{ id: string; name: string }> }) {
  if (arts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {arts.map((a) => (
        <Link key={a.id} href={`/art/${a.id}`} className="hover:opacity-80">
          <Badge className="border-primary/20 bg-primary/10 font-medium text-primary">
            {a.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
