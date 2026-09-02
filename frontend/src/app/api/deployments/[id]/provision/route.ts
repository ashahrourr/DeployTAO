import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const imageName = "deploytao/vanta-miner:latest";

async function runDocker(args: string[]) {
  return execFileAsync("docker", args, {
    maxBuffer: 1024 * 1024 * 20,
  });
}

function containerName(id: string) {
  return `deploytao-vanta-${id.replaceAll("-", "").slice(0, 16)}`;
}

function walletVolumeName(userId: string) {
  return `deploytao-wallet-${userId.replaceAll("-", "")}`;
}

export async function POST(
  _request: Request,
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
    .select("id,user_id,network,status,asset_class,wallet_mode,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (deployment.status !== "draft" && deployment.status !== "failed") {
    return NextResponse.json(
      { error: `Deployment is already ${deployment.status}` },
      { status: 409 },
    );
  }

  try {
    await runDocker(["version", "--format", "{{.Server.Version}}"]);
  } catch {
    return NextResponse.json(
      { error: "Docker is not installed or Docker Desktop is not running" },
      { status: 500 },
    );
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const dockerContext = path.join(projectRoot, "workers", "vanta");
  const name = containerName(id);
  const walletVolume = walletVolumeName(user.id);
  const network = deployment.network === "mainnet" ? "finney" : "test";
  const netuid = deployment.network === "mainnet" ? "8" : "116";

  try {
    await supabase
      .from("deployments")
      .update({
        status: "provisioning",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    await runDocker(["build", "-t", imageName, dockerContext]);
    await runDocker(["rm", "-f", name]).catch(() => undefined);

    const { stdout } = await runDocker([
      "run",
      "-d",
      "--name",
      name,
      "--label",
      `deploytao.deployment_id=${id}`,
      "-e",
      `DEPLOYMENT_ID=${id}`,
      "-e",
      `NETWORK=${network}`,
      "-e",
      `NETUID=${netuid}`,
      "-v",
      `${walletVolume}:/root/.bittensor/wallets`,
      "-p",
      "127.0.0.1::8088",
      imageName,
    ]);

    const containerId = stdout.trim();
    const metadata =
      deployment.metadata && typeof deployment.metadata === "object"
        ? deployment.metadata
        : {};

    const { data, error } = await supabase
      .from("deployments")
      .update({
        container_id: containerId,
        status: "awaiting_wallet",
        metadata: {
          ...metadata,
          container_name: name,
          docker_image: imageName,
          netuid,
          wallet_volume: walletVolume,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,status,container_id,metadata,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deployment: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning failed";

    await supabase
      .from("deployments")
      .update({
        status: "failed",
        metadata: {
          provision_error: message,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
