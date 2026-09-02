import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const allowedPairs: Record<string, Set<string>> = {
  crypto: new Set([
    "ADAUSD",
    "BCHUSD",
    "BTCUSD",
    "DOGEUSD",
    "ETHUSD",
    "HYPEUSD",
    "LINKUSD",
    "LTCUSD",
    "SOLUSD",
    "TAOUSD",
    "XMRUSD",
    "XRPUSD",
    "ZECUSD",
  ]),
  equities: new Set(["AAPL", "AMD", "AMZN", "GOOGL", "META", "MSFT", "NVDA", "QQQ", "SPY", "TSLA"]),
  forex: new Set(["AUDUSD", "EURUSD", "GBPUSD", "NZDUSD", "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD"]),
};

type SignalDeployment = {
  asset_class: string | null;
  container_id: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
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

      reject(new Error(output.trim() || `Signal exited with code ${code}`));
    });
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return authorization.trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const token = bearerToken(request);
  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Signal JSON is required" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Unauthorized signal" }, { status: 401 });
  }

  const { data: deployment, error: deploymentError } = await supabase
    .rpc("get_deployment_for_signal", {
      p_api_key: token,
      p_deployment_id: id,
    })
    .maybeSingle();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found or API key is invalid" }, { status: 404 });
  }

  const signalDeployment = deployment as SignalDeployment;
  const metadata =
    signalDeployment.metadata && typeof signalDeployment.metadata === "object"
      ? signalDeployment.metadata
      : {};
  const minerApiKey = typeof metadata.miner_api_key === "string" ? metadata.miner_api_key : "";
  const assetClass = signalDeployment.asset_class || "";
  const tradePair = typeof payload.trade_pair === "string" ? payload.trade_pair.toUpperCase() : "";
  const orderType = typeof payload.order_type === "string" ? payload.order_type.toUpperCase() : "";
  const leverage = Number((payload as { leverage?: unknown }).leverage);

  if (!signalDeployment.container_id || !minerApiKey) {
    return NextResponse.json({ error: "Miner is not running" }, { status: 400 });
  }

  if (!allowedPairs[assetClass]?.has(tradePair)) {
    return NextResponse.json({ error: `Trade pair ${tradePair || "missing"} is not allowed for ${assetClass}` }, { status: 400 });
  }

  if (!["FLAT", "LONG", "SHORT"].includes(orderType)) {
    return NextResponse.json({ error: "order_type must be LONG, SHORT, or FLAT" }, { status: 400 });
  }

  if (orderType !== "FLAT" && (!Number.isFinite(leverage) || leverage <= 0)) {
    return NextResponse.json({ error: "Positive leverage is required" }, { status: 400 });
  }

  const vantaPayload = JSON.stringify({
    execution_type: typeof payload.execution_type === "string" ? payload.execution_type : "MARKET",
    leverage: orderType === "FLAT" ? undefined : leverage,
    order_type: orderType,
    trade_pair: tradePair,
  });
  const command = `
    set -eu
    if ! curl -fsS http://127.0.0.1:8088/api/health >/dev/null 2>&1; then
      echo "Miner API is not ready."
      exit 1
    fi
    curl --fail-with-body --silent --show-error --max-time 90 -X POST http://127.0.0.1:8088/api/submit-order \
      -H ${shellQuote("Content-Type: application/json")} \
      -H ${shellQuote(`Authorization: ${minerApiKey}`)} \
      -d ${shellQuote(vantaPayload)}
  `;

  try {
    const { output } = await runDockerExec(signalDeployment.container_id, command);

    const { data, error } = await supabase
      .rpc("update_deployment_signal", {
        p_api_key: token,
        p_deployment_id: id,
        p_output: output,
        p_trade_pair: tradePair,
      })
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      deployment: data,
      output: JSON.parse(output),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signal failed" },
      { status: 500 },
    );
  }
}
