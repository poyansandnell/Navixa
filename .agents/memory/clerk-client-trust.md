---
name: Clerk Client Trust
description: Why native sign-in returned needs_client_trust and how it was disabled
---

Clerk's "Client Trust" (auto-enabled for instances created after Nov 2025) forces an email-code second factor on the FIRST password sign-in from any new device — even with correct credentials and no MFA. The app's sign-in screen (legacy `signIn.create`) treats any non-`complete` status as a generic error ("Något gick fel").

**Why:** This blocked the Apple review account on fresh reviewer devices (Aug 2026).

**How to apply / fix:** The working fix is the per-user flag: `PATCH https://api.clerk.com/v1/users/{id}` with `{"bypass_client_trust": true}` (documented in Clerk's Backend API spec). The instance-level PATCH (`{"auth_password":{"device_trust":{"enabled":false}}}`) returns 204 but is silently IGNORED — do not trust 204 as proof a config field took effect; verify behavior. Prod requires the prod secret key, so a token-guarded one-off endpoint in `reviewAccount.ts` (gated on `REVIEW_SETUP_TOKEN`, inert when unset) ran it from inside the deployment; verified via clerk-js on the prod support page (`signIn.create` → `status: complete`). The Clerk CLI (`npx clerk config patch`) needs dashboard linking and does NOT work for Replit-managed Clerk. If Client Trust is ever re-enabled, the sign-in screen must handle `needs_client_trust` (send/verify email code — see clerk-auth skill expo-sdk-email-password reference).
