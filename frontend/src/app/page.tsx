export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">DeployTAO</div>
          <button className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
            Join waitlist
          </button>
        </nav>

        <div className="flex flex-1 items-center">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
              Bittensor mining OS
            </p>

            <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
              Deploy and manage Bittensor miners without the infra headache.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
              Discover subnets, rent GPUs, deploy miners, monitor performance,
              manage wallets, and benchmark strategies from one dashboard.
            </p>

            <div className="mt-8 flex gap-3">
              <button className="rounded-full bg-white px-6 py-3 text-sm font-medium text-black">
                Explore subnets
              </button>
              <button className="rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-white/80">
                View dashboard
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}