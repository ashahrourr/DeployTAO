"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type StrategyConfig = {
  branch?: string;
  repo_url?: string;
  start_command?: string;
  status?: string;
};

type GitHubRepo = {
  defaultBranch: string;
  fullName: string;
  private: boolean;
  pushedAt: string | null;
  url: string;
};

export function StrategyRepoForm({
  deploymentId,
  initialStrategy,
}: {
  deploymentId: string;
  initialStrategy?: StrategyConfig | null;
}) {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState(initialStrategy?.repo_url || "");
  const [branch, setBranch] = useState(initialStrategy?.branch || "main");
  const [startCommand, setStartCommand] = useState(
    initialStrategy?.start_command || "python main.py",
  );
  const [error, setError] = useState<string | null>(null);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(initialStrategy?.repo_url));
  const [repos, setRepos] = useState<GitHubRepo[]>([]);

  useEffect(() => {
    let active = true;

    async function loadRepos() {
      setIsLoadingRepos(true);

      try {
        const res = await fetch(`/api/github/repos?deploymentId=${deploymentId}`);
        const data = await res.json().catch(() => ({}));

        if (!active) return;

        if (!res.ok) {
          setConnectUrl(data.connectUrl || `/api/github/connect?deploymentId=${deploymentId}`);
          setError(data.error || "Connect GitHub to choose a repo.");
          return;
        }

        setRepos(data.repos || []);
        setConnectUrl(null);
        setError(null);
      } catch {
        if (active) {
          setError("Could not load GitHub repositories.");
        }
      } finally {
        if (active) {
          setIsLoadingRepos(false);
        }
      }
    }

    loadRepos();

    return () => {
      active = false;
    };
  }, [deploymentId]);

  async function saveStrategy() {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/deployments/${deploymentId}/strategy`, {
        body: JSON.stringify({
          branch,
          repoUrl,
          startCommand,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "failed to save strategy");
      }

      setIsSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "failed to save strategy");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="border-t border-white/10">
      <div className="px-5 py-5">
        <p className="font-mono text-sm text-white/45">source</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">GitHub repository</h2>

        <div className="mt-5 space-y-4 font-mono text-sm">
          {connectUrl ? (
            <a
              className="inline-flex rounded-md border border-white/15 px-3 py-2 text-white transition hover:border-white/30 hover:bg-white/[0.04]"
              href={connectUrl}
            >
              Connect GitHub
            </a>
          ) : (
            <label className="block">
              <span className="text-white/45">repository</span>
              <select
                className="mt-2 w-full border border-white/10 bg-[#111] px-3 py-2 text-white outline-none focus:border-[#1b8088]"
                disabled={isLoadingRepos}
                value={repoUrl}
                onChange={(event) => {
                  const selectedRepo = repos.find((repo) => repo.url === event.target.value);

                  setRepoUrl(event.target.value);
                  setBranch(selectedRepo?.defaultBranch || "main");
                  setIsSaved(false);
                }}
              >
                <option value="">
                  {isLoadingRepos ? "Loading repositories..." : "Select repository"}
                </option>
                {repos.map((repo) => (
                  <option key={repo.fullName} value={repo.url}>
                    {repo.fullName}
                    {repo.private ? " private" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-white/45">branch</span>
            <input
              className="mt-2 w-full border border-white/10 bg-[#111] px-3 py-2 text-white outline-none focus:border-[#1b8088]"
              value={branch}
              onChange={(event) => {
                setBranch(event.target.value);
                setIsSaved(false);
              }}
            />
          </label>

          <label className="block">
            <span className="text-white/45">start command</span>
            <input
              className="mt-2 w-full border border-white/10 bg-[#111] px-3 py-2 text-white outline-none focus:border-[#1b8088]"
              value={startCommand}
              onChange={(event) => {
                setStartCommand(event.target.value);
                setIsSaved(false);
              }}
            />
          </label>

          <button
            className="rounded-md border border-white/15 px-3 py-2 text-white transition hover:border-white/30 hover:bg-white/[0.04] disabled:opacity-50"
            disabled={isSaving || Boolean(connectUrl)}
            onClick={saveStrategy}
            type="button"
          >
            {isSaving ? "Saving..." : "Save repository"}
          </button>

          {isSaved && <p className="text-[#3fb950]">strategy repo connected</p>}
          {error && <p className="text-[#f85149]">x {error}</p>}
        </div>
      </div>
    </section>
  );
}
