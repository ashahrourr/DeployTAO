// frontend/src/app/subnets/[id]/page.tsx
import { Sidebar } from "@/src/components/sidebar";
import { Topbar } from "@/src/components/topbar";
import Link from "next/link";

type Subnet = {
  name: string;
  description: string;
  difficulty: string;
  estimatedCost: string;
  hardware: string;
  rewards: string;
};

const subnetData: Record<string, Subnet> = {
  vanta: {
    name: "Vanta",
    description:
      "Trading-focused subnet where miners submit market signals and compete by PnL, drawdown, and risk discipline.",
    difficulty: "Medium",
    estimatedCost: "2 vCPU + 8 GB RAM, plus 300-1000 Theta collateral",
    hardware: "CPU server",
    rewards: "Variable, performance-based",
  },

  chutes: {
    name: "Chutes",
    description:
      "Inference infrastructure subnet focused on scalable AI serving.",
    difficulty: "Medium",
    estimatedCost: "$400–900/mo",
    hardware: "RTX 4090 or higher",
    rewards: "Variable",
  },

  nova: {
    name: "NOVA",
    description:
      "Model competition subnet for advanced AI training and evaluation.",
    difficulty: "Hard",
    estimatedCost: "$800–2000/mo",
    hardware: "A100 / H100",
    rewards: "High variance",
  },
};

export default async function SubnetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const subnet = subnetData[id];

  if (!subnet) {
    return null;
  }

  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <section className="flex-1">
        <Topbar pathname="/subnets" />

        <div className="mx-auto max-w-3xl px-8 py-14">
          <h1 className="text-4xl font-semibold tracking-tight">
            {subnet.name}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">
            {subnet.description}
          </p>

          <div className="mt-12 space-y-6 border-t border-white/10 pt-10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">
                Difficulty
              </p>

              <p className="text-sm text-white/80">
                {subnet.difficulty}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">
                Monthly cost
              </p>

              <p className="text-sm text-white/80">
                {subnet.estimatedCost}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">
                Hardware
              </p>

              <p className="text-sm text-white/80">
                {subnet.hardware}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">
                Rewards
              </p>

              <p className="text-sm text-white/80">
                {subnet.rewards}
              </p>
            </div>
          </div>

          <div className="mt-14 border-t border-white/10 pt-10">
            <h2 className="text-xl font-semibold">
              Ready to participate?
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
              DeployTAO handles infrastructure setup, deployment,
              configuration, and monitoring so you can focus on strategy.
            </p>

            <Link
  href={`/subnets/${id}/deploy`}
  className="inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-medium text-black transition hover:bg-white/90"
>
  Deploy miner
</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
