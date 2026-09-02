import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

type GitHubRepo = {
  default_branch: string;
  full_name: string;
  html_url: string;
  private: boolean;
  pushed_at: string | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deploymentId = request.nextUrl.searchParams.get("deploymentId") || "";
  const connectUrl = `/api/github/connect${deploymentId ? `?deploymentId=${deploymentId}` : ""}`;

  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "github")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!integration?.access_token) {
    return NextResponse.json(
      { connectUrl, error: "GitHub is not connected" },
      { status: 401 },
    );
  }

  const reposRes = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${integration.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!reposRes.ok) {
    return NextResponse.json(
      { connectUrl, error: "Could not load GitHub repositories" },
      { status: reposRes.status },
    );
  }

  const repos = (await reposRes.json()) as GitHubRepo[];

  return NextResponse.json({
    repos: repos.map((repo) => ({
      defaultBranch: repo.default_branch,
      fullName: repo.full_name,
      private: repo.private,
      pushedAt: repo.pushed_at,
      url: repo.html_url,
    })),
  });
}
