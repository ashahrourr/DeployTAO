// backend/server.js
const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const pty = require("node-pty");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Wallet and hotkey names are interpolated into shell commands, so they are
// restricted to a character set that cannot escape the quoting. btcli itself
// only accepts names in this shape, so nothing legitimate is lost.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function isSafeName(value) {
  return typeof value === "string" && SAFE_NAME.test(value);
}

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stderr || error.message });
        return;
      }

      resolve({ success: true, output: stdout.trim() || stderr.trim() });
    });
  });
}

function runInteractiveCommand(command, inputs = []) {
  return new Promise((resolve) => {
    let output = "";

    const shell = pty.spawn("bash", ["-lc", command], {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    shell.onData((data) => {
      output += data;
      const lower = output.toLowerCase();

      if (lower.includes("password") && inputs.length > 0) {
        shell.write(inputs.shift() + "\r");
      }

      if (
        (lower.includes("do you want to continue") ||
          lower.includes("recycle") ||
          lower.includes("confirm")) &&
        inputs.length > 0
      ) {
        shell.write(inputs.shift() + "\r");
      }
    });

    shell.onExit(({ exitCode }) => {
      resolve({
        success: exitCode === 0,
        output: output.slice(-3000),
      });
    });
  });
}

app.post("/api/deployments/vanta", async (req, res) => {
  const config = req.body;
  const { walletName, hotkeyName, walletPassword } = config;

  if (!walletName || !hotkeyName || !walletPassword) {
    return res.status(400).json({
      success: false,
      error: "Missing walletName, hotkeyName, or walletPassword",
    });
  }

  if (!isSafeName(walletName) || !isSafeName(hotkeyName)) {
    return res.status(400).json({
      success: false,
      error:
        "walletName and hotkeyName must be 1-64 characters, letters, digits, hyphen or underscore, starting with a letter or digit.",
    });
  }

  console.log("New Vanta local test deployment request:");
  console.log({
    ...config,
    walletPassword: "[hidden]",
  });

  const deploymentId = `vanta-${Date.now()}`;
  const deploymentDir = path.join(__dirname, "deployments", deploymentId);
  const vantaDir = path.join(deploymentDir, "vanta-network");

  fs.mkdirSync(deploymentDir, { recursive: true });

  const pythonCheck = await runCommand("python3 --version");

  let cloneRepo = {
    success: false,
    output: "Skipped because Python check failed.",
  };

  if (pythonCheck.success) {
    cloneRepo = await runCommand(
      `git clone https://github.com/taoshidev/vanta-network.git "${vantaDir}"`
    );
  }

  let installDeps = {
    success: false,
    output: "Skipped because repo clone failed.",
  };

  if (cloneRepo.success) {
    installDeps = await runCommand(
      `cd "${vantaDir}" && python3 -m venv venv && . venv/bin/activate && export PIP_NO_CACHE_DIR=1 && pip install -r requirements.txt && python3 -m pip install -e .`
    );
  }

  let createColdkey = {
    success: false,
    output: "Skipped because dependencies failed.",
  };

  let createHotkey = {
    success: false,
    output: "Skipped because coldkey creation failed.",
  };

  if (installDeps.success) {
    createColdkey = await runInteractiveCommand(
      `btcli wallet new_coldkey --wallet.name "${walletName}"`,
      [walletPassword, walletPassword, "y"]
    );
  }

  if (createColdkey.success) {
    createHotkey = await runInteractiveCommand(
      `btcli wallet new_hotkey --wallet.name "${walletName}" --wallet.hotkey "${hotkeyName}"`,
      [walletPassword, walletPassword, "y"]
    );
  }

  let registerMiner = {
    success: false,
    output: "Skipped because hotkey creation failed.",
  };

  if (createHotkey.success) {
    registerMiner = await runInteractiveCommand(
      `btcli subnet register --wallet.name "${walletName}" --wallet.hotkey "${hotkeyName}" --subtensor.network test --netuid 116`,
      [walletPassword, "y", "y"]
    );
  }

  const walletCreated = createColdkey.success && createHotkey.success;
  const minerRegistered = walletCreated && registerMiner.success;

  return res.json({
    success:
      pythonCheck.success &&
      cloneRepo.success &&
      installDeps.success &&
      walletCreated &&
      minerRegistered,

    deploymentId,

    status: minerRegistered ? "miner_registered" : "failed",

    mode: "local-test",

    wallet: {
      walletName,
      hotkeyName,
    },

    steps: [
      {
        name: "Check Python",
        status: pythonCheck.success ? "success" : "failed",
        output: pythonCheck.output,
      },
      {
        name: "Clone Vanta repo",
        status: cloneRepo.success ? "success" : "failed",
        output: cloneRepo.output,
      },
      {
        name: "Install dependencies",
        status: installDeps.success ? "success" : "failed",
        output: installDeps.output,
      },
      {
        name: "Create coldkey",
        status: createColdkey.success ? "success" : "failed",
        output: createColdkey.output,
      },
      {
        name: "Create hotkey",
        status: createHotkey.success ? "success" : "failed",
        output: createHotkey.output,
      },
      {
        name: "Register miner on Vanta testnet",
        status: registerMiner.success ? "success" : "failed",
        output: registerMiner.output,
      },
      {
        name: "Start miner process",
        status: "pending",
      },
    ],
  });
});

app.listen(4000, () => {
  console.log("Backend running on http://localhost:4000");
});