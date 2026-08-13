---
name: Apple review UGC/deletion compliance
description: How Navixa satisfies Guidelines 1.2, 5.1.1(v) and 2.3.6 — where the mechanisms live and invariants to preserve
---

# Apple review compliance (Aug 2026)

- **Account deletion** (`/api/account/delete`): DB profile deleted FIRST (cascades own data, match seats set null), Clerk user deleted second; a non-404 Clerk failure returns an explicit error and the retry is idempotent. Never reverse this order — Clerk-first leaves unrecoverable half-deleted accounts.
- **Block invariants**: block creation, friendship removal, pending-request cancellation and the auto-report all run in ONE transaction; accept-friend-request re-checks bilateral blocks inside its transaction. Every new block inserts an open report with `[user_block]` prefix (category `other`) so moderation sees it — Apple requires blocks to notify the developer.
- **Bilateral block filters** are server-side in: friend requests, profile search, leaderboard, private-match join, matchmaking (pre-existing). Client-side filtering alone is not acceptable.
- **Ban enforcement**: `requireAuth` rejects users with an active suspend/ban moderation action (ACCOUNT_SUSPENDED 403), 30s TTL cache; admin suspend/unsuspend invalidates the cache.
- **Terms before login**: `TermsNotice` component on sign-in AND sign-up links to `https://sanka-skepp.replit.app/legal/{terms,privacy}` (i18n keys `auth.legal.*`).
- **Review Test Player**: `/api/review-account/bootstrap` (token-guarded, needs REVIEW_SETUP_TOKEN in prod) also seeds a DB-only profile `review_test_player` ("Review Test Player") so the review account always has someone to report/block. Prod DB is read-only from the workspace — seeding must go through this endpoint after publish.
- **Manual App Store Connect step**: Age Rating → User-Generated Content = Yes (Guideline 2.3.6).

**Git push without gitPush callback:** the GitHub connection's octokit client has proxy auth (no raw token) — push by committing locally, then replicating the commit via the Git Data API (blobs → tree with base_tree → commit → PATCH refs/heads/main).
