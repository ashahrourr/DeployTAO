// frontend/src/components/deploy-flows/vanta-flow.tsx
"use client";

import { useState } from "react";

type Step =
  | "environment"
  | "wallet"
  | "asset"
  | "collateral"
  | "signals"
  | "infrastructure"
  | "deploying"
  | "complete";

export function VantaFlow() {
  const [step, setStep] = useState<Step>("environment");
  const [environment, setEnvironment] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [asset, setAsset] = useState<string | null>(null);
  const [collateral, setCollateral] = useState<string | null>(null);
  const [signals, setSignals] = useState<string | null>(null);
  const [infra, setInfra] = useState<string | null>(null);
  const [deploymentSteps, setDeploymentSteps] = useState<
  { name: string; status: string; output?: string }[]
>([]);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("");
const [hotkeyName, setHotkeyName] = useState("");
const [walletPassword, setWalletPassword] = useState("");

  async function startDeploy() {
    setStep("deploying");

    const res = await fetch("http://localhost:4000/api/deployments/vanta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        environment,
        wallet,
        walletName,
hotkeyName,
walletPassword,
        asset,
        collateral,
        signals,
        infra,
        
      }),
    });

    if (!res.ok) {
      alert("Deployment failed");
      setStep("infrastructure");
      return;
    }

    const data = await res.json();

    setDeploymentId(data.deploymentId);
    setDeploymentSteps(data.steps || []);
    setStep("complete");
  }

  return (
    <div className="flex h-[calc(100vh-56px)] items-start justify-center bg-[#151515] px-4 py-5">
      <div className="w-full max-w-5xl overflow-hidden rounded-md border border-[#3f3f3f] bg-[#1f1f1f] shadow-[0_18px_55px_rgba(0,0,0,0.55)]">
        <div className="flex h-9 items-center border-b border-[#3a3a3a] bg-[#2d2d2d] px-3 font-mono text-[12px] text-[#c9c9c9]">
          <span className="mr-2 text-[#1b8088]">deploytao</span>
          <span className="text-[#6f6f6f]">/</span>
          <span className="ml-2 text-[#a8a8a8]">vanta local test setup</span>
        </div>

        <div className="h-[calc(100vh-138px)] overflow-y-auto overscroll-contain px-4 py-3 font-mono text-[12px] leading-5 text-[#e6e6e6]">
          <div className="mb-3 text-[#8a8a8a]">
            <span className="text-[#1b8088]">ash@deploytao</span>:~/subnets/vanta$ ./configure
          </div>

          <div className="space-y-3">
            <p className="text-[#9a9a9a]">booting vanta local test wizard...</p>

            <StepBlock title="select environment" show>
              <Option
                active={environment === "testnet"}
                label="[1] Testnet"
                hint="recommended for testing"
                onClick={() => {
                  setEnvironment("testnet");
                  setStep("wallet");
                }}
              />
            </StepBlock>

            {environment && <Done label="environment selected" value={environment} />}

            <StepBlock title="wallet setup" show={step !== "environment"}>
  <div className="space-y-2 pl-1">
    <input
      value={walletName}
      onChange={(e) => setWalletName(e.target.value)}
      placeholder="wallet name e.g. mido-wallet"
      className="w-full rounded border border-[#3a3a3a] bg-black/30 px-2 py-1 text-[#e6e6e6] outline-none"
    />

    <input
      value={hotkeyName}
      onChange={(e) => setHotkeyName(e.target.value)}
      placeholder="hotkey name e.g. vanta-miner-1"
      className="w-full rounded border border-[#3a3a3a] bg-black/30 px-2 py-1 text-[#e6e6e6] outline-none"
    />

    <input
      value={walletPassword}
      onChange={(e) => setWalletPassword(e.target.value)}
      placeholder="wallet password"
      type="password"
      className="w-full rounded border border-[#3a3a3a] bg-black/30 px-2 py-1 text-[#e6e6e6] outline-none"
    />

    <button
      onClick={() => {
        setWallet("deploytao managed wallet");
        setStep("asset");
      }}
      disabled={!walletName || !hotkeyName || !walletPassword}
      className="rounded-sm px-2 py-0.5 text-[#1b8088] transition hover:bg-white/[0.04] disabled:text-[#555]"
    >
      create managed wallet
    </button>
  </div>
</StepBlock>

            {wallet && <Done label="wallet setup" value={wallet} />}

            <StepBlock title="select asset class" show={["asset", "collateral", "signals", "infrastructure", "deploying", "complete"].includes(step)}>
              {["Crypto", "Forex", "Equities", "Commodities"].map((item, i) => (
                <Option
                  key={item}
                  active={asset === item.toLowerCase()}
                  label={`[${i + 1}] ${item}`}
                  onClick={() => {
                    setAsset(item.toLowerCase());
                    setStep("collateral");
                  }}
                />
              ))}
            </StepBlock>

            {asset && <Done label="asset class selected" value={asset} />}

            <StepBlock title="collateral" show={["collateral", "signals", "infrastructure", "deploying", "complete"].includes(step)}>
              <Option
                active={collateral === "testnet"}
                label="[1] Testnet collateral"
                hint="fake/test only"
                onClick={() => {
                  setCollateral("testnet collateral");
                  setStep("signals");
                }}
              />
            </StepBlock>

            {collateral && <Done label="collateral selected" value={collateral} />}

            <StepBlock title="strategy connection" show={["signals", "infrastructure", "deploying", "complete"].includes(step)}>
              <Option
                active={signals === "manual"}
                label="[1] Manual test signal"
                hint="press button later to test one trade"
                onClick={() => {
                  setSignals("manual test signal");
                  setStep("infrastructure");
                }}
              />
              <Option
                active={signals === "later"}
                label="[2] Connect strategy later"
                hint="start miner first"
                onClick={() => {
                  setSignals("connect later");
                  setStep("infrastructure");
                }}
              />
            </StepBlock>

            {signals && <Done label="strategy option selected" value={signals} />}

            <StepBlock title="where should this run?" show={["infrastructure", "deploying", "complete"].includes(step)}>
              <Option
                active={infra === "local"}
                label="[1] Local test mode"
                hint="runs on your laptop, testnet only"
                onClick={() => setInfra("local")}
              />
              <Option
                active={infra === "custom"}
                label="[2] Bring your own server"
                hint="coming later"
                onClick={() => setInfra("custom server")}
              />
              <Option
                active={infra === "managed"}
                label="[3] DeployTAO managed server"
                hint="coming soon"
                onClick={() => setInfra("managed server")}
              />
            </StepBlock>

            {infra && (
              <>
                <Done label="infrastructure selected" value={infra} />

                {step === "infrastructure" && infra === "local" && (
                  <div className="space-y-2">
                    <div className="rounded border border-[#3a3a3a] bg-black/20 p-3 text-[#9a9a9a]">
                      <p className="text-[#f2f2f2]">Local test mode will:</p>
                      <p>✓ use Vanta testnet</p>
                      <p>✓ set up miner locally</p>
                      <p>✓ start signal API on localhost:8088</p>
                      <p>✓ use no real money</p>
                    </div>

                    <button
                      onClick={startDeploy}
                      className="block rounded-sm px-2 py-0.5 text-left text-[#1b8088] transition hover:bg-white/[0.04]"
                    >
                      ash@deploytao:~/subnets/vanta$ start local test setup
                    </button>
                  </div>
                )}
              </>
            )}

            {step === "deploying" && (
              <div className="space-y-0.5 text-[#9a9a9a]">
                <p>⏳ creating deployment job...</p>
              </div>
            )}

            {step === "complete" && (
              <div className="space-y-1">
                <p className="text-[#3fb950]">✓ deployment created</p>
                {deploymentId && (
                  <p className="text-[#9a9a9a]">deployment id: {deploymentId}</p>
                )}

                <div className="mt-2 space-y-0.5 text-[#9a9a9a]">
                  {deploymentSteps.map((item) => (
  <div key={item.name}>
    <p>
      {item.status === "success" && "✓"}
      {item.status === "failed" && "✕"}
      {item.status === "pending" && "○"} {item.name}
    </p>

    {item.output && (
      <p className="pl-4 text-[#666]">{item.output}</p>
    )}
  </div>
))}
                </div>

                <p className="pt-2 text-[#666]">
                  Next step: we will replace these fake steps with real terminal commands.
                </p>
              </div>
            )}

            <div className="pt-6 text-[11px] text-[#666]">deploytao v0.1 alpha</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBlock({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;

  return (
    <div>
      <p className="mb-1 text-[#f2f2f2]">&gt; {title}</p>
      <div className="space-y-0.5 pl-4">{children}</div>
    </div>
  );
}

function Option({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center rounded-sm px-1.5 py-0.5 text-left transition ${
        active
          ? "text-[#1b8088]"
          : "text-[#9a9a9a] hover:bg-white/[0.04] hover:text-[#1b8088]"
      }`}
    >
      <span
        className={`mr-2 h-1.5 w-1.5 rounded-full ${
          active ? "bg-[#1b8088]" : "border border-[#777]"
        }`}
      />
      <span>{label}</span>
      {hint && <span className="ml-2 text-[#666]"># {hint}</span>}
    </button>
  );
}

function Done({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[#3fb950]">
      ok {label}: <span className="text-[#f2f2f2]">{value}</span>
    </p>
  );
}