/**
 * Fleet Arena — push notifications client.
 *
 * Handles the Expo push permission flow and token registration. The UX rule is
 * to explain the benefit BEFORE prompting for OS permission (see the small
 * modal in <PushPermissionPrompt />), then register the resulting Expo push
 * token via the `register-push-token` Edge Function.
 *
 * Graceful degradation:
 *   - `expo-notifications` is an OPTIONAL dependency here. If it is not
 *     installed (e.g. this environment) or we're on web / Expo Go where remote
 *     push is unsupported, every call becomes a safe no-op reporting
 *     `unsupported`. Nothing throws.
 *   - Category preferences are persisted in `user_settings` (see
 *     features/notifications/settings via the Settings screen), not here.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type PushPermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * Minimal structural type for the slice of expo-notifications we use. Declared
 * locally so the app type-checks and builds even when the (optional) package is
 * not installed in this environment.
 */
interface NotificationsModule {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (options?: { projectId?: string }) => Promise<{ data?: string }>;
}

/**
 * Lazily load expo-notifications if present. Returns null when unavailable so
 * callers can degrade. We avoid a static import so the app builds even when the
 * package is not installed.
 */
function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // Optional dependency — resolved at runtime only. eslint-disable-next-line
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** True when remote push can plausibly work in this runtime. */
export function isPushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  // Expo Go (SDK 53+) does not support remote push; require a dev/standalone build.
  if (Constants.appOwnership === 'expo') return false;
  return loadNotifications() != null;
}

/** Read the current OS permission state without prompting. */
export async function getPermissionState(): Promise<PushPermissionState> {
  const Notifications = loadNotifications();
  if (!Notifications || !isPushSupported()) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PushPermissionState;
  } catch {
    return 'unsupported';
  }
}

/**
 * Prompt for OS permission (call ONLY after the benefit has been explained).
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<PushPermissionState> {
  const Notifications = loadNotifications();
  if (!Notifications || !isPushSupported()) return 'unsupported';
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status as PushPermissionState;
  } catch {
    return 'unsupported';
  }
}

/**
 * Fetch the Expo push token for this device. Requires granted permission and a
 * configured EAS/Expo project id. Returns null when unavailable.
 */
async function getExpoPushToken(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const response = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return response.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Register this device's Expo push token with the backend via the
 * `register-push-token` Edge Function. Safe no-op when unsupported.
 */
export async function registerPushToken(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  const state = await getPermissionState();
  if (state !== 'granted') return { ok: false, reason: state };

  const token = await getExpoPushToken();
  if (!token) return { ok: false, reason: 'no_token' };

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await supabase.functions.invoke('register-push-token', {
    body: { token, platform, provider: 'expo' },
  });
  if (error) return { ok: false, reason: 'register_failed' };
  return { ok: true };
}

/**
 * Full opt-in flow: request permission then register the token. Assumes the
 * caller already showed the benefit explanation.
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  const state = await requestPermission();
  if (state !== 'granted') return { ok: false, reason: state };
  return registerPushToken();
}
