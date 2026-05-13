import { Sidebar } from "@/src/components/sidebar";
import { Topbar } from "@/src/components/topbar";
import { VantaFlow } from "@/src/components/deploy-flows/vanta-flow";
import { ChutesFlow } from "@/src/components/deploy-flows/chutes-flow";

export default async function DeploySubnetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <section className="flex-1">
        <Topbar />

        {id === "vanta" && <VantaFlow />}
        {id === "chutes" && <ChutesFlow />}
      </section>
    </main>
  );
}