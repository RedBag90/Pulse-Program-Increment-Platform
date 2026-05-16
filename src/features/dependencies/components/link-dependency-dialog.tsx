"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { linkDependencyAction } from "@/features/dependencies/actions/dependency";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type DependencyType = "blocks" | "depends_on" | "relates_to";

interface Candidate {
  id: string;
  title: string;
}

interface Props {
  fromId: string;
  artId: string;
  candidates: Candidate[];
}

const TYPES: { value: DependencyType; label: string }[] = [
  { value: "blocks", label: "blocks" },
  { value: "depends_on", label: "depends on" },
  { value: "relates_to", label: "relates to" },
];

export function LinkDependencyDialog({ fromId, artId, candidates }: Props) {
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState("");
  const [type, setType] = useState<DependencyType>("blocks");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!toId) return;
    setError(null);
    startTransition(async () => {
      const result = await linkDependencyAction(fromId, toId, type, artId);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success("Dependency linked");
        setToId("");
        setType("blocks");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Link2 className="size-4 mr-1.5" />
        Link dependency
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link a dependency</DialogTitle>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No other features in this ART to depend on.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dep-type">This feature…</Label>
                <select
                  id="dep-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as DependencyType)}
                  className={SELECT_CLASS}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-target">Target feature</Label>
                <select
                  id="dep-target"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Select a feature…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending || !toId}>
              {isPending ? "Linking…" : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
