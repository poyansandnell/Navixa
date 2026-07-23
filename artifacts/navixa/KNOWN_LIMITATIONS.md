# Navixa — Known Limitations

An honest inventory of what is stubbed, limited, or intentionally out of scope.
Nothing here is a bug — it is documented so reviewers and future contributors
know exactly where the edges are.

## 1. No real in-app purchases (IAP)
The shop (`features/shop/`, `app/shop/`) uses a **test currency only** (coins /
XP). There are **no real-money purchase paths** and no `price_cents` products
are surfaced. To ship real IAP, integrate a store SDK (RevenueCat, or
`expo-in-app-purchases` / StoreKit + Google Play Billing) and add server-side
receipt validation. See `features/shop/service.ts`.

## 2. Apple Sign-In is not wired up
Auth is handled by **Clerk**. **Email/password and Google** (Clerk SSO, gated by
`SOCIAL_AUTH_ENABLED = true` in `features/auth/oauth.ts`) are the **only**
supported sign-in methods — a real account is always required (no guest/anonymous
mode, no magic-link sign-in). **Apple Sign-In is not implemented** (`oauth.ts`
handles Google only). Enabling Apple would require: (a) a custom **development
build** with the native auth module, (b) Apple provider config in the Clerk
dashboard, and (c) native entitlements / URL schemes in `app.json`. In Expo Go
the Google SSO redirect works via the Expo auth proxy; a standalone build needs
the app scheme registered as a Clerk redirect URL.

## 3. Push notifications require a development build
Remote push (`features/notifications/`) needs a custom dev/standalone build.
In **Expo Go (SDK 53+)** and on **web** it is a safe no-op reporting
`unsupported` (`isPushSupported()` returns false). In-app notifications and the
api-server's push endpoints (token registration + server-driven turn/social
sends via the Expo push service) are wired; only the OS-level remote delivery
needs the dev build.

## 4. Admin / moderation UI is minimal
Server-side moderation is real (api-server `is_admin` route gating,
`moderation_actions`, `audit_logs`, report-user endpoint), but there is **no
rich admin dashboard** in-app. `app/devtools.tsx` provides limited developer
utilities only. Moderation is expected to be done directly against the database
/ api-server for now.

## 5. Tournaments are single-elimination only
The api-server builds a seeded **single-elimination** bracket, advanced as
matches finalize. No round-robin, Swiss, double-elimination, or group stages.

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
oversight. All native config (bundle IDs `com.navixa.game`, scheme
`navixa`, adaptive icon, plugins) lives in `app.json`.

## 9. iOS publishing path on Replit
On Replit, iOS publishing goes through **Replit's Expo Launch** flow. The EAS
CLI commands in the README / [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) are
documented for completeness and for use outside Replit; they are not executed in
this environment.

## 10. External configuration still required
Production Clerk instance (providers + Google SSO redirect URLs), Apple
Developer / Google Play accounts, hosted legal/support pages, real store assets
([ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)), and an optional Sentry DSN all
require setup outside this repository. On Replit, `CLERK_PUBLISHABLE_KEY` /
`CLERK_SECRET_KEY` and `DATABASE_URL` are auto-provisioned, and the production
database schema is applied automatically on Publish. See the README "Remaining
external steps".

## 11. Minimal device permissions
The app requests **no camera, microphone, location, or contacts** permissions.
Push notification permission is requested only after an in-app explanation, and
only in builds that support it.
