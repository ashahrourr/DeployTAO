// frontend/src/app/subnets/page.tsx
import { Sidebar } from "@/src/components/sidebar";
import { Topbar } from "@/src/components/topbar";
import Link from "next/link";

const subnets = [
  {
    name: "Chutes",
    netuid: "64",
    description: "Inference infrastructure",
    emissions: "12.4%",
    difficulty: "Medium",
  },
  {
    name: "NOVA",
    netuid: "25",
    description: "Model competition",
    emissions: "18.1%",
    difficulty: "Hard",
  },
  {
    name: "RESI",
    netuid: "46",
    description: "Real estate intelligence",
    emissions: "8.7%",
    difficulty: "Hard",
  },
  {
    name: "Vanta",
    netuid: "71",
    description: "Trading strategies",
    emissions: "15.2%",
    difficulty: "Medium",
  },
];

export default function SubnetsPage() {
  return (
    <main className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <section className="flex-1">
        <Topbar />

        <div className="p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex h-11 w-full max-w-md items-center rounded-xl border border-white/10 bg-white/[0.03] px-4">
              <span className="mr-3 text-white/30">⌕</span>

              <input
                placeholder="Search subnets..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
              />
            </div>

            <button className="h-11 rounded-xl border border-white/10 px-4 text-sm text-white/60 hover:bg-white/[0.05] hover:text-white">
              Filters
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="grid grid-cols-[1.6fr_0.8fr_1fr_1fr_120px] border-b border-white/10 px-5 py-3 text-xs text-white/35">
              <p>Subnet</p>
              <p>Netuid</p>
              <p>Emissions</p>
              <p>Difficulty</p>
              <p></p>
            </div>

            {subnets.map((subnet) => (
              <div
                key={subnet.name}
                className="grid grid-cols-[1.6fr_0.8fr_1fr_1fr_120px] items-center border-b border-white/10 px-5 py-4 transition hover:bg-white/[0.03] last:border-b-0"
              >
                <div>
                  <p className="font-medium">{subnet.name}</p>

                  <p className="mt-1 text-sm text-white/40">
                    {subnet.description}
                  </p>
                </div>

                <p className="text-sm text-white/60">
                  {subnet.netuid}
                </p>

                <p className="text-sm text-white/60">
                  {subnet.emissions}
                </p>

                <p className="text-sm text-white/60">
                  {subnet.difficulty}
                </p>

                <Link
  href={`/subnets/${subnet.name.toLowerCase()}`}
  className="rounded-lg border border-white/10 px-3 py-2 text-center text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white"
>
  View
</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}