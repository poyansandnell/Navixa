# Memory Index

- [Supabase setup](supabase-setup.md) — connector is broken, use EXPO_PUBLIC_* env/secret only in Expo client; ask before requesting service-role/DB secrets.
- [Supabase deploy lessons](supabase-deploy-lessons.md) — Edge Functions need `--use-api` + explicit npm: specifiers; RLS needs base grants too or everything 403s; auth config via management API.
- [Expo web pitfalls](expo-web-pitfalls.md) — Alert.alert is a no-op on web (use lib/alert.ts showAlert); cross-cutting flags must live in shared stores, not hook-local state.
