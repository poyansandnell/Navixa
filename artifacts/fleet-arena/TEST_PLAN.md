# Fleet Arena — Test Plan

Combines automated checks with a manual QA matrix. Run automated gates on every
change; run the manual matrix before a release build.

## Automated

| Gate | Command | Scope |
|------|---------|-------|
| Types | `pnpm run typecheck` | `tsc --strict --noEmit` over app + engine (`supabase/` excluded) |
| Lint | `pnpm run lint` | `expo lint` |
| Unit | `pnpm run test` | Vitest — pure engine only (`lib/engine/**/*.test.ts`) |

The engine (`lib/engine`) is intentionally free of react-native imports so it
runs in plain Node. Suites cover coordinate math (`coord`), placement rules
(`placement`), deterministic RNG (`rng`), bot logic (`bots`), Elo (`rating`),
match state / shot application (`match`), and simulation (`simulate`).

> Edge Functions are excluded from tsc/vitest here (they are Deno + copied
> engine). Validate them against a running Supabase project.

## Manual QA matrix

### Auth & onboarding
- [ ] Onboarding flow; guest browsing where allowed.
- [ ] Sign-up, sign-in, magic-link, forgot-password, complete-profile.
- [ ] Social buttons hidden while `SOCIAL_AUTH_ENABLED = false`.
- [ ] Session persists across app restart; sign-out clears it.

### Offline bot match (`app/game`)
- [ ] Setup: fleet placement (rotate, drag, auto-place, validation).
- [ ] Play: firing, hit/miss/sunk feedback, confirm-shot setting, haptics/sound.
- [ ] Result screen; bot difficulty behaves.

### Online play (`app/online`)
- [ ] Matchmaking search (ranked/casual) finds/queues.
- [ ] Private match: create → share code/deep link → join via `join/[code]`.
- [ ] Turn clock / timeout; resign; reconnect after backgrounding.
- [ ] Rating updates on a rated win; no double-apply (idempotent).

### Social & profiles
- [ ] Friends: request, accept, block; blocked users disappear.
- [ ] Leaderboard renders; profile (`profile/[id]`) shows stats.
- [ ] Report user flow.

### History & replay
- [ ] Match list (`history/`); open a finished match; replay moves.

### Tournaments / quests / shop
- [ ] Tournament detail + single-elim bracket; advancement.
- [ ] Daily/weekly quests progress.
- [ ] Shop: browse, purchase with test currency, equip cosmetics.

### Settings / legal / i18n
- [ ] Toggle haptics, sound, animations, reduced motion, colorblind, confirm-shot.
- [ ] All 14 languages switch live; RTL not required.
- [ ] Legal pages (`legal/[page]`) open with configured URLs.

### Permissions
- [ ] No camera/mic/location/contacts prompts ever appear.
- [ ] Push prompt only after in-app explanation (dev build only).

## Platform coverage
- [ ] iOS via Expo Go (QR) — core flows.
- [ ] Android via Expo Go (QR) — core flows.
- [ ] Web preview (`/`) — core flows (push disabled).
- [ ] Development build — push + (if enabled) social sign-in.

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for Expo Go caveats.
