"use client";
import { useState } from "react";
import { Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Season } from "@/lib/league";
export function EndSeasonDialog({
  season,
  played,
  close,
  saved,
}: {
  season: Season;
  played: number;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
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
        <DialogTitle>
          End {season.name.replace("Catan ", "Season ").replace(".0", "")}?
        </DialogTitle>
        <DialogDescription>
          {played} of {season.total_games} games recorded. This closes score
          entry and makes the next season available.
        </DialogDescription>
        <label htmlFor="end-season-note">Note (optional)</label>
        <textarea
          id="end-season-note"
          className="end-season-note"
          rows={3}
          maxLength={300}
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why the season ended early"
        />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="setup-actions">
          <button className="secondary-button" disabled={busy} onClick={close}>
            Keep playing
          </button>
          <button
            className="primary-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/tournaments/end", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ seasonId: season.id, note }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                await saved();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not end season.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Ending…" : "End season"}
            <Flag size={17} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
