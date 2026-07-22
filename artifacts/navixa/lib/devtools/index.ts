/**
 * Navixa — dev-only tooling helpers.
 *
 * These utilities back app/devtools.tsx and MUST only be reachable in
 * development builds (__DEV__). They are intentionally lightweight and never
 * imported by production screens.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

/** Clear all AsyncStorage keys (nukes persisted zustand stores, cache, etc.). */
export async function clearAsyncStorage(): Promise<void> {
  await AsyncStorage.clear();
}

/**
 * Probe the Supabase realtime socket connection status without leaving a
 * lingering subscription. Returns the transport state string.
 */
export async function getRealtimeStatus(): Promise<string> {
  try {
    // supabase-js exposes the underlying realtime client.
    const rt = (supabase as unknown as { realtime?: { isConnected?: () => boolean } })
      .realtime;
    if (rt?.isConnected?.()) return 'connected';
    return 'disconnected';
  } catch {
    return 'unknown';
  }
}

/**
 * Ephemeral dev-only state (offline banner simulation + local test rating).
 * Not persisted — resets on reload, which is what we want for a scratch tool.
 */
interface DevToolsState {
  simulateOffline: boolean;
  testRating: number | null;
  setSimulateOffline: (value: boolean) => void;
  setTestRating: (value: number | null) => void;
}

export const useDevToolsStore = create<DevToolsState>((set) => ({
  simulateOffline: false,
  testRating: null,
  setSimulateOffline: (simulateOffline) => set({ simulateOffline }),
  setTestRating: (testRating) => set({ testRating }),
}));
