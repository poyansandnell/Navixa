#!/usr/bin/env bash
# =============================================================================
# sync-engine.sh — copy the pure game engine into the Edge Functions tree.
#
# SOURCE OF TRUTH: artifacts/navixa/lib/engine/*
# The engine is pure TypeScript with zero react/react-native/Node-only deps, so
# the exact same source runs unchanged inside Deno Edge Functions.
#
# Edge Functions are deployed independently of the RN app, so they cannot import
# from ../../../lib/engine at deploy time. We therefore keep a *copy* of the
# engine under supabase/functions/_shared/engine and refresh it with this
# script. NEVER hand-edit files in _shared/engine — edit lib/engine and re-run
# this script instead.
#
# Usage (from artifacts/navixa/):
#   bash supabase/functions/scripts/sync-engine.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="$(cd "${FUNCTIONS_DIR}/../.." && pwd)"

SRC="${PROJECT_DIR}/lib/engine"
DEST="${FUNCTIONS_DIR}/_shared/engine"

if [[ ! -d "${SRC}" ]]; then
  echo "error: engine source not found at ${SRC}" >&2
  exit 1
fi

echo "Syncing engine: ${SRC} -> ${DEST}"
rm -rf "${DEST}"
mkdir -p "${DEST}"

# Copy only the .ts source files (skip the __tests__ dir — not needed at runtime).
#
# The RN app resolves extensionless relative imports (e.g. `from './coord'`),
# but Deno requires explicit `.ts` extensions. We therefore rewrite relative
# imports/exports to add the `.ts` extension while copying. lib/engine stays
# untouched (it must keep the extensionless style for the Metro bundler).
for f in "${SRC}"/*.ts; do
  base="$(basename "${f}")"
  sed -E "s/(from|import) '(\.\.?\/[^']+)'/\1 '\2.ts'/g" "${f}" > "${DEST}/${base}"
done

echo "Engine synced (relative imports rewritten to .ts). Files:"
ls -1 "${DEST}"
