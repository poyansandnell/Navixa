/**
 * Fleet Arena — legal / policy documents.
 *
 * One dynamic route renders every legal document (privacy, terms, community
 * rules, fair play, data deletion, support, contact, licenses). Full document
 * text lives in the `legalDocs` i18n partial (English + Swedish, other locales
 * fall back to English). Each doc declares a `sectionCount`; this screen reads
 * that and renders `s1 … sN` (heading + body).
 *
 * Support/contact pages keep an external-link / mailto action driven by
 * EXPO_PUBLIC_* env vars with safe fallbacks so nothing 404s in the expo build.
 *
 * If a doc still contains company placeholder tokens (e.g. [COMPANY_NAME]) a
 * small subtle note reminds that details must be filled in before store
 * submission. There is no loud pre-launch banner.
 */
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, spacing } from '@/constants/theme';
import { Button, Card, Screen, Spacer, Text } from '@/components/ui';

type LegalPage =
  | 'privacy'
  | 'terms'
  | 'community'
  | 'fair-play'
  | 'data-deletion'
  | 'support'
  | 'contact'
  | 'licenses';

interface PageConfig {
  /** Key of the document under the `legalDocs` namespace. */
  doc: LegalPage;
  /** External web/mailto action, when the page has one. */
  action?: {
    url: string;
    /** When true, render a mail action instead of an open-external action. */
    email?: boolean;
  };
}

const SITE = process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://example.com';
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com';

/** Matches any leftover [PLACEHOLDER] company token in rendered strings. */
const PLACEHOLDER_RE = /\[[A-Z_]+\]/;

const PAGES: Record<LegalPage, PageConfig> = {
  privacy: { doc: 'privacy' },
  terms: { doc: 'terms' },
  community: { doc: 'community' },
  'fair-play': { doc: 'fair-play' },
  'data-deletion': { doc: 'data-deletion' },
  support: {
    doc: 'support',
    action: { url: `mailto:${SUPPORT_EMAIL}`, email: true },
  },
  contact: {
    doc: 'contact',
    action: { url: `mailto:${SUPPORT_EMAIL}`, email: true },
  },
  licenses: {
    doc: 'licenses',
    action: { url: process.env.EXPO_PUBLIC_LICENSES_URL ?? `${SITE}/licenses` },
  },
};

export default function LegalPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const { t } = useTranslation();
  const colors = useColors();

  const config = (page && PAGES[page as LegalPage]) || null;

  if (!config) {
    return (
      <Screen testID="legal-screen">
        <Stack.Screen options={{ title: t('legal.unknownTitle') }} />
        <Text variant="h2">{t('legal.unknownTitle')}</Text>
      </Screen>
    );
  }

  const base = `legalDocs.${config.doc}`;
  const title = t(`${base}.title`);
  const updated = t(`${base}.updated`);
  const sectionCount = Number.parseInt(t(`${base}.sectionCount`), 10) || 0;

  const sections = Array.from({ length: sectionCount }, (_, i) => {
    const n = i + 1;
    return {
      heading: t(`${base}.s${n}.heading`),
      body: t(`${base}.s${n}.body`),
    };
  });

  const hasPlaceholders = sections.some(
    (s) => PLACEHOLDER_RE.test(s.heading) || PLACEHOLDER_RE.test(s.body),
  );

  const openExternal = () => {
    if (config.action) void Linking.openURL(config.action.url);
  };

  return (
    <Screen testID="legal-screen">
      <Stack.Screen options={{ title }} />

      <Text variant="h2">{title}</Text>
      <Spacer size="xs" />
      <Text variant="caption" color="muted">
        {t('legal.lastUpdated', { date: updated })}
      </Text>

      {hasPlaceholders ? (
        <>
          <Spacer size="md" />
          <View style={styles.noteRow}>
            <Feather name="info" size={iconSize.xs} color={colors.mutedForeground} />
            <Text variant="caption" color="muted" style={styles.flex}>
              {t('legal.placeholderNote')}
            </Text>
          </View>
        </>
      ) : null}

      <Spacer size="lg" />

      {sections.map((section, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <Spacer size="md" /> : null}
          <Card>
            <Text variant="title">{section.heading}</Text>
            <Spacer size="sm" />
            <Text variant="body" color="muted">
              {section.body}
            </Text>
          </Card>
        </React.Fragment>
      ))}

      {config.action ? (
        <>
          <Spacer size="xl" />
          <Button
            label={config.action.email ? t('legal.contactEmailLabel') : t('legal.openExternal')}
            icon={config.action.email ? 'mail' : 'external-link'}
            variant="ghost"
            fullWidth
            onPress={openExternal}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
