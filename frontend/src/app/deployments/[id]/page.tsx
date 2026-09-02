import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ExternalLink, GitBranch } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Sidebar } from "@/src/components/sidebar";
import { DeployStrategyButton } from "@/src/components/deployments/deploy-strategy-button";
import { RemoveDeploymentButton } from "@/src/components/deployments/remove-deployment-button";
import { StrategyRepoForm } from "@/src/components/deployments/strategy-repo-form";
import { Topbar } from "@/src/components/topbar";
import { createClient } from "@/src/lib/supabase/server";

type DeploymentMetadata = {
  last_test_signal_pair?: string;
  miner_submit_url?: string;
  container_name?: string;
  hotkey_address?: string;
  selected_asset_class?: string;
  strategy?: {
    api_key?: string;
    branch?: string;
    repo_url?: string;
    start_command?: string;
    status?: string;
    container_name?: string;
    deployed_at?: string;
  };
};

const execFileAsync = promisify(execFile);

async function getContainerState(containerName?: string) {
  if (!containerName) {
    return "missing";
  }

  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["inspect", "-f", "{{.State.Status}}", containerName],
      { maxBuffer: 1024 * 1024 },
    );

    return stdout.trim() || "missing";
  } catch {
    return "missing";
  }
}

export default async function DeploymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: deployment } = await supabase
    .from("deployments")
    .select("id,subnet,network,status,asset_class,metadata,updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!deployment) {
    notFound();
  }

  const metadata =
    deployment.metadata && typeof deployment.metadata === "object"
      ? (deployment.metadata as DeploymentMetadata)
      : {};
  const strategy = metadata.strategy;
  const repoName = strategy?.repo_url?.replace("https://github.com/", "") || "No repository connected";
  const signalPath = `/api/deployments/${deployment.id}/signals`;
  const dashboardBase =
    deployment.network === "testnet"
      ? "https://testnet.dashboard.taoshi.io"
      : "https://dashboard.taoshi.io";
  const dashboardUrl =
    deployment.network === "mainnet" && metadata.hotkey_address
      ? `${dashboardBase}/miner/${metadata.hotkey_address}`
      : dashboardBase;
  const containerState = await getContainerState(metadata.container_name);
  const strategyContainerState = await getContainerState(strategy?.container_name);
  const minerStatus =
    deployment.status === "running" && containerState !== "running"
      ? "stopped"
      : deployment.status;
  const ready = minerStatus === "running";

  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <section className="flex-1">
        <Topbar pathname="/deployments" />

        <div className="h-[calc(100vh-56px)] overflow-y-auto px-5 py-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.06] text-sm">
                    {deployment.subnet.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                      {deployment.subnet}
                    </h1>
                    <p className="font-mono text-xs text-white/40">
                      {deployment.network} deployment
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {strategy?.repo_url && (
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-sm text-white/80 hover:border-white/30 hover:bg-white/[0.04]"
                    href={strategy.repo_url}
                    target="_blank"
                  >
                    <GitBranch size={16} />
                    Repository
                  </Link>
                )}
                <DeployStrategyButton
                  deploymentId={deployment.id}
                  disabled={!strategy?.repo_url}
                />
                <div className="h-9 rounded-md border border-white/15 px-3 py-2 text-sm">
                  <RemoveDeploymentButton deploymentId={deployment.id} />
                </div>
              </div>
            </div>

            <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#050505]">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
                <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
                  <div className="flex aspect-[16/10] items-center justify-center rounded-md border border-white/10 bg-[#1b1b1b]">
                    <div className="text-center font-mono text-sm text-white/35">
                      <p>strategy runtime</p>
                      <p className="mt-1 text-xs">
                        {strategy?.repo_url ? strategyContainerState : "waiting for repository"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <InfoRow label="Deployment" value={`${deployment.subnet}-${deployment.id.slice(0, 8)}`} />
                  <InfoRow label="Container" value={containerState === "missing" ? "Missing" : containerState} tone={containerState === "running" ? "success" : "muted"} />
                  <InfoRow label="Repository" value={repoName} />
                  <InfoRow label="Source" value={strategy ? `${strategy.branch || "main"} · ${strategy.start_command || "no command"}` : "Connect GitHub repo"} />
                  {strategy?.api_key && (
                    <>
                      <InfoRow label="Signal URL" value={signalPath} />
                      <InfoRow label="Strategy API Key" value={strategy.api_key} />
                    </>
                  )}
                  {metadata.hotkey_address && (
                    <InfoRow label="Miner Hotkey" value={metadata.hotkey_address} />
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <InfoRow
                      label="Status"
                      value={ready ? "Ready" : minerStatus}
                      tone={ready ? "success" : "muted"}
                    />
                    <InfoRow
                      label="Asset"
                      value={deployment.asset_class || metadata.selected_asset_class || "Not selected"}
                    />
                    <InfoRow
                      label="Last Signal"
                      value={metadata.last_test_signal_pair || "No signal yet"}
                    />
                    <InfoRow
                      label="Strategy"
                      value={strategy?.status ? `${strategy.status} · ${strategyContainerState}` : "Not connected"}
                      tone={strategyContainerState === "running" ? "success" : "muted"}
                    />
                  </div>
                </div>
              </div>

              <StrategyRepoForm
                deploymentId={deployment.id}
                initialStrategy={strategy || null}
              />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-3">
              <OverviewCard
                title="Miner"
                value={ready ? "Active" : minerStatus}
                detail={ready ? metadata.miner_submit_url || "REST API available" : "Container missing or stopped"}
              />
              <OverviewCard
                title="Logs"
                value="Strategy logs"
                detail={strategy?.deployed_at ? `Last deploy ${new Date(strategy.deployed_at).toLocaleString()}` : "Available after repository deployment"}
              />
              <OverviewCard
                title="Vanta"
                value="Dashboard"
                detail={
                  metadata.hotkey_address
                    ? "Open Taoshi and search your miner hotkey to inspect PnL and positions"
                    : "Open Taoshi to inspect PnL and positions after the miner appears"
                }
              >
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm text-[#7ee3ea]"
                  href={dashboardUrl}
                  target="_blank"
                >
                  Open dashboard
                  <ExternalLink size={14} />
                </Link>
              </OverviewCard>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "success" | "muted";
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-white/40">{label}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        {tone === "success" && <span className="h-2 w-2 rounded-full bg-[#63d2bd]" />}
        <p className={`truncate text-sm ${tone === "muted" ? "text-white/55" : "text-white"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function OverviewCard({
  children,
  detail,
  title,
  value,
}: {
  children?: React.ReactNode;
  detail: string;
  title: string;
  value: string;
}) {
  return (
    <div className="min-h-40 rounded-lg border border-white/10 bg-[#050505] p-5">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-5 font-mono text-sm text-[#7ee3ea]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-white/45">{detail}</p>
      {children}
    </div>
  );
}
