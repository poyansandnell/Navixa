# Memory Index

- [Replit-native stack](replit-native-stack.md) — Supabase is fully removed (July 2026): Replit PG + Drizzle, Clerk auth (expo/legacy hooks), Socket.IO at /api/socket.io, server-authoritative api-server.
- [Expo deploy build pitfalls](expo-deploy-build.md) — publish build fails on stale pnpm-lock or missing explicit babel-preset-expo dep; repro via scripts/build.js, ignore expo export hermesc errors.
- [Clerk Client Trust](clerk-client-trust.md) — new-device email-code challenge blocked native sign-in; disable via PATCH /v1/instance device_trust; Clerk CLI unusable for Replit-managed instances.
- [Expo web pitfalls](expo-web-pitfalls.md) — Alert.alert is a no-op on web (use lib/alert.ts showAlert); cross-cutting flags must live in shared stores, not hook-local state.
