#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
node_bin="$project_root/.local/node/current/bin/node"
if [[ ! -x "$node_bin" ]]; then
  if [[ -r "$project_root/.local/node-path" ]]; then
    IFS= read -r node_bin < "$project_root/.local/node-path" || true
  fi
fi
if [[ ! -x "$node_bin" ]]; then
  node_bin="$(command -v node || true)"
fi
if [[ "${1:-}" == '--check' ]]; then exec "$node_bin" --version; fi
if [[ $# -gt 0 ]]; then printf 'Argument necunoscut.\n' >&2; exit 1; fi
if [[ -z "$node_bin" ]] || ! "$node_bin" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22 || (major===22 && minor>=13) ? 0 : 1)' >/dev/null 2>&1; then
  printf 'Node.js >=22.13 lipsește. Rulează mai întâi: bash install.sh\n' >&2
  exit 1
fi
cd -- "$project_root"
exec "$node_bin" "$project_root/orar/server.cjs"
