"use client";

import { Fragment, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CREATE_GROUPS, CREATE_REGISTRY } from "@/features/create/registry";
import { useCreateContext } from "@/features/create/use-create-context";
import { CreateValueStreamDialog } from "@/features/portfolio/components/create-value-stream-dialog";
import { CreateEpicDialog } from "@/features/portfolio/components/create-epic-dialog";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import { CreatePiDialog } from "@/features/pi/components/create-pi-dialog";
import { CreateTeamDialog } from "@/features/team/components/create-team-dialog";
import { CreateImpedimentDialog } from "@/features/impediment/components/create-impediment-dialog";

/** Left padding per hierarchy level — reproduces the screenshot's indentation. */
const INDENT = ["pl-2", "pl-6", "pl-10", "pl-14"] as const;

/**
 * Global "+" menu in the topbar: one discoverable, hierarchically indented
 * entry point for creating every Pulse entity. Wired entities (`inPlace`) open
 * their create dialog directly in the topbar; the rest still navigate.
 */
export function CreateMenu() {
  const ctx = useCreateContext();
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const close = (open: boolean) => {
    if (!open) setOpenKey(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Create new"
        >
          <Plus className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {CREATE_GROUPS.map((group, groupIdx) => (
            <Fragment key={group.key}>
              {groupIdx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </DropdownMenuLabel>
                {CREATE_REGISTRY.filter((entry) => entry.group === group.key).map((entry) => (
                  <DropdownMenuItem
                    key={entry.key}
                    className={INDENT[entry.indentLevel]}
                    onClick={() =>
                      entry.inPlace ? setOpenKey(entry.key) : router.push(entry.resolveHref(ctx))
                    }
                  >
                    {entry.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {openKey === "value-stream" && <CreateValueStreamDialog open onOpenChange={close} />}
      {openKey === "epic" && <CreateEpicDialog open onOpenChange={close} />}
      {openKey === "art" && <CreateArtDialog open onOpenChange={close} />}
      {openKey === "feature" && <CreateFeatureDialog open onOpenChange={close} context={ctx} />}
      {openKey === "pi" && <CreatePiDialog open onOpenChange={close} context={ctx} />}
      {openKey === "team" && <CreateTeamDialog open onOpenChange={close} context={ctx} />}
      {openKey === "impediment" && (
        <CreateImpedimentDialog open onOpenChange={close} context={ctx} />
      )}
    </>
  );
}
