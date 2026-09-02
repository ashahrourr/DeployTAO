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

function parseWalletMarker(output: string) {
  const match = output.match(/DEPLOYTAO_WALLET_ADDRESSES (\{.*\})/);

  if (!match) {
    return {};
  }

  try {
    return JSON.parse(match[1]) as {
      hotkey_address?: string;
      wallet_address?: string;
    };
  } catch {
    return {};
  }
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

      reject(new Error(output.trim() || `Registration exited with code ${code}`));
    });

    child.stdin.write("\n");
    child.stdin.end();
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
  const addressScript = `
import json
from bittensor_wallet import Wallet
wallet = Wallet(name=${JSON.stringify(walletName)}, hotkey=${JSON.stringify(hotkeyName)}, path="/root/.bittensor/wallets")
print("DEPLOYTAO_WALLET_ADDRESSES " + json.dumps({
    "wallet_address": wallet.get_coldkey(password="").ss58_address,
    "hotkey_address": wallet.hotkey.ss58_address,
}))
`;
  const command = `
    cd /opt/vanta
    register_output="$(btcli subnet register --wallet-name ${walletName} --hotkey ${hotkeyName} --wallet-path ~/.bittensor/wallets --network ${network} --netuid ${netuid} --no-prompt 2>&1)" || {
      echo "$register_output"
      exit 1
    }
    echo "$register_output"
    if echo "$register_output" | grep -Eiq "insufficient balance|not enough|failed|error|not registered"; then
      exit 1
    fi
    if echo "$register_output" | grep -Eiq "Registered on netuid ${netuid} with UID|Already registered"; then
      python -c ${shellQuote(addressScript)} || true
      echo registration confirmed
      exit 0
    fi
    i=0
    while [ "$i" -lt 4 ]; do
      overview="$(btcli wallet overview --wallet-name ${walletName} --wallet-path ~/.bittensor/wallets --network ${network} --netuid ${netuid} 2>&1 || true)"
      echo "$overview"
      if echo "$overview" | grep -q "[[:space:]]${hotkeyName}[[:space:]]"; then
        python -c ${shellQuote(addressScript)} || true
        echo registration confirmed
        exit 0
      fi
      i=$((i + 1))
      sleep 5
    done
    echo "Registration was not confirmed. Add testnet TAO to this wallet, then register again."
    exit 1
  `;

  try {
    const { output } = await runDockerExec(deployment.container_id, command);
    const addresses = parseWalletMarker(output);
    const metadata =
      deployment.metadata && typeof deployment.metadata === "object"
        ? deployment.metadata
        : {};

    const { data, error } = await supabase
      .from("deployments")
      .update({
        metadata: {
          ...metadata,
          hotkey_address: addresses.hotkey_address,
          hotkey_name: hotkeyName,
          registration_output: output.slice(-4000),
          registered_netuid: netuid,
          wallet_address: addresses.wallet_address,
          wallet_name: walletName,
        },
        status: "registered",
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
    const message = error instanceof Error ? error.message : "Registration failed";
    const needsFunds =
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("not enough") ||
      message.toLowerCase().includes("add testnet tao");

    return NextResponse.json({ error: message, needsFunds }, { status: 500 });
  }
}
