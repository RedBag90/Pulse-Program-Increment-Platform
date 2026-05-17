"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Dialog open-state that auto-opens when the URL carries `?create=<key>`.
 * This lets the global "+" menu deep-link straight into a create dialog: the
 * menu navigates to the entity's page with `?create=<key>`, and the page's
 * dialog opens itself. Off that param it behaves like `useState(false)`.
 */
export function useCreateDialogState(key: string): [boolean, (open: boolean) => void] {
  const params = useSearchParams();
  const [open, setOpen] = useState(() => params.get("create") === key);
  return [open, setOpen];
}
