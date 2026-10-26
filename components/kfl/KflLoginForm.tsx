"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function KflLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/kfl/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Hyrja dështoi.");
      router.replace("/kycu/artikuj");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hyrja dështoi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="kfl-login-page">
      <section className="kfl-login-card" aria-labelledby="kfl-login-title">
        <Image src="/logo.png" alt="Momenti" width={190} height={49} priority />
        <span className="kfl-eyebrow">KRIJO FOTOLAJM</span>
        <h1 id="kfl-login-title">Kyçu në KFL</h1>
        <p>Hyr në hapësirën e redaksisë për të krijuar fotolajme.</p>
        <form onSubmit={submit} className="kfl-login-form">
          <label htmlFor="username">Emri i përdoruesit</label>
          <input id="username" name="username" autoComplete="username" required />
          <label htmlFor="password">Fjalëkalimi</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          {error && <p className="kfl-form-error" role="alert">{error}</p>}
          <button className="kfl-button kfl-button-primary" type="submit" disabled={busy}>
            {busy ? "Duke u kyçur…" : "Kyçu"}
          </button>
        </form>
        <Link className="kfl-back-link" href="/">← Kthehu te Momenti</Link>
      </section>
    </main>
  );
}
