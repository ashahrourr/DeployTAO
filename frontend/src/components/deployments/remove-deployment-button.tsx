"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveDeploymentButton({ deploymentId }: { deploymentId: string }) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeDeployment() {
    setIsRemoving(true);

    const res = await fetch(`/api/deployments/${deploymentId}`, {
      method: "DELETE",
    });

    setIsRemoving(false);

    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      className="text-left text-white/35 hover:text-[#f85149] disabled:opacity-50"
      disabled={isRemoving}
      onClick={removeDeployment}
      type="button"
    >
      {isRemoving ? "removing..." : "remove"}
    </button>
  );
}
