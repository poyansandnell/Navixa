import { Alert, Platform } from 'react-native';
import type { AlertButton } from 'react-native';

export type { AlertButton };

/**
 * Cross-platform alert/confirm helper.
 *
 * On native, this delegates to `Alert.alert` unchanged.
 *
 * On web, React Native Web's `Alert.alert` is a silent no-op when buttons are
 * provided, which breaks confirm dialogs. This shim falls back to the browser's
 * `window.alert` / `window.confirm`:
 * - No buttons or a single non-cancel button -> `window.alert`, then invoke the
 *   button's `onPress` (if any).
 * - A cancel button plus one or more action buttons -> `window.confirm`. OK
 *   triggers the first non-cancel button's `onPress`; Cancel triggers the
 *   cancel button's `onPress` (if any).
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(text);
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actionButtons = buttons.filter((b) => b.style !== 'cancel');

  // No cancel button, or only a single non-cancel button: simple alert.
  if (!cancelButton || actionButtons.length === 0) {
    window.alert(text);
    const primary = actionButtons[0] ?? buttons[0];
    primary?.onPress?.();
    return;
  }

  // Cancel + action button(s): use confirm.
  const confirmed = window.confirm(text);
  if (confirmed) {
    actionButtons[0]?.onPress?.();
  } else {
    cancelButton.onPress?.();
  }
}
