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

      reject(new Error(output.trim() || `Balance check exited with code ${code}`));
    });
  });
}

function parseWalletAddress(output: string, walletName: string) {
  const escapedWallet = walletName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(
    new RegExp(`Coldkey\\s+${escapedWallet}\\s+ss58_address\\s+([1-9A-HJ-NP-Za-km-z]+)`),
  );

  return match?.[1] || "";
}

function parseBalance(output: string) {
  const normalized = output
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[^\w.\n:]/g, " ");
  const match = normalized.match(/Wallet\s+free\s+balance:\s*(\d+(?:\.\d+)?)/i);

  return match?.[1] || "0";
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

  if (!walletName) {
    return NextResponse.json({ error: "Wallet name is required" }, { status: 400 });
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
  const command = `
    wallet_list="$(btcli wallet list --wallet-path ~/.bittensor/wallets 2>&1)"
    overview="$(btcli wallet overview --wallet-name ${shellQuote(walletName)} --wallet-path ~/.bittensor/wallets --network ${network} --netuid ${netuid} 2>&1 || true)"
    echo "$wallet_list"
    echo "$overview"
  `;

  try {
    const { output } = await runDockerExec(deployment.container_id, command);
    const address = parseWalletAddress(output, walletName);
    const balance = parseBalance(output);
    const metadata =
      deployment.metadata && typeof deployment.metadata === "object"
        ? deployment.metadata
        : {};

    if (address) {
      await supabase.from("user_wallets").upsert(
        {
          coldkey_address: address,
          updated_at: new Date().toISOString(),
          user_id: user.id,
          wallet_name: walletName,
          wallet_volume: `deploytao-wallet-${user.id.replaceAll("-", "")}`,
        },
        { onConflict: "user_id" },
      );
    }

    await supabase
      .from("deployments")
      .update({
        metadata: {
          ...metadata,
          wallet_address: address,
          wallet_balance_tao: balance,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({
      balance,
      funded: Number(balance) > 0,
      walletAddress: address,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Balance check failed" },
      { status: 500 },
    );
  }
}
