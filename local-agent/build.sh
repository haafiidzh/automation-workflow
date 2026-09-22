#!/usr/bin/env bash
# Builds the Linux (x86_64) release binary into dist/ with a checksum.
# Cross-platform builds are deliberately out of scope for this pass.
set -euo pipefail

cd "$(dirname "$0")"
VERSION="$(grep -oP 'version = "\K[^"]+' main.go)"
OUT="dist/orchestrator-agent-linux-amd64"

mkdir -p dist
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o "$OUT" .
sha256sum "$OUT" > "$OUT.sha256"

echo "built $OUT (version $VERSION)"
sha256sum -c "$OUT.sha256"
