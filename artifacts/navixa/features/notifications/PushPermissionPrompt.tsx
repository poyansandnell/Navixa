/**
 * Navixa — push opt-in explainer modal.
 *
 * Shows the *benefit* of enabling notifications BEFORE we trigger the OS
 * permission prompt (best practice — avoids burning the one-shot iOS prompt).
 * The parent decides when to render this and what to do on accept/decline.
 */
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Button, Card, Spacer, Text } from '@/components/ui';

interface PushPermissionPromptProps {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export function PushPermissionPrompt({
  visible,
  onEnable,
  onDismiss,
}: PushPermissionPromptProps) {
  const { t } = useTranslation();
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={[styles.backdrop, { backgroundColor: `${colors.background}CC` }]}>
        <Card elevated style={styles.sheet}>
          <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
            <Feather name="bell" size={iconSize.lg} color={colors.accent} />
          </View>
          <Spacer size="md" />
          <Text variant="h3" center>
            {t('push.enableTitle')}
          </Text>
          <Spacer size="sm" />
          <Text variant="subhead" color="muted" center>
            {t('push.enableBody')}
          </Text>
          <Spacer size="xl" />
          <Button label={t('push.enableCta')} fullWidth onPress={onEnable} />
          <Spacer size="sm" />
          <Button
            label={t('push.notNow')}
            variant="ghost"
            fullWidth
            onPress={onDismiss}
          />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
