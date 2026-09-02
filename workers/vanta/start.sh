#!/bin/sh
set -eu

NETWORK="${NETWORK:-test}"
NETUID="${NETUID:-116}"

echo "deploytao: vanta container booted"
echo "deploytao: deployment=${DEPLOYMENT_ID:-unknown}"
echo "deploytao: network=${NETWORK}"
echo "deploytao: netuid=${NETUID}"
echo "deploytao: asset_class=${ASSET_CLASS:-unset}"

if [ -z "${WALLET_NAME:-}" ] || [ -z "${WALLET_HOTKEY:-}" ]; then
  echo "deploytao: wallet not configured yet"
  echo "deploytao: container is alive and waiting for wallet setup"
  tail -f /dev/null
fi

exec python neurons/miner.py \
  --netuid "${NETUID}" \
  --subtensor.network "${NETWORK}" \
  --wallet.name "${WALLET_NAME}" \
  --wallet.hotkey "${WALLET_HOTKEY}" \
  --logging.debug
