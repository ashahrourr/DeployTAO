import { execFile } from "node:child_process";
import { rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function strategyContainerName(id: string) {
  return `deploytao-strategy-${id.replaceAll("-", "").slice(0, 16)}`;
}

function strategyRepoPath(id: string) {
  return path.join(tmpdir(), "deploytao-strategies", id);
}

function repoCloneUrl(repoUrl: string) {
  return repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;
}

async function run(command: string, args: string[], options?: { cwd?: string }) {
  return execFileAsync(command, args, {
    cwd: options?.cwd,
    maxBuffer: 1024 * 1024 * 20,
  });
}

async function cloneRepo({
  branch,
  repoDir,
  repoUrl,
  token,
}: {
  branch: string;
  repoDir: string;
  repoUrl: string;
  token: string;
}) {
  const cloneArgs = ["clone", "--depth", "1", "--branch", branch, repoCloneUrl(repoUrl), repoDir];

  try {
    await run("git", [
      "-c",
      `http.https://github.com/.extraheader=Authorization: Bearer ${token}`,
      ...cloneArgs,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("Authentication failed") || message.includes("invalid credentials")) {
      await rm(repoDir, { force: true, recursive: true });
      await run("git", cloneArgs);
      return;
    }

    throw error;
  }
}

function cleanDeployError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Authentication failed") || message.includes("invalid credentials")) {
    return "GitHub could not clone this repo. Reconnect GitHub, then try again.";
  }

  if (message.includes("Remote branch") || message.includes("not found")) {
    return "GitHub repo or branch was not found. Check the selected repo and branch.";
  }

  if (message.includes("docker")) {
    return "Docker could not start the strategy container. Make sure Docker is running.";
  }

  return "Strategy deploy failed";
}

export async function POST(
  request: NextRequest,
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

  const { data: deployment, error: deploymentError } = await supabase
    .from("deployments")
    .select("id,user_id,network,asset_class,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "github")
    .maybeSingle();

  const metadata =
    deployment.metadata && typeof deployment.metadata === "object"
      ? deployment.metadata
      : {};
  const strategy =
    metadata.strategy && typeof metadata.strategy === "object"
      ? (metadata.strategy as Record<string, unknown>)
      : {};
  const repoUrl = typeof strategy.repo_url === "string" ? strategy.repo_url : "";
  const branch = typeof strategy.branch === "string" ? strategy.branch : "main";
  const startCommand =
    typeof strategy.start_command === "string" ? strategy.start_command : "";
  const apiKey = typeof strategy.api_key === "string" ? strategy.api_key : "";

  if (!repoUrl || !startCommand || !apiKey) {
    return NextResponse.json({ error: "Connect and save a strategy repo first" }, { status: 400 });
  }

  if (!integration?.access_token) {
    return NextResponse.json({ error: "Connect GitHub first" }, { status: 400 });
  }

  const repoDir = strategyRepoPath(id);
  const containerName = strategyContainerName(id);
  const origin = new URL(request.url).origin.replace("localhost", "host.docker.internal");
  const signalUrl = `${origin}/api/deployments/${id}/signals`;

  try {
    await rm(repoDir, { force: true, recursive: true });
    await mkdir(path.dirname(repoDir), { recursive: true });
    await cloneRepo({
      branch,
      repoDir,
      repoUrl,
      token: integration.access_token,
    });

    await run("docker", ["rm", "-f", containerName]).catch(() => undefined);

    const containerCommand = [
      "if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi",
      startCommand,
    ].join(" && ");

    const { stdout } = await run("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "--label",
      `deploytao.deployment_id=${id}`,
      "--label",
      "deploytao.kind=strategy",
      "-e",
      `DEPLOYTAO_SIGNAL_URL=${signalUrl}`,
      "-e",
      `DEPLOYTAO_API_KEY=${apiKey}`,
      "-e",
      `DEPLOYTAO_NETWORK=${deployment.network}`,
      "-e",
      `DEPLOYTAO_ASSET_CLASS=${deployment.asset_class || ""}`,
      "-v",
      `${repoDir}:/app`,
      "-w",
      "/app",
      "python:3.11-slim",
      "sh",
      "-lc",
      containerCommand,
    ]);

    const { data, error } = await supabase
      .from("deployments")
      .update({
        metadata: {
          ...metadata,
          strategy: {
            ...strategy,
            container_id: stdout.trim(),
            container_name: containerName,
            deployed_at: new Date().toISOString(),
            repo_path: repoDir,
            signal_url: signalUrl,
            status: "deployed",
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
  } catch (error) {
    return NextResponse.json(
      { error: cleanDeployError(error) },
      { status: 500 },
    );
  }
}
