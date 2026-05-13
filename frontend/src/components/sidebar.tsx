"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Boxes,
  LayoutDashboard,
  Server,
  Settings,
  Wallet,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Subnets", href: "/subnets", icon: Boxes },
  { label: "Deployments", href: "/deployments", icon: Server },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 border-r border-white/10 bg-black p-4 text-white md:flex md:flex-col">
      <div className="mb-8 px-2">
        <h1 className="text-[15px] font-semibold tracking-tight text-white">
          DeployTAO
        </h1>

        <p className="mt-1 text-xs text-white/35">
          Bittensor operating system
        </p>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;

          return (
            <Link
              key={label}
              href={href}
              className={`group flex h-9 w-full items-center rounded-xl px-3 text-sm transition ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={16} strokeWidth={2.1} />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}