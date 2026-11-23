"use client";

import { Button } from "@lockin/ui/components/button";
import { useActionState } from "react";
import { revokeGuardianConsentAction, type ActionState } from "@/server/auth-actions";

const initialState: ActionState = {};

export function GuardianRevokeForm({
  portalToken,
  isCurrentlyRestricted,
}: {
  portalToken: string;
  isCurrentlyRestricted: boolean;
}) {
  const [state, action, pending] = useActionState(revokeGuardianConsentAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="portalToken" value={portalToken} />
      {state.error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="bg-primary/10 text-primary rounded-md p-3 text-sm">
          {state.success}
        </p>
      )}
      <Button
        type="submit"
        variant="destructive"
        disabled={pending || isCurrentlyRestricted || Boolean(state.success)}
      >
        {isCurrentlyRestricted || state.success
          ? "Consent revoked (Account restricted)"
          : pending
            ? "Revoking consent…"
            : "Revoke guardian consent & restrict student account"}
      </Button>
    </form>
  );
}
