# DeployTAO

**One-click deployment for Bittensor miners.**

Running a miner on a Bittensor subnet normally means: install Python, clone the subnet repo,
install its dependencies, create a coldkey, create a hotkey, register on the subnet, then keep the
process alive. Every step is a terminal, and several of them are *interactive* — `btcli` stops and
waits for a password or a confirmation.

This wraps that whole sequence behind a web app.

---

## The interesting problem: btcli will not be scripted

`btcli` prompts. It asks for a wallet password, then asks again to confirm, then asks whether you
are sure you want to spend TAO to register. Piping into it does not work reliably, and `exec` just
hangs waiting on a TTY that is not there.

So the backend spawns a **real pseudo-terminal** and answers the prompts as they arrive:

```js
const pty = require("node-pty");

function runInteractiveCommand(command, inputs = []) {
  const shell = pty.spawn("bash", ["-lc", command], {
    name: "xterm-color", cols: 120, rows: 30, cwd: process.cwd(),
  });
  // ...feed `inputs` as the prompts come back
}
```

That is the core of it. Everything else is orchestration around that one capability.

---

## What a deployment does

```
POST /api/deployments/vanta
    │
    ├─ python3 --version                          is the host usable
    ├─ git clone taoshidev/vanta-network          the subnet code
    ├─ install dependencies
    ├─ btcli wallet new_coldkey                   ← interactive
    ├─ btcli wallet new_hotkey                    ← interactive
    ├─ btcli subnet register --netuid 116         ← interactive, spends TAO
    └─ run the miner in a container
```

Each deployment gets its own directory and id. The miner then runs from `workers/vanta` — a
container that boots, waits if no wallet is configured yet, and otherwise execs
`python neurons/miner.py` against the configured `netuid` and network.

---

## Layout

```
backend/          Express + node-pty. Runs the CLI, drives the prompts
workers/vanta/    Dockerfile + start.sh for the miner container
supabase/         migrations
  001  deployments
  002  user_wallets
  003  user_integrations
  004  get_deployment_for_signal / update_deployment_signal   (RPC)
frontend/         Next.js — overview, subnet browser, deploy flow,
                  deployments, wallet, settings, login
```

Two deploy flows are implemented — **Vanta** and **Chutes** — since subnets differ in how a miner
is registered and run.

---

## Running it

```bash
cd backend  && npm install && node server.js
cd frontend && npm install && npm run dev
```

The host needs `python3`, `git` and `btcli` on the path. Supabase migrations in `supabase/` create
the schema.

---

## Status

Early. Two commits, one working subnet flow, testnet only — the register step is pinned to
`--subtensor.network test --netuid 116`.

⚠️ **Not production hardened.** The backend executes shell commands on the host by design, which is
the whole point of the tool and also its largest risk. Wallet and hotkey names are validated against
`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` before they reach a command line, but this is not something to
expose to untrusted users without sandboxing each deployment.

## Stack

**Backend** — Node · Express · node-pty · Docker
**Frontend** — Next.js · TypeScript · Tailwind
**Data** — Supabase (Postgres + RPC)
**Chain** — Bittensor / `btcli`
