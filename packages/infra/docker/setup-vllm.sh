#!/usr/bin/env bash
# Wait for the vLLM server to become ready and print loaded models.
# Run this AFTER starting: npm run services:up:vllm
# Note: vLLM downloads models automatically via HUGGING_FACE_HUB_TOKEN on first start.
#       First startup can take several minutes depending on model size.
set -euo pipefail

VLLM_PORT="${1:-8001}"
MAX_WAIT=300
ELAPSED=0
INTERVAL=5

echo "Waiting for vLLM server on port ${VLLM_PORT}..."
until curl -sf "http://localhost:${VLLM_PORT}/v1/models" > /dev/null 2>&1; do
  if [ "${ELAPSED}" -ge "${MAX_WAIT}" ]; then
    echo "ERROR: vLLM did not become ready within ${MAX_WAIT}s." >&2
    echo "Check logs: npm run vllm:logs" >&2
    exit 1
  fi
  sleep "${INTERVAL}"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "vLLM is ready! Loaded models:"
curl -s "http://localhost:${VLLM_PORT}/v1/models" | python3 -m json.tool
