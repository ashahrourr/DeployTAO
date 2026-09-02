import { createClient } from "@/src/lib/supabase/server";
import { hasSupabaseEnv } from "@/src/lib/supabase/env";

const pageNames: Record<string, string> = {
  "/overview": "Overview",
  "/subnets": "Subnets",
  "/deployments": "Deployments",
  "/wallet": "Wallet",
  "/settings": "Settings",
};

export async function Topbar({ pathname }: { pathname: string }) {
  const pageName = pageNames[pathname] ?? "DeployTAO";
  const user = hasSupabaseEnv()
    ? (await createClient()).auth.getUser().then(({ data }) => data.user)
    : null;
  const resolvedUser = await user;

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-black px-6">
      <div className="w-40" />
      <p className="text-sm font-medium text-white/75">{pageName}</p>
      <div className="flex w-40 items-center justify-end gap-3">
        {resolvedUser?.email && (
          <span className="max-w-28 truncate text-xs text-white/35">
            {resolvedUser.email}
          </span>
        )}
        {resolvedUser && (
          <form action="/auth/signout" method="post">
            <button className="text-xs text-white/45 transition hover:text-white">
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
