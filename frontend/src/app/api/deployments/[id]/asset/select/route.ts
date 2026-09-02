import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

const allowedAssetClasses = new Set(["crypto", "forex", "equities"]);

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

      reject(new Error(output.trim() || `Asset selection exited with code ${code}`));
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
  const assetClass = typeof body.assetClass === "string" ? body.assetClass : "";
  const walletName = cleanWalletName(body.walletName);
  const hotkeyName = cleanWalletName(body.hotkeyName);

  if (!allowedAssetClasses.has(assetClass)) {
    return NextResponse.json({ error: "Choose a valid asset class" }, { status: 400 });
  }

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
  const baseUrl =
    network === "test"
      ? "https://validator.testnet.vantatrading.io"
      : "https://validator.mainnet.vantatrading.io";
  const script = `
import importlib.metadata
import json
import requests
from bittensor_wallet import Wallet

asset = ${JSON.stringify(assetClass)}
wallet = Wallet(name=${JSON.stringify(walletName)}, hotkey=${JSON.stringify(hotkeyName)}, path="/root/.bittensor/wallets")
coldkey = wallet.get_coldkey(password="")
hotkey = wallet.hotkey
payload = {
    "asset_selection": asset,
    "miner_coldkey": coldkey.ss58_address,
    "miner_hotkey": hotkey.ss58_address,
}
message = json.dumps(payload, sort_keys=True)
payload["signature"] = coldkey.sign(message.encode("utf-8")).hex()
payload["version"] = importlib.metadata.version("vanta-cli")
response = requests.post(${JSON.stringify(`${baseUrl}/asset-selection`)}, json=payload, timeout=45)
try:
    data = response.json()
except Exception:
    data = {"error_message": response.text}
message = data.get("error_message") or data.get("error") or ""
ok = bool(data.get("successfully_processed")) or message == f"Asset class already selected: {asset}. Cannot change selection."
print(json.dumps({
    "hotkey_address": hotkey.ss58_address,
    "ok": ok,
    "response": data,
    "status_code": response.status_code,
    "wallet_address": coldkey.ss58_address,
}))
`;
  const command = `python -c ${shellQuote(script)}`;

  try {
    const { output } = await runDockerExec(deployment.container_id, command);
    const result = JSON.parse(output.trim());

    if (!result.ok) {
      const message =
        result.response?.error_message ||
        result.response?.error ||
        "Asset selection was not confirmed";

      throw new Error(message);
    }

    const metadata =
      deployment.metadata && typeof deployment.metadata === "object"
        ? deployment.metadata
        : {};

    const { data, error } = await supabase
      .from("deployments")
      .update({
        asset_class: assetClass,
        metadata: {
          ...metadata,
          asset_selection_output: output.slice(-4000),
          hotkey_address: result.hotkey_address,
          hotkey_name: hotkeyName,
          selected_asset_class: assetClass,
          wallet_address: result.wallet_address,
          wallet_name: walletName,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,asset_class,metadata,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deployment: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Asset selection failed" },
      { status: 500 },
    );
  }
}
