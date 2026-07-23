/**
 * Navixa — pending private-match invite code (deep/universal link resume).
 *
 * When a signed-out user opens an invite link (`navixa://join/<code>` or
 * `https://<domain>/join?code=<code>`), we can't join immediately — they must
 * authenticate first. We stash the parsed code here so the flow can resume
 * automatically once the session + profile are ready (see
 * `usePendingJoinResume`).
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseInviteCode } from './client';

const PENDING_JOIN_KEY = 'navixa-pending-join-code';

/** Persist an invite code to resume after authentication. */
export async function stashPendingJoinCode(code: string): Promise<void> {
  const parsed = parseInviteCode(code);
  if (!parsed) return;
  try {
    await AsyncStorage.setItem(PENDING_JOIN_KEY, parsed);
  } catch {
    // Non-fatal: the user can still enter the code manually.
  }
}

/** Read and clear any stashed invite code. */
export async function takePendingJoinCode(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(PENDING_JOIN_KEY);
    if (value) await AsyncStorage.removeItem(PENDING_JOIN_KEY);
    return value && parseInviteCode(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * When the user becomes authenticated (session + profile), consume any invite
 * code stashed while signed out and route to the join screen, which auto-joins.
 * Runs once per enable transition.
 */
export function usePendingJoinResume(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const code = await takePendingJoinCode();
      if (!code || cancelled) return;
      router.push({ pathname: '/join', params: { code } });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
