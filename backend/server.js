// backend/server.js
const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json());

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stderr || error.message,
        });
        return;
      }

      resolve({
        success: true,
        output: stdout.trim(),
      });
    });
  });
}

app.post("/api/deployments/vanta", async (req, res) => {
  const config = req.body;

  console.log("New Vanta local test deployment request:");
  console.log(config);

  const deploymentId = `vanta-${Date.now()}`;

  const pythonCheck = await runCommand("python3 --version");

  return res.json({
    success: pythonCheck.success,
    deploymentId,
    status: pythonCheck.success ? "python_checked" : "failed",
    mode: "local-test",
    steps: [
      {
        name: "Check Python",
        status: pythonCheck.success ? "success" : "failed",
        output: pythonCheck.output,
      },
      {
        name: "Clone Vanta repo",
        status: "pending",
      },
      {
        name: "Install dependencies",
        status: "pending",
      },
      {
        name: "Create test wallet and hotkey",
        status: "pending",
      },
      {
        name: "Register miner on Vanta testnet",
        status: "pending",
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