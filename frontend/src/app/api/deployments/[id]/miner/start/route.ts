import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

function cleanWalletName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "") : "";
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function runDockerExec(containerId: string, command: string) {
  return new Promise<{ output: string }>((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", containerId, "sh", "-lc", command]);
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      output += data.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ output });
        return;
      }

      reject(new Error(output.trim() || `Miner start exited with code ${code}`));
    });
  });
}

export async function POST(
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
  const walletName = cleanWalletName(body.walletName);
  const hotkeyName = cleanWalletName(body.hotkeyName);

  if (!walletName || !hotkeyName) {
    return NextResponse.json({ error: "Wallet name and hotkey name are required" }, { status: 400 });
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from("deployments")
    .select("id,user_id,container_id,network,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (!deployment.container_id) {
    return NextResponse.json({ error: "Prepare the miner first" }, { status: 400 });
  }

  const network = deployment.network === "mainnet" ? "finney" : "test";
  const netuid = deployment.network === "mainnet" ? "8" : "116";
  const apiKey = randomBytes(24).toString("hex");
  const apiKeysJson = JSON.stringify({
    deploytao: {
      key: apiKey,
      tier: 200,
    },
  });
  const minerCommand = [
    "nohup python neurons/miner.py",
    `--netuid ${netuid}`,
    `--subtensor.network ${network}`,
    `--wallet.name ${walletName}`,
    `--wallet.hotkey ${hotkeyName}`,
    "--logging.debug",
    "> /tmp/deploytao-miner.log 2>&1 &",
    "echo $! > /tmp/deploytao-miner.pid",
  ].join(" ");
  const command = `
    set -eu
    cd /opt/vanta
    mkdir -p vanta_api
    printf %s ${shellQuote(apiKeysJson)} > vanta_api/api_keys.json
    health_url=http://127.0.0.1:8088/api/health
    wait_for_api() {
      miner_pid="$1"
      i=0
      while [ "$i" -lt 60 ]; do
        if curl -fsS "$health_url" >/tmp/deploytao-miner-health.out 2>/tmp/deploytao-miner-health.err; then
          echo miner api ready
          exit 0
        fi
        if [ -n "$miner_pid" ] && ! kill -0 "$miner_pid" 2>/dev/null; then
          echo miner process exited before api became ready
          tail -120 /tmp/deploytao-miner.log || true
          exit 1
        fi
        i=$((i + 1))
        sleep 2
      done
      echo miner api did not become ready
      cat /tmp/deploytao-miner-health.err || true
      tail -120 /tmp/deploytao-miner.log || true
      exit 1
    }
    if [ -f /tmp/deploytao-miner.pid ]; then
      existing_pid="$(cat /tmp/deploytao-miner.pid || true)"
      if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
        wait_for_api "$existing_pid"
      fi
      rm -f /tmp/deploytao-miner.pid
    fi
    ${minerCommand}
    sleep 1
    miner_pid="$(cat /tmp/deploytao-miner.pid || true)"
    wait_for_api "$miner_pid"
  `;

  try {
    const { output } = await runDockerExec(deployment.container_id, command);
    const metadata =
      deployment.metadata && typeof deployment.metadata === "object"
        ? deployment.metadata
        : {};

    const { data, error } = await supabase
      .from("deployments")
      .update({
        metadata: {
          ...metadata,
          miner_api_key: apiKey,
          miner_start_output: output.slice(-4000),
          miner_submit_url: "http://127.0.0.1:8088/api/submit-order",
        },
        status: "running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,status,metadata,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deployment: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Miner failed to start" },
      { status: 500 },
    );
  }
}
