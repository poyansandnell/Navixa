---
name: Expo deploy build pitfalls
description: Why the Navixa mobile publish build can fail even when dev Metro works
---

**Rule:** The publish build runs a fresh `pnpm install` + clean-cache Metro. Two failure modes seen:
1. Stale `pnpm-lock.yaml` — if package.json (often from user's local commits) drifts from the lockfile, the deploy installs a different dependency set than dev and Metro bundling 500s. Check with `pnpm install --frozen-lockfile --lockfile-only`.
2. pnpm strict layout — Babel presets used by Metro (e.g. `babel-preset-expo`) must be explicit deps of the Expo artifact, or transform workers fail with "Cannot find module".

**Why:** Dev Metro runs with cached, already-hoisted state, so both problems stay invisible until publish.

**How to apply:** Reproduce deploy failures by running the artifact's `scripts/build.js` locally (kill port 8081 first — mockup-sandbox holds it in dev, restart its workflow after). `expo export` shows the real bundler error but its hermesc bytecode step is NOT part of the deploy path — ignore hermesc failures there. Build errors from Metro HTTP fetch hide the message; curl the bundle URL (with the /artifacts/navixa prefix) to see the JSON error body.

## Clerk på webben i produktion (aug 2026)
- Prod-webben blev helt blank: clerk-js försökte laddas från `https://clerk.<domän>` (härledd ur pk_live) → cert-fel → `ClerkLoaded` blockerade allt. Fix: build-skriptet sätter `EXPO_PUBLIC_CLERK_PROXY_URL=https://<domän>/api/__clerk` för både webb-export och Metro.
- EXPO_PUBLIC_*-inlining fungerar, MEN: om `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` saknas vid export dödkods-elimineras hela Clerk-trädet (inkl. proxy-URL:en) — lokala tester måste sätta pk-nyckeln för att se att proxy-URL bakas in.
- Metros transformcache ligger i `/tmp/metro-cache` (inte i projektet) — rensa den vid env-ändringar, annars återanvänds gamla bundlar med identisk hash.
- mockup-sandbox-workflowen auto-startar om och tar port 8081 mitt i bygget; döda den upprepade gånger tills Metro bundit porten, eller stoppa workflowen under bygget.
