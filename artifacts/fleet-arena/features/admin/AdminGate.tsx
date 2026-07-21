import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { spacing } from '@/constants/theme';
import { useIsAdmin } from './useIsAdmin';

/**
 * Renders children only when the current user is an admin. While the flag is
 * loading, shows a spinner; when not an admin, shows a forbidden empty state.
 * The Edge Function re-verifies admin status on every request regardless.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  const { t } = useTranslation();
  const colors = useColors();

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.huge }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="lock" title={t('admin.forbidden')} />
      </Screen>
    );
  }

  return <>{children}</>;
}
