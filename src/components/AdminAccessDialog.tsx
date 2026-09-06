"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export function AdminAccessDialog({
  close,
  unlocked,
}: {
  close: () => void;
  unlocked: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!busy) close();
      }}
    >
      <DialogContent className="chamber-dialog">
        <DialogTitle>Start new season</DialogTitle>
        <DialogDescription>
          Enter your admin passcode to continue.
        </DialogDescription>
        <form
          className="setup-fields"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const response = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(result.error || "Could not sign in.");
              if (result.role !== "admin")
                throw new Error(
                  "Use your admin passcode, not the group passcode.",
                );
              await unlocked();
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Could not sign in.",
              );
              setBusy(false);
            }
          }}
        >
          <label htmlFor="season-admin-passcode">Admin passcode</label>
          <input
            id="season-admin-passcode"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={200}
            disabled={busy}
            autoFocus
          />
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full-width" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
