import { hasSupabaseEnv } from "@/src/lib/supabase/env";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  const configured = hasSupabaseEnv();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">DeployTAO</h1>
          <p className="mt-2 text-sm text-white/45">
            Create an account or sign in to manage miner deployments.
          </p>
        </div>

        {configured ? (
          <Suspense>
            <LoginForm />
          </Suspense>
        ) : (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            Supabase is not configured. Add the required values to
            <span className="text-white"> frontend/.env.local</span>.
          </div>
        )}
      </section>
    </main>
  );
}
