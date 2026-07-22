# Navixa — Google Play Checklist

Use with [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Google accounts
- [ ] Google Play Console account (Developer registration complete).
- [ ] App created in Play Console.
- [ ] Package name `com.navixa.game` matches `app.json` (`android.package`).

## App configuration
- [ ] `app.json`: name "Navixa", `version` = version name,
      `android.package` = `com.navixa.game`, scheme `navixa`.
- [ ] Adaptive icon configured (`android.adaptiveIcon`, background `#0A1628`).
- [ ] `eas.json` production profile (`autoIncrement` handles versionCode);
      preview profile builds an APK for internal sharing.

## Data safety form
- [ ] Complete using [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).
- [ ] Declare collected: email (account), profile info, gameplay data,
      identifiers, push tokens. Encrypted in transit; user can request deletion.
- [ ] Declare **no**: location, camera, mic, contacts, financial info, ads.
- [ ] Link the account-deletion mechanism (in-app `delete-account`) — Play
      requires an account/data deletion path.

## Permissions
- [ ] No dangerous permissions requested (no location/camera/mic/contacts).
- [ ] `POST_NOTIFICATIONS` only if shipping a dev/standalone build with remote
      push (Android 13+). Otherwise omit.

## Store listing
- [ ] Title, short description, full description (localize across 14 languages
      where feasible).
- [ ] Feature graphic 1024×500; phone + (optional) tablet screenshots; hi-res
      icon 512×512 (final art — see [ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)).
- [ ] Content rating questionnaire (IARC).
- [ ] Target audience & content (not primarily child-directed).
- [ ] Privacy policy URL (`EXPO_PUBLIC_PRIVACY_URL`).

## In-app products
- [ ] None — shop uses **test currency only** (no Google Play Billing). Do not
      create managed products until real IAP is implemented
      ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

## Release tracks
- [ ] Upload AAB to **Internal testing** first.
- [ ] Add internal testers; verify install + core flows.
- [ ] Provide a demo account for online features in review notes.
- [ ] Promote to Closed/Open testing → Production when ready.

## Submit
- [ ] Upload build (`eas submit --platform android`, or Play Console upload).
- [ ] Complete all "App content" declarations before rollout.
