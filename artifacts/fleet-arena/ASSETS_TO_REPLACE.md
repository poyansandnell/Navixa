# Navixa — Assets To Replace

Placeholder / minimal assets that must be replaced with final production art
before store submission.

## Shipped now
| Asset | Path | Current state |
|-------|------|---------------|
| App icon | `assets/images/icon.png` | Single source icon; reused for splash, Android adaptive-icon foreground, and web favicon (see `app.json`). |

## Required before store submission
- [ ] **App icon** — final 1024×1024 (no transparency, no rounded corners for
      iOS). Replace `assets/images/icon.png`.
- [ ] **Android adaptive icon** — ideally a dedicated foreground with safe-zone
      padding + background color (currently `#0A1628` in `app.json`).
- [ ] **Splash screen** — dedicated splash art (currently reuses the icon at
      `resizeMode: contain` on `#0A1628`).
- [ ] **iOS App Store screenshots** — required device sizes (see
      [APP_STORE_CHECKLIST.md](./APP_STORE_CHECKLIST.md)).
- [ ] **Google Play graphics** — feature graphic (1024×500), phone/tablet
      screenshots, hi-res icon (512×512) (see
      [GOOGLE_PLAY_CHECKLIST.md](./GOOGLE_PLAY_CHECKLIST.md)).
- [ ] **Cosmetic previews** — shop item `preview_url` images (referenced by the
      cosmetics catalog; seed data uses placeholders).
- [ ] **Marketing / store listing copy** in each supported language (14 locales).

## Notes
- The brand background color used across icon/splash/adaptive icon is `#0A1628`.
- Keep the icon simple and legible at small sizes.
