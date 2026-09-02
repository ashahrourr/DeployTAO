import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createClient } from "@/src/lib/supabase/server";

const execFileAsync = promisify(execFile);
const allowedAssetClasses = new Set(["crypto", "forex", "equities"]);
const allowedWalletModes = new Set([
  "new-coldkey-hotkey",
  "existing-coldkey-new-hotkey",
]);

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
  const updates: Record<string, string> = {};

  if (
    typeof body.walletMode === "string" &&
    allowedWalletModes.has(body.walletMode)
  ) {
    updates.wallet_mode = body.walletMode;
  }

  if (
    typeof body.assetClass === "string" &&
    allowedAssetClasses.has(body.assetClass)
  ) {
    updates.asset_class = body.assetClass;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("deployments")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,network,status,wallet_mode,asset_class,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deployment: data });
}

export async function DELETE(
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
    .select("id,user_id,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }

  const metadata =
    deployment.metadata && typeof deployment.metadata === "object"
      ? (deployment.metadata as { container_name?: string })
      : {};

  if (metadata.container_name) {
    await execFileAsync("docker", ["rm", "-f", metadata.container_name]).catch(() => undefined);
  }

  const { error } = await supabase
    .from("deployments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
