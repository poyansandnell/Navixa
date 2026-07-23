/**
 * Navixa — header "leave" button for the online match flow.
 *
 * Leaves the current match WITHOUT resigning: the match stays live on the
 * server (and keeps showing up in "Your matches") — this only navigates the
 * player back home and resets the local match store. For blitz matches we
 * confirm first, since the clock keeps ticking and the player could lose on
 * time. Resigning remains a separate, explicit action on the play screen.
 */
import React from 'react';
import { Pressable } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { useOnlineMatchStore } from './store';

export function LeaveMatchButton() {
  const { t } = useTranslation();
  const colors = useColors();
  const tempo = useOnlineMatchStore((s) => s.tempo);
  const reset = useOnlineMatchStore((s) => s.reset);

  const leave = React.useCallback(() => {
    reset();
    router.replace('/(tabs)');
  }, [reset]);

  const handlePress = React.useCallback(() => {
    if (tempo === 'blitz') {
      showAlert(t('online.leave.title'), t('online.leave.body'), [
        { text: t('online.leave.cancel'), style: 'cancel' },
        { text: t('online.leave.confirm'), style: 'destructive', onPress: leave },
      ]);
    } else {
      leave();
    }
  }, [tempo, t, leave]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('online.leave.button')}
      testID="online-leave-button"
    >
      <Feather name="chevron-left" size={26} color={colors.foreground} />
    </Pressable>
  );
}
