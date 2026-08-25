"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreateSolutionDialog } from "./create-solution-dialog";

/**
 * Header-Action der Solutions-Seite: „＋ Solution" öffnet den Dialog; kommt der
 * Aufruf über das „+"-Menü (`?create=solution`), öffnet er automatisch.
 */
export function SolutionsCreateControl() {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("create") === "solution") setOpen(true);
  }, [params]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Solution
      </Button>
      <CreateSolutionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
