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
      `ios.bundleIdentifier` = `com.navixa.app`, `android.package` =
      `com.navixa.app`, `ios.buildNumber` / `android.versionCode` bumped.
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

### 3a. Production URLs (web build @ `https://sanka-skepp.replit.app`)
The **marketing URL** and **support URL** below are the App Store Connect /
Play Console fields.
- **Marketing URL:** `https://sanka-skepp.replit.app`
- **Support URL:** `https://sanka-skepp.replit.app/support`
  (public **support portal** — FAQ + contact form served by the Expo web build
  at `app/support.tsx`; posts to `POST /api/support/tickets`).

Support is handled entirely through the **support portal form** — no support
mailbox is required. The old `/legal/support` and `/legal/contact` URLs now
**redirect to `/support`**, so existing links keep working.

Legal/policy pages are served by the web build via `app/legal/[page].tsx`:
- Privacy policy: `https://sanka-skepp.replit.app/legal/privacy`
- Terms of service: `https://sanka-skepp.replit.app/legal/terms`
- Community rules: `https://sanka-skepp.replit.app/legal/community`
- Fair play: `https://sanka-skepp.replit.app/legal/fair-play`
- Data deletion: `https://sanka-skepp.replit.app/legal/data-deletion`
- Licenses: `https://sanka-skepp.replit.app/legal/licenses`
- Support (redirects → `/support`): `https://sanka-skepp.replit.app/legal/support`
- Contact (redirects → `/support`): `https://sanka-skepp.replit.app/legal/contact`
- [ ] Support: **portal (form) — no mailbox needed**. Ensure the api-server
      exposes `POST /api/support/tickets` (`{ email, subject, message, category }`)
      and routes tickets somewhere the team monitors.
- [ ] Set `EXPO_PUBLIC_WEBSITE_URL=https://sanka-skepp.replit.app` so the
      licenses action resolves to the live domain.

### 3b. Invite / universal links
- Server (`artifacts/api-server`) emits per-match links:
  - `deepLink`: `navixa://join/<code>` → handled by `app/join/[code].tsx`
    (redirects into the shared join flow).
  - `universalLink`: `${APP_PUBLIC_URL}/join?code=<code>` → handled by
    `app/join.tsx`.
- [ ] Set server env `APP_PUBLIC_URL=https://sanka-skepp.replit.app` (else the
      universal link defaults to `https://navixa.app`).
- App config for universal links:
  - iOS `associatedDomains`: `applinks:sanka-skepp.replit.app` (app.json).
  - Android App Links intent filter for `https://sanka-skepp.replit.app/join`
    with `autoVerify` (app.json).
- **AASA caveat (iOS universal links):** Apple requires an
  `apple-app-site-association` (AASA) JSON file served at
  `https://sanka-skepp.replit.app/.well-known/apple-app-site-association`
  (Content-Type `application/json`, no redirects) listing the app's Team ID +
  bundle ID (`<TEAMID>.com.navixa.app`) and the `/join*` path. This is **not**
  present yet and must be served by the web deployment — otherwise iOS universal
  links silently fall back to the browser. Android additionally needs a
  `/.well-known/assetlinks.json` for verified App Links. The custom scheme
  (`navixa://join/...`) and web `/join?code=` work without these files.
- **Expo Go note:** custom-scheme / universal links do NOT open the app in Expo
  Go — manual code entry (`/online/join/new`) is the dev fallback. Universal
  links require a production/dev-client build.

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
- [ ] Verify deep link `navixa://join/<code>` opens the app and auto-joins.
- [ ] Verify universal link `https://sanka-skepp.replit.app/join?code=<code>`
      opens the app (requires the AASA/assetlinks files from §3b).

## 7. App Store submission — manual steps (need the user)
These require accounts/artwork and cannot be done from code:
- [ ] **Apple Developer Program** membership (US$99/yr) + Team ID (for AASA).
- [ ] **Google Play Developer** account (one-time US$25).
- [ ] EAS build + submit run **outside Replit** (see §4–§5), or Replit Expo
      Launch flow for iOS.
- [ ] **App Store Connect** app record: name, subtitle, description, keywords,
      category, age rating, privacy "nutrition labels" (contacts are hashed
      on-device; declare accordingly). Set **Marketing URL** =
      `https://sanka-skepp.replit.app` and **Support URL** =
      `https://sanka-skepp.replit.app/support` (see §3a). The support portal
      includes a FAQ + contact form, so no support mailbox is needed.
- [ ] **Screenshots** for required device sizes (6.7"/6.5" iPhone, iPad if
      later enabled; Play phone/tablet) — **not generated; needs real artwork.**
- [ ] Serve the **AASA** + **assetlinks.json** files on the web deployment
      (see §3b) before relying on universal/App Links.

## Assets status
- `assets/images/icon.png` — real 1024×1024 PNG (used for icon, splash,
  adaptive icon foreground, and web favicon).
- ⚠️ There is **no dedicated splash / adaptive-icon / favicon artwork**: all
  four reuse `icon.png`. A distinct splash image and a properly padded adaptive
  icon foreground are recommended before store submission
  (see [ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)).

## Reminders
- No `app.config.ts` (static `app.json` is a Replit Expo Launch requirement).
- IAP, social OAuth, and remote push have caveats — see
  [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
