/**
 * Fleet Arena — foreground / connectivity reconnect hook for online matches.
 *
 * Calls `onReconnect` when the app returns to the foreground (AppState 'active')
 * and, when available, when a NetInfo reconnection is observed. NetInfo is
 * optional: we import it lazily and no-op if it is not installed, so this hook
 * never breaks the build.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export interface NetworkState {
  /** True when we believe the device is online (best-effort). */
  online: boolean;
}

export function useReconnect(
  enabled: boolean,
  onReconnect: () => void,
): NetworkState {
  const cbRef = useRef(onReconnect);
  cbRef.current = onReconnect;
  const [online, setOnline] = useState(true);

  // Foreground reconnect.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('[online] app foregrounded → reconnect');
        cbRef.current();
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Optional NetInfo connectivity tracking (best-effort, lazy).
  useEffect(() => {
    if (!enabled) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        // Runtime-computed specifier so tsc/bundler treat NetInfo as optional.
        const spec = '@react-native-community/netinfo';
        const mod = (await import(spec)) as {
          default?: { addEventListener: (cb: (s: { isConnected?: boolean | null }) => void) => () => void };
          addEventListener?: (cb: (s: { isConnected?: boolean | null }) => void) => () => void;
        };
        const NetInfo = mod.default ?? mod;
        if (!NetInfo?.addEventListener) return;
        unsub = NetInfo.addEventListener((state: { isConnected?: boolean | null }) => {
          if (cancelled) return;
          const nowOnline = state.isConnected !== false;
          setOnline((prev) => {
            if (!prev && nowOnline) {
              console.log('[online] network regained → reconnect');
              cbRef.current();
            }
            return nowOnline;
          });
        });
      } catch {
        // NetInfo not installed — foreground reconnect still works.
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [enabled]);

  return { online };
}
