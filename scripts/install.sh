#!/usr/bin/env bash
set -euo pipefail

REPO="little-pond/axl-light"
PLUGIN_ID="axl-light"
VERSION="${AXL_LIGHT_VERSION:-latest}"
VAULT_PATH="${1:-${OBSIDIAN_VAULT:-}}"

if [[ -z "${VAULT_PATH}" ]]; then
  cat >&2 <<'EOF'
Axl Light installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/little-pond/axl-light/main/scripts/install.sh | bash -s -- "/path/to/your/Obsidian Vault"

Or:
  OBSIDIAN_VAULT="/path/to/your/Obsidian Vault" bash install.sh
EOF
  exit 1
fi

if [[ ! -d "${VAULT_PATH}" ]]; then
  echo "Vault path does not exist: ${VAULT_PATH}" >&2
  exit 1
fi

PLUGIN_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"
mkdir -p "${PLUGIN_DIR}"

if [[ "${VERSION}" == "latest" ]]; then
  BASE_URL="https://github.com/${REPO}/releases/latest/download"
else
  BASE_URL="https://github.com/${REPO}/releases/download/${VERSION}"
fi

download_asset() {
  local name="$1"
  echo "Downloading ${name}..."
  curl -fsSL "${BASE_URL}/${name}" -o "${PLUGIN_DIR}/${name}"
}

download_asset "main.js"
download_asset "manifest.json"
download_asset "styles.css"

cat <<EOF

Axl Light installed successfully.

Plugin folder:
  ${PLUGIN_DIR}

Next steps:
  1. Restart Obsidian.
  2. Open Settings -> Community plugins.
  3. Enable Axl Light.
EOF
