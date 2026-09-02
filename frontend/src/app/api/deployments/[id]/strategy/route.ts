import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const repoUrl = cleanText(body.repoUrl);
  const branch = cleanText(body.branch) || "main";
  const startCommand = cleanText(body.startCommand);

  if (!repoUrl) {
    return NextResponse.json({ error: "Repo URL is required" }, { status: 400 });
  }

  if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/.test(repoUrl)) {
    return NextResponse.json(
      { error: "Use a GitHub repo URL like https://github.com/user/repo" },
      { status: 400 },
    );
  }

  if (!startCommand) {
    return NextResponse.json({ error: "Start command is required" }, { status: 400 });
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from("deployments")
    .select("id,user_id,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  const metadata =
    deployment.metadata && typeof deployment.metadata === "object"
      ? deployment.metadata
      : {};
  const existingStrategy =
    metadata.strategy && typeof metadata.strategy === "object"
      ? (metadata.strategy as Record<string, unknown>)
      : {};
  const strategyApiKey =
    typeof existingStrategy.api_key === "string"
      ? existingStrategy.api_key
      : randomBytes(24).toString("hex");

  const { data, error } = await supabase
    .from("deployments")
    .update({
      metadata: {
        ...metadata,
        strategy: {
          ...existingStrategy,
          api_key: strategyApiKey,
          branch,
          repo_url: repoUrl.replace(/\/$/, ""),
          start_command: startCommand,
          status: "connected",
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,metadata,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deployment: data });
}
