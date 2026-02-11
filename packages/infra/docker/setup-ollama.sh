#!/usr/bin/env bash
# Pull an Ollama model into the taco_ollama container.
# Run this AFTER starting: npm run services:up:ollama
# Usage: ./setup-ollama.sh [model_name]
#   Default model: llama3.2
set -euo pipefail

MODEL="${1:-llama3.2}"
CONTAINER="taco_ollama"

echo "Pulling Ollama model '${MODEL}' into container '${CONTAINER}'..."
docker exec "${CONTAINER}" ollama pull "${MODEL}"
echo "Model '${MODEL}' is ready."
