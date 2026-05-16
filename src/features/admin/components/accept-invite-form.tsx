"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/features/admin/actions/accept-invite";

interface Props {
  token: string;
  email: string;
}

export function AcceptInviteForm({ token, email }: Props) {
  const [state, action, isPending] = useActionState(acceptInviteAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-red-600 text-sm">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
