import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
  token_type?: string;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("github_oauth_state")?.value;
  const deploymentId = cookieStore.get("github_oauth_deployment_id")?.value || "";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const redirectTo = deploymentId ? `/deployments/${deploymentId}` : "/deployments";

  cookieStore.delete("github_oauth_state");
  cookieStore.delete("github_oauth_deployment_id");

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL(`${redirectTo}?github=failed`, request.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`${redirectTo}?github=not-configured`, request.url));
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const tokenData = (await tokenRes.json()) as GitHubTokenResponse;

  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.redirect(new URL(`${redirectTo}?github=failed`, request.url));
  }

  await supabase.from("user_integrations").upsert(
    {
      access_token: tokenData.access_token,
      metadata: {
        scope: tokenData.scope,
        token_type: tokenData.token_type,
      },
      provider: "github",
      updated_at: new Date().toISOString(),
      user_id: user.id,
    },
    { onConflict: "user_id,provider" },
  );

  return NextResponse.redirect(new URL(`${redirectTo}?github=connected`, request.url));
}
