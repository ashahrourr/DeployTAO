import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

function walletVolumeName(userId: string) {
  return `deploytao-wallet-${userId.replaceAll("-", "")}`;
}

function cleanWalletName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "") : "";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_wallets")
    .select("id,wallet_name,coldkey_address,wallet_volume,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallet: data });
}

export async function POST(request: Request) {
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
  const coldkeyAddress =
    typeof body.coldkeyAddress === "string" ? body.coldkeyAddress.trim() : null;

  if (!walletName) {
    return NextResponse.json({ error: "Wallet name is required" }, { status: 400 });
  }

  const walletVolume = walletVolumeName(user.id);

  const { data, error } = await supabase
    .from("user_wallets")
    .upsert(
      {
        coldkey_address: coldkeyAddress,
        updated_at: new Date().toISOString(),
        user_id: user.id,
        wallet_name: walletName,
        wallet_volume: walletVolume,
      },
      { onConflict: "user_id" },
    )
    .select("id,wallet_name,coldkey_address,wallet_volume,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallet: data });
}
