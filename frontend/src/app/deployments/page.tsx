import { execFile } from "node:child_process";
import { promisify } from "node:util";

import Link from "next/link";
import { redirect } from "next/navigation";

import { Sidebar } from "@/src/components/sidebar";
import { RemoveDeploymentButton } from "@/src/components/deployments/remove-deployment-button";
import { Topbar } from "@/src/components/topbar";
import { createClient } from "@/src/lib/supabase/server";

type DeploymentMetadata = {
  container_name?: string;
  last_test_signal_pair?: string;
};

const execFileAsync = promisify(execFile);

async function getContainerState(containerName?: string) {
  if (!containerName) return "missing";

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

export default async function DeploymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: deployments } = await supabase
    .from("deployments")
    .select("id,subnet,network,status,asset_class,metadata,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <section className="flex-1">
        <Topbar pathname="/deployments" />

        <div className="h-[calc(100vh-56px)] overflow-y-auto px-8 py-7">
          <div className="max-w-5xl">
            <p className="font-mono text-sm text-[#1b8088]">deployments</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Miner deployments
            </h1>

            <div className="mt-7 divide-y divide-white/10 border border-white/10">
              {await Promise.all((deployments || []).map(async (deployment) => {
                const metadata =
                  deployment.metadata && typeof deployment.metadata === "object"
                    ? (deployment.metadata as DeploymentMetadata)
                    : {};
                const abandonedStatuses = new Set([
                  "awaiting_wallet",
                  "draft",
                  "provisioning",
                ]);

                if (abandonedStatuses.has(deployment.status)) {
                  await supabase
                    .from("deployments")
                    .delete()
                    .eq("id", deployment.id)
                    .eq("user_id", user.id);

                  return null;
                }

                const containerState = await getContainerState(metadata.container_name);

                if (
                  metadata.container_name &&
                  containerState === "missing"
                ) {
                  await supabase
                    .from("deployments")
                    .delete()
                    .eq("id", deployment.id)
                    .eq("user_id", user.id);

                  return null;
                }

                const status =
                  deployment.status === "running" && containerState !== "running"
                    ? "stopped"
                    : deployment.status;

                return (
                  <div
                    className="grid gap-3 px-4 py-4 font-mono text-sm hover:bg-white/[0.03] md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
                    key={deployment.id}
                  >
                    <Link href={`/deployments/${deployment.id}`}>{deployment.subnet}</Link>
                    <span className="text-white/50">{deployment.network}</span>
                    <span className="text-white/50">{status}</span>
                    <span className="text-white/50">{deployment.asset_class || "asset unset"}</span>
                    <span className="text-white/50">
                      {metadata.last_test_signal_pair || "no test trade"}
                    </span>
                    <RemoveDeploymentButton deploymentId={deployment.id} />
                  </div>
                );
              })).then((items) => items.filter(Boolean))}
              {(!deployments || deployments.length === 0) && (
                <div className="px-4 py-8 font-mono text-sm text-white/45">
                  no deployments yet
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
