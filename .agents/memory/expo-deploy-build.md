---
name: Expo deploy build pitfalls
description: Why the Navixa mobile publish build can fail even when dev Metro works
---

**Rule:** The publish build runs a fresh `pnpm install` + clean-cache Metro. Two failure modes seen:
1. Stale `pnpm-lock.yaml` — if package.json (often from user's local commits) drifts from the lockfile, the deploy installs a different dependency set than dev and Metro bundling 500s. Check with `pnpm install --frozen-lockfile --lockfile-only`.
2. pnpm strict layout — Babel presets used by Metro (e.g. `babel-preset-expo`) must be explicit deps of the Expo artifact, or transform workers fail with "Cannot find module".

**Why:** Dev Metro runs with cached, already-hoisted state, so both problems stay invisible until publish.

**How to apply:** Reproduce deploy failures by running the artifact's `scripts/build.js` locally (kill port 8081 first — mockup-sandbox holds it in dev, restart its workflow after). `expo export` shows the real bundler error but its hermesc bytecode step is NOT part of the deploy path — ignore hermesc failures there. Build errors from Metro HTTP fetch hide the message; curl the bundle URL (with the /artifacts/navixa prefix) to see the JSON error body.
