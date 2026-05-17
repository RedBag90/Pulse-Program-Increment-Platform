"use client";

import { usePathname } from "@/i18n/navigation";
import { parseCreateContext, type CreateContext } from "./create-context";

export type { CreateContext };
export { parseCreateContext };

/** The create context for the current route. */
export function useCreateContext(): CreateContext {
  return parseCreateContext(usePathname());
}
