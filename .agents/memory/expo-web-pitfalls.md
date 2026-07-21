---
name: Expo/RN Web pitfalls (Fleet Arena)
description: Client-side gotchas that broke flows in the Expo web preview
---

- **`Alert.alert` with buttons is a silent no-op on React Native Web.** All confirm dialogs must go through `lib/alert.ts` `showAlert()` (window.confirm/alert on web, Alert.alert on native). Never reintroduce raw `Alert.alert` in app/ or features/.
- **Per-component `useState` for cross-cutting flags breaks protected routing.** The onboarding-complete flag must live in shared state (zustand, see `hooks/useOnboarding.ts`); a hook-local copy left the root layout unaware and stuck users on /onboarding after sign-in.
- **Why:** both bugs were only caught by e2e browser testing — unit tests and typecheck were green. Prefer a testing-subagent pass after UI flow changes.
