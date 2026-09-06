"use client";
import { useState } from "react";
import { MotionPage } from "@/components/LeagueMotion";
import { ArrowRight } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
export default function Login() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-screen">
      <MotionPage className="login-content">
        <GameIcon name="colonist" size={112} className="login-artwork" />
        <h1>
          Catan
          <br />
          <em>Chambers</em>
        </h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              location.assign("/");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not sign in.");
              setBusy(false);
            }
          }}
        >
          <label htmlFor="passcode">Group or admin passcode</label>
          <input
            id="passcode"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter passcode"
          />
          <button className="primary-button" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={18} />
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </form>
      </MotionPage>
    </main>
  );
}
