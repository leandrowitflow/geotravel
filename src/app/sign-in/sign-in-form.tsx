"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isStaleSessionAuthError } from "@/lib/supabase/auth-errors";

type Props = { defaultNext: string };

export function SignInForm({ defaultNext }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }
      // Drop stale cookies so we do not hit "Invalid Refresh Token" before password sign-in.
      await supabase.auth.signOut({ scope: "local" });
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        if (isStaleSessionAuthError(signError)) {
          await supabase.auth.signOut({ scope: "local" });
          setError(
            "Old session cookies were cleared — click Sign in again.",
          );
          return;
        }
        setError(signError.message);
        return;
      }
      router.push(defaultNext);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-teal-700/50 bg-[#0c3532] p-8 shadow-lg">
      <h1 className="text-lg font-semibold text-white">Staff sign in</h1>
      <p className="mt-1 text-sm text-teal-200/80">
        Geotravel admin — use your Supabase Auth account.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
        <label className="block text-sm text-teal-100">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-teal-600/60 bg-[#0a2e2c] px-3 py-2 text-white placeholder:text-teal-600/80 focus:border-teal-400 focus:outline-none"
            placeholder="you@company.com"
          />
        </label>
        <label className="block text-sm text-teal-100">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-teal-600/60 bg-[#0a2e2c] px-3 py-2 text-white placeholder:text-teal-600/80 focus:border-teal-400 focus:outline-none"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-white py-2.5 text-sm font-medium text-[#0c3532] hover:bg-teal-50 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-teal-200/70">
        <Link href="/" className="underline hover:text-white">
          Back to home
        </Link>
      </p>
    </div>
  );
}
