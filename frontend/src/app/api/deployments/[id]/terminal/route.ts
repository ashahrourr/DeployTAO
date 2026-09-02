import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";

type TerminalSession = {
  closed: boolean;
  deploymentId: string;
  output: string;
  process: ChildProcessWithoutNullStreams;
  userId: string;
};

const sessions = new Map<string, TerminalSession>();

function appendOutput(session: TerminalSession, data: Buffer | string) {
  session.output += data.toString();

  if (session.output.length > 120000) {
    session.output = session.output.slice(-120000);
  }
}

async function getOwnedDeployment(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const { data: deployment, error: deploymentError } = await supabase
    .from("deployments")
    .select("id,user_id,container_id,metadata")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (deploymentError || !deployment) {
    return { error: "Deployment not found", status: 404 as const };
  }

  if (!deployment.container_id) {
    return { error: "Provision the container first", status: 400 as const };
  }

  return { deployment, user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await getOwnedDeployment(id);

  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = sessions.get(sessionId);

  if (
    !session ||
    session.deploymentId !== id ||
    session.userId !== owned.user.id
  ) {
    return NextResponse.json({ error: "Terminal session not found" }, { status: 404 });
  }

  return NextResponse.json({
    closed: session.closed,
    output: session.output,
    sessionId,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await getOwnedDeployment(id);

  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const body = await request.json().catch(() => ({}));

  if (body.sessionId) {
    const session = sessions.get(body.sessionId);

    if (
      !session ||
      session.deploymentId !== id ||
      session.userId !== owned.user.id
    ) {
      return NextResponse.json({ error: "Terminal session not found" }, { status: 404 });
    }

    if (session.closed) {
      return NextResponse.json({ error: "Terminal session is closed" }, { status: 409 });
    }

    session.process.stdin.write(String(body.input ?? ""));
    return NextResponse.json({ ok: true });
  }

  const process = spawn("docker", [
    "exec",
    "-i",
    owned.deployment.container_id,
    "sh",
  ]);
  const sessionId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: TerminalSession = {
    closed: false,
    deploymentId: id,
    output: "",
    process,
    userId: owned.user.id,
  };

  process.stdout.on("data", (data) => appendOutput(session, data));
  process.stderr.on("data", (data) => appendOutput(session, data));
  process.on("error", (error) => {
    appendOutput(session, `\n[terminal error: ${error.message}]\n`);
    session.closed = true;
  });
  process.on("exit", (code) => {
    appendOutput(session, `\n[terminal exited with code ${code}]\n`);
    session.closed = true;
  });

  sessions.set(sessionId, session);
  process.stdin.write("cd /opt/vanta\n");
  process.stdin.write("printf 'deploytao container shell ready\\n'\n");

  return NextResponse.json({ sessionId });
}
