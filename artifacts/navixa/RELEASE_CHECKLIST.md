# Navixa — Release Checklist

End-to-end steps to cut a release. Store-specific items are in
[APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md) and
[GOOGLE_PLAY_CHECKLIST.md](./GOOGLE_PLAY_CHECKLIST.md).

## 0. Platform note
On **Replit, iOS publishing goes through Replit's Expo Launch flow**. The `eas`
CLI commands below are documented for completeness and for use **outside**
Replit; they are not run in this environment.

## 1. Pre-flight (code)
- [ ] `pnpm run typecheck` clean.
- [ ] `pnpm run lint` clean.
- [ ] `pnpm run test` passes (engine suite).
- [ ] Manual QA matrix in [TEST_PLAN.md](./TEST_PLAN.md) done on iOS + Android.
- [ ] `app.json`: `version` bumped, `name` = "Navixa", scheme = `navixa`,
      `ios.bundleIdentifier` = `com.navixa.game`, `android.package` =
      `com.navixa.game`.
- [ ] `eas.json`: `cli.version >= 16`, `appVersionSource: remote`, profiles
      present (development / preview / production).

## 2. Backend (production, Replit-native)
- [ ] On **Publish**, the production database schema is applied automatically
      (dev and prod DBs are separate); confirm it succeeded. **Do NOT seed prod.**
- [ ] api-server (`artifacts/api-server`) published and reachable under `/api`
      (Socket.IO at `/api/socket.io`).
- [ ] Clerk providers + Google SSO redirect URLs set for the production domain.
- [ ] Production `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` / `EXPO_PUBLIC_DOMAIN`
      configured; `CLERK_SECRET_KEY` and `DATABASE_URL` server-side only.

## 3. Config & assets
- [ ] `.env` / Secrets set for the target environment (`EXPO_PUBLIC_APP_ENV`).
- [ ] Public legal/support URLs hosted and reachable (see `.env.example`).
- [ ] Final icon/splash/adaptive icon in place ([ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)).
- [ ] (Optional) Sentry DSN set.

## 4. Build (EAS — outside Replit)
```bash
eas build --profile preview    --platform all   # internal testing
eas build --profile production --platform all
```
- [ ] Preview build installed and smoke-tested.
- [ ] Production build verified.

## 5. Submit
```bash
eas submit --profile production --platform ios      # → TestFlight
eas submit --profile production --platform android  # → Play Internal testing
```
- [ ] iOS: uploaded to **TestFlight**; complete [App Store checklist](./APP_STORE_CHECKLIST.md).
- [ ] Android: uploaded to **Play Internal testing**; complete
      [Google Play checklist](./GOOGLE_PLAY_CHECKLIST.md).

## 6. Post-release
- [ ] Tag the release; note the store build numbers.
- [ ] Monitor crashes (Sentry) and api-server logs.
- [ ] Verify deep link `navixa://online/join/<code>` opens the app.

## Reminders
- No `app.config.ts` (static `app.json` is a Replit Expo Launch requirement).
- IAP, social OAuth, and remote push have caveats — see
  [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
