import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const testOrders: Record<string, { leverage: number; trade_pair: string }> = {
  crypto: { leverage: 0.01, trade_pair: "BTCUSD" },
  equities: { leverage: 0.1, trade_pair: "SPY" },
  forex: { leverage: 0.1, trade_pair: "EURUSD" },
};

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

      reject(new Error(output.trim() || `Test signal exited with code ${code}`));
    });
  });
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
    .select("id,user_id,container_id,asset_class,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  if (!deployment.container_id) {
    return NextResponse.json({ error: "Prepare the miner first" }, { status: 400 });
  }

  const metadata =
    deployment.metadata && typeof deployment.metadata === "object"
      ? deployment.metadata
      : {};
  const apiKey = typeof metadata.miner_api_key === "string" ? metadata.miner_api_key : "";
  const assetClass = deployment.asset_class || "";
  const order = testOrders[assetClass];

  if (!apiKey) {
    return NextResponse.json({ error: "Start the miner first" }, { status: 400 });
  }

  if (!order) {
    return NextResponse.json({ error: "Select an asset class first" }, { status: 400 });
  }

  const payload = JSON.stringify({
    execution_type: "MARKET",
    leverage: order.leverage,
    order_type: "LONG",
    trade_pair: order.trade_pair,
  });
  const orderCommand = [
    "curl",
    "--fail-with-body",
    "--silent",
    "--show-error",
    "--max-time",
    "90",
    "-X",
    "POST",
    "http://127.0.0.1:8088/api/submit-order",
    "-H",
    shellQuote("Content-Type: application/json"),
    "-H",
    shellQuote(`Authorization: ${apiKey}`),
    "-d",
    shellQuote(payload),
  ].join(" ");
  const command = `
    set -eu
    if ! curl -fsS http://127.0.0.1:8088/api/health >/dev/null 2>&1; then
      echo "Miner API is not ready. Start the miner again and wait for it to show running."
      exit 1
    fi
    ${orderCommand}
  `;

  try {
    const { output } = await runDockerExec(deployment.container_id, command);

    const { data, error } = await supabase
      .from("deployments")
      .update({
        metadata: {
          ...metadata,
          last_test_signal_output: output.slice(-4000),
          last_test_signal_pair: order.trade_pair,
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

    return NextResponse.json({
      deployment: data,
      order,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test signal failed" },
      { status: 500 },
    );
  }
}
