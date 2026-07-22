# Navixa — Apple App Store Checklist

Use with [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md). On Replit, iOS builds &
submission go through **Replit's Expo Launch**; the `eas` commands are the
outside-Replit equivalents.

## Apple accounts
- [ ] Apple Developer Program enrollment (active).
- [ ] App record created in App Store Connect.
- [ ] Bundle ID `com.navixa.game` registered and matches `app.json`.

## App configuration
- [ ] `app.json`: name "Navixa", `version` = marketing version,
      `ios.bundleIdentifier` = `com.navixa.game`, scheme `navixa`.
- [ ] `eas.json` production profile used; `appVersionSource: remote`,
      `autoIncrement` handles the build number.
- [ ] `ios.supportsTablet` is `false` (phone-only) — confirm intended.

## Privacy (App Privacy questionnaire)
- [ ] Complete using [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).
- [ ] Declare: account (email), user content (profile), identifiers, gameplay
      data. **No** location, camera, mic, contacts, or tracking.
- [ ] No IDFA / App Tracking Transparency prompt (no ad tracking).
- [x] In-app legal documents written and shipped (Privacy, Terms, Community,
      Fair Play, Data Deletion, Support, Contact, Licenses) in the `legalDocs`
      i18n partial (EN + SV; other locales fall back to EN), rendered natively
      at `app/legal/[page].tsx`.
- [ ] Privacy policy URL hosted (`EXPO_PUBLIC_PRIVACY_URL`). **Apple requires a
      publicly reachable privacy policy URL** — host the SAME text as the in-app
      Privacy Policy at that URL.
- [ ] Before submission, replace the `[COMPANY_NAME]`, `[COMPANY_ADDRESS]`,
      `[SUPPORT_EMAIL]` and `[COUNTRY]` placeholders in the legal documents
      (in-app the screen shows a note while any placeholder remains).

## Permissions / capabilities
- [ ] No camera / microphone / location / contacts usage strings required
      (none requested).
- [ ] Push notifications capability only if shipping a dev/standalone build with
      remote push (see [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).
- [ ] Sign in with Apple: **not** required (social OAuth stubbed/disabled; only
      email/magic-link auth ships). If you later enable Google sign-in in-app,
      Apple requires Sign in with Apple too.

## Store listing
- [ ] App name, subtitle, description, keywords (localize across 14 languages
      where feasible).
- [ ] Screenshots for required device sizes (final art — see
      [ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)).
- [ ] App icon 1024×1024 (no alpha, no rounded corners).
- [ ] Age rating questionnaire (multiplayer / user-generated names → likely 12+).
- [ ] Support URL + marketing URL (`EXPO_PUBLIC_SUPPORT_URL` / `_WEBSITE_URL`).

## In-app purchases
- [ ] None to declare — shop uses **test currency only** (no real IAP). Do not
      configure StoreKit products until real IAP is implemented.

## Review notes
- [ ] Provide a demo account (email/password) for online features.
- [ ] Note that push & social sign-in require a dev build and are not in the
      Expo Go review path.
- [ ] Confirm account deletion is available in-app (`delete-account`) — required
      by App Store guidelines.

## Submit
- [ ] Upload build (Expo Launch on Replit, or `eas submit --platform ios`).
- [ ] Assign to TestFlight; internal test; then submit for review.
