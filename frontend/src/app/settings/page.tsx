import { Sidebar } from "@/src/components/sidebar";
import { Topbar } from "@/src/components/topbar";

export default function OverviewPage() {
  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <section className="flex-1">
        <Topbar pathname="/settings" />

        <div className="flex h-[calc(100vh-56px)] items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              DeployTAO
            </h1>

            <p className="mt-3 text-sm text-white/40">
              The operating system for Bittensor participation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
