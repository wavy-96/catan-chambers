"use client";
import { useState } from "react";
import { ArrowRight, LockKeyhole, Hexagon } from "lucide-react";
export default function Login() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-screen">
      <div className="login-orbit" aria-hidden="true">
        <Hexagon />
      </div>
      <div className="login-content">
        <p className="eyebrow">FOUR FRIENDS. ONE TABLE.</p>
        <h1>
          Catan
          <br />
          <em>Chambers.</em>
        </h1>
        <p className="login-description">
          Every point. Every rivalry.
          <br />
          All the bragging rights.
        </p>
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
          <label htmlFor="passcode">Your chamber passcode</label>
          <input
            id="passcode"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Members only"
          />
          <button className="primary-button" disabled={busy}>
            {busy ? "Opening the chamber…" : "Enter the chamber"}
            <ArrowRight size={18} />
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </form>
        <p className="private-note">
          <LockKeyhole size={14} /> A private league for the inner circle.
        </p>
      </div>
    </main>
  );
}
