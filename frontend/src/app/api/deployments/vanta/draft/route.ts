import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

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
  const network = body.network === "mainnet" ? "mainnet" : "testnet";

  const { data, error } = await supabase
    .from("deployments")
    .insert({
      user_id: user.id,
      subnet: "vanta",
      mode: "managed",
      network,
      status: "draft",
      metadata: {
        netuid: network === "testnet" ? 116 : 8,
      },
    })
    .select("id,user_id,subnet,mode,network,status,metadata,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deployment: data });
}
