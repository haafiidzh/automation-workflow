#!/usr/bin/env bash
# One-line installer for the Orchestrator local agent (Linux x86_64).
#
#   curl -fsSL https://<your-orchestrator-host>/local-agent/install.sh | sh
#
# Installs to ~/.local/bin/orchestrator-agent — no root, no toolchain needed.
set -euo pipefail

BASE_URL="${ORCHESTRATOR_AGENT_BASE_URL:-https://example.invalid/local-agent}"
BIN_NAME="orchestrator-agent-linux-amd64"
DEST_DIR="${ORCHESTRATOR_AGENT_BIN_DIR:-$HOME/.local/bin}"
DEST="$DEST_DIR/orchestrator-agent"

if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
  echo "This installer currently supports Linux x86_64 only." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
TMP="$(mktemp)"
trap 'rm -f "$TMP" "$TMP.sha256"' EXIT

echo "Downloading $BASE_URL/$BIN_NAME …"
curl -fsSL "$BASE_URL/$BIN_NAME" -o "$TMP"

# Verify the checksum when the server publishes one next to the binary.
if curl -fsSL "$BASE_URL/$BIN_NAME.sha256" -o "$TMP.sha256" 2>/dev/null; then
  EXPECTED="$(awk '{print $1}' "$TMP.sha256")"
  ACTUAL="$(sha256sum "$TMP" | awk '{print $1}')"
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "Checksum mismatch — refusing to install." >&2
    exit 1
  fi
fi

install -m 0755 "$TMP" "$DEST"
echo "Installed $DEST"

case ":$PATH:" in
  *":$DEST_DIR:"*) ;;
  *) echo "Note: $DEST_DIR is not on your PATH. Add it to your shell profile." ;;
esac

cat <<'NEXT'

Next steps:
  orchestrator-agent allow /path/to/your/project
  orchestrator-agent allow-origin https://your-orchestrator-host
  orchestrator-agent run
  orchestrator-agent token      # paste this into the Orchestrator web UI
NEXT
