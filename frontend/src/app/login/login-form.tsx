"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/src/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/overview";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    const supabase = createClient();
    const origin = window.location.origin;

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      setIsSubmitting(false);

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus("Check your email and confirm your account.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    window.location.href = nextPath;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 rounded-md border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`h-9 rounded text-sm ${
            mode === "signin" ? "bg-white text-black" : "text-white/55"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`h-9 rounded text-sm ${
            mode === "signup" ? "bg-white text-black" : "text-white/55"
          }`}
        >
          Create account
        </button>
      </div>

      <label className="block text-sm text-white/55" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        required
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="h-11 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/25"
        placeholder="you@example.com"
      />

      <label className="block text-sm text-white/55" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        required
        minLength={8}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="h-11 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/25"
        placeholder="At least 8 characters"
      />

      <button
        disabled={isSubmitting}
        className="h-11 w-full rounded-md bg-white text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Please wait..."
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>
      {status && <p className="text-sm text-white/50">{status}</p>}
    </form>
  );
}
