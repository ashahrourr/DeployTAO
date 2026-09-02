import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

function cleanWalletName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "") : "";
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
      const normalized = output.toLowerCase();

      if (
        code === 0 &&
        !normalized.includes("failed") &&
        !normalized.includes("error") &&
        !normalized.includes("no source stake") &&
        !normalized.includes("no stake found")
      ) {
        resolve({ output });
        return;
      }

      reject(new Error(output.trim() || `Collateral deposit exited with code ${code}`));
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
  const amount = Number(body.amount);

  if (!walletName || !hotkeyName) {
    return NextResponse.json({ error: "Wallet name and hotkey name are required" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount < 300 || amount > 1000) {
    return NextResponse.json({ error: "Collateral amount must be between 300 and 1000 Theta" }, { status: 400 });
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
  const command = [
    "cd /opt/vanta",
    "vanta collateral deposit",
    `--wallet-name ${walletName}`,
    `--hotkey ${hotkeyName}`,
    "--wallet-path ~/.bittensor/wallets",
    `--network ${network}`,
    `--amount ${amount}`,
  ].join(" ");

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
          collateral_amount: amount,
          collateral_deposit_output: output.slice(-4000),
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
    const message = error instanceof Error ? error.message : "Collateral deposit failed";
    const needsFunds =
      message.toLowerCase().includes("balance") ||
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("no source stake") ||
      message.toLowerCase().includes("no stake");

    return NextResponse.json({ error: message, needsFunds }, { status: 500 });
  }
}
