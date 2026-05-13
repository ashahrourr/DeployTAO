"use client";

import { usePathname } from "next/navigation";

const pageNames: Record<string, string> = {
  "/overview": "Overview",
  "/subnets": "Subnets",
  "/deployments": "Deployments",
  "/wallet": "Wallet",
  "/settings": "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const pageName = pageNames[pathname] ?? "DeployTAO";

  return (
    <header className="flex h-14 items-center justify-center border-b border-white/10 bg-black px-6">
      <p className="text-sm font-medium text-white/75">{pageName}</p>
    </header>
  );
}