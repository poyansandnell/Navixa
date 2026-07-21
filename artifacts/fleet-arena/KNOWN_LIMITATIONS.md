# Fleet Arena — Known Limitations

An honest inventory of what is stubbed, limited, or intentionally out of scope.
Nothing here is a bug — it is documented so reviewers and future contributors
know exactly where the edges are.

## 1. No real in-app purchases (IAP)
The shop (`features/shop/`, `app/shop/`) uses a **test currency only** (coins /
XP). There are **no real-money purchase paths** and no `price_cents` products
are surfaced. To ship real IAP, integrate a store SDK (RevenueCat, or
`expo-in-app-purchases` / StoreKit + Google Play Billing) and add server-side
receipt validation. See `features/shop/service.ts`.

## 2. Social OAuth is stubbed
Apple / Google Sign-In is behind the feature flag `SOCIAL_AUTH_ENABLED = false`
(`features/auth/oauth.ts`). Buttons render only when the flag is on and the
handlers throw on purpose. Enabling requires: (a) a custom **development build**
with the native auth modules, (b) provider config in the Supabase dashboard, and
(c) native entitlements / URL schemes in `app.json`. **Email/password and
magic-link auth work today.**

## 3. Push notifications require a development build
Remote push (`features/notifications/`) needs a custom dev/standalone build.
In **Expo Go (SDK 53+)** and on **web** it is a safe no-op reporting
`unsupported` (`isPushSupported()` returns false). In-app notifications and the
`register-push-token` / `send-turn-notification` Edge Functions are wired; only
the OS-level remote delivery needs the dev build.

## 4. Admin / moderation UI is minimal
Server-side moderation is real (RLS `is_admin()`, `moderation_actions`,
`audit_logs`, `report-user` Edge Function), but there is **no rich admin
dashboard** in-app. `app/devtools.tsx` provides limited developer utilities only.
Moderation is expected to be done via Supabase Studio / SQL for now.

## 5. Tournaments are single-elimination only
`create-tournament-bracket` builds a seeded **single-elimination** bracket
(`create_tournament_bracket()`), advanced via `advance-tournament`. No
round-robin, Swiss, double-elimination, or group stages.

## 6. Reactions / chat are limited
There is no free-form in-match text chat. Social interaction is limited to
friends, reports, and cosmetic emotes/titles from the shop catalog. No real-time
chat channel is implemented.

## 7. Expo Go testing limits
Expo Go covers the majority of the app, but the following behave differently or
not at all in Expo Go: remote **push notifications** (no-op), native **social
sign-in** (disabled), and any future native modules. Use a **development build**
for full-fidelity testing of those paths.

## 8. `app.config.ts` replaced by static `app.json`
The original spec called for `app.config.ts`. Replit's **Expo Launch** tooling
requires a **static `app.json`**, so the project uses `app.json` and does **not**
include `app.config.ts`. This is a deliberate platform constraint, not an
oversight. All native config (bundle IDs `com.fleetarena.game`, scheme
`fleetarena`, adaptive icon, plugins) lives in `app.json`.

## 9. iOS publishing path on Replit
On Replit, iOS publishing goes through **Replit's Expo Launch** flow. The EAS
CLI commands in the README / [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) are
documented for completeness and for use outside Replit; they are not executed in
this environment.

## 10. External configuration still required
Production Supabase project, Auth provider redirect URLs, Apple Developer /
Google Play accounts, hosted legal/support pages, real store assets
([ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)), and an optional Sentry DSN all
require setup outside this repository. See the README "Remaining external steps".

## 11. Minimal device permissions
The app requests **no camera, microphone, location, or contacts** permissions.
Push notification permission is requested only after an in-app explanation, and
only in builds that support it.
