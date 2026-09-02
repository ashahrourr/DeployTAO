"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeployStrategyButton({
  deploymentId,
  disabled,
}: {
  deploymentId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  async function deployStrategy() {
    setError(null);
    setIsDeploying(true);

    try {
      const res = await fetch(`/api/deployments/${deploymentId}/strategy/deploy`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "strategy deploy failed");
      }

      router.refresh();
    } catch (deployError) {
      setError(deployError instanceof Error ? deployError.message : "strategy deploy failed");
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <div className="relative">
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || isDeploying}
        onClick={deployStrategy}
        type="button"
      >
        <Rocket size={16} />
        {isDeploying ? "Deploying..." : "Deploy Strategy"}
      </button>
      {error && (
        <p className="absolute right-0 top-11 z-10 w-80 rounded-md border border-[#f85149]/40 bg-[#140707] px-3 py-2 text-xs text-[#ff8b82] shadow-xl">
          {error}
        </p>
      )}
    </div>
  );
}
