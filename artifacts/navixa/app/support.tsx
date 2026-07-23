/**
 * Navixa — public support portal (`/support`).
 *
 * This is the URL surfaced to App Store / Play reviewers, so it must work
 * unauthenticated and read well on desktop web (content is centred in a
 * max-width column). It has two parts:
 *   1. FAQ — collapsible questions/answers describing how Navixa actually
 *      works. Entries come from the `support.faq` i18n partial (EN + SV).
 *   2. Contact form — name / email / category / subject / message, POSTed to
 *      `POST /api/support/tickets` with explicit success + error states.
 *
 * The form posts unauthenticated (reviewers won't be signed in); the api-server
 * accepts the ticket with the supplied email.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing, typography } from '@/constants/theme';
import { Button, Card, Screen, SectionHeader, Spacer, Text } from '@/components/ui';
import { TextField } from '@/features/auth';
import { apiFetch } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** UI category (drives the label); mapped to the server enum on submit. */
type Category = 'account' | 'gameplay' | 'billing' | 'bug' | 'privacy' | 'other';

const CATEGORIES: Category[] = ['account', 'gameplay', 'billing', 'bug', 'privacy', 'other'];

/** Server accepts: "question" | "bug" | "account" | "payment" | "other". */
type ServerCategory = 'question' | 'bug' | 'account' | 'payment' | 'other';

const SERVER_CATEGORY: Record<Category, ServerCategory> = {
  account: 'account',
  gameplay: 'question',
  billing: 'payment',
  bug: 'bug',
  privacy: 'question',
  other: 'other',
};

/** Submit a support ticket. Server contract: { email, subject, message, category }. */
async function submitTicket(payload: {
  email: string;
  subject: string;
  message: string;
  category: ServerCategory;
}): Promise<void> {
  await apiFetch('/support/tickets', { method: 'POST', body: payload });
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const colors = useColors();
  const [open, setOpen] = React.useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((v) => !v)}
      style={styles.faqItem}
    >
      <View style={styles.faqRow}>
        <Text variant="bodyMedium" style={styles.flex}>
          {q}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={iconSize.sm}
          color={colors.mutedForeground}
        />
      </View>
      {open ? (
        <>
          <Spacer size="sm" />
          <Text variant="body" color="muted">
            {a}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

export default function SupportScreen() {
  const { t } = useTranslation();
  const colors = useColors();

  const faqCount = Number.parseInt(t('support.faqCount'), 10) || 0;
  const faq = Array.from({ length: faqCount }, (_, i) => ({
    q: t(`support.faq.q${i + 1}`),
    a: t(`support.faq.a${i + 1}`),
  }));

  // ---- contact form state -------------------------------------------------
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [category, setCategory] = React.useState<Category>('account');
  const [submitting, setSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [fieldError, setFieldError] = React.useState<{ email?: string; message?: string }>({});

  const resetForm = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setCategory('account');
    setStatus('idle');
    setFieldError({});
  };

  const handleSubmit = async () => {
    const errors: { email?: string; message?: string } = {};
    if (!EMAIL_RE.test(email.trim())) errors.email = t('support.form.errorEmail');
    if (message.trim().length < 5) errors.message = t('support.form.errorMessage');
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setStatus('idle');
    try {
      // Prefix the subject with the sender's name so support has context even
      // though the contract only carries { email, subject, message, category }.
      const label = t(`support.form.categories.${category}`);
      const composedSubject = (
        subject.trim() || `${label}${name.trim() ? ` — ${name.trim()}` : ''}`
      ).slice(0, 120);
      await submitTicket({
        email: email.trim(),
        subject: composedSubject,
        message: (name.trim() ? `${name.trim()}:\n${message.trim()}` : message.trim()).slice(
          0,
          2000,
        ),
        category: SERVER_CATEGORY[category],
      });
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen testID="support-screen">
      <Stack.Screen options={{ title: t('support.title') }} />

      <View style={styles.container}>
        {/* Header */}
        <Text variant="h2">{t('support.title')}</Text>
        <Spacer size="xs" />
        <Text variant="body" color="muted">
          {t('support.subtitle')}
        </Text>

        <Spacer size="xl" />

        {/* FAQ */}
        <SectionHeader title={t('support.faqHeading')} />
        <Card padded={false}>
          {faq.map((item, i) => (
            <View key={i}>
              {i > 0 ? (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
              ) : null}
              <FaqItem q={item.q} a={item.a} />
            </View>
          ))}
        </Card>

        <Spacer size="xl" />

        {/* Contact form */}
        <SectionHeader title={t('support.contactHeading')} />

        {status === 'success' ? (
          <Card>
            <View style={styles.centerRow}>
              <Feather name="check-circle" size={iconSize.xl} color={colors.success} />
              <Spacer size="md" />
              <Text variant="title" center>
                {t('support.form.successTitle')}
              </Text>
              <Spacer size="xs" />
              <Text variant="body" color="muted" center>
                {t('support.form.successBody')}
              </Text>
              <Spacer size="lg" />
              <Button
                label={t('support.form.sendAnother')}
                icon="edit-3"
                variant="secondary"
                onPress={resetForm}
              />
            </View>
          </Card>
        ) : (
          <Card>
            <Text variant="subhead" color="muted">
              {t('support.contactIntro')}
            </Text>

            <Spacer size="lg" />
            <TextField
              label={t('support.form.name')}
              value={name}
              onChangeText={setName}
              placeholder={t('support.form.namePlaceholder')}
              autoCapitalize="words"
              editable={!submitting}
            />

            <Spacer size="md" />
            <TextField
              label={t('support.form.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('support.form.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              error={fieldError.email}
            />

            <Spacer size="md" />
            {/* Category chips */}
            <Text variant="caption" color="muted">
              {t('support.form.category')}
            </Text>
            <Spacer size="xs" />
            <View style={styles.chipGrid}>
              {CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCategory(c)}
                    disabled={submitting}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.secondary : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="callout" color={active ? 'primary' : 'foreground'}>
                      {t(`support.form.categories.${c}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Spacer size="md" />
            <TextField
              label={t('support.form.subject')}
              value={subject}
              onChangeText={setSubject}
              placeholder={t('support.form.subjectPlaceholder')}
              editable={!submitting}
            />

            <Spacer size="md" />
            <TextField
              label={t('support.form.message')}
              value={message}
              onChangeText={setMessage}
              placeholder={t('support.form.messagePlaceholder')}
              multiline
              numberOfLines={5}
              editable={!submitting}
              error={fieldError.message}
              style={styles.textArea}
            />

            {status === 'error' ? (
              <>
                <Spacer size="md" />
                <View style={styles.errorRow}>
                  <Feather name="alert-circle" size={iconSize.sm} color={colors.destructive} />
                  <View style={styles.flex}>
                    <Text variant="bodyMedium" color="destructive">
                      {t('support.form.errorTitle')}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('support.form.errorBody')}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            <Spacer size="lg" />
            <Button
              label={submitting ? t('support.form.sending') : t('support.form.submit')}
              icon="send"
              fullWidth
              loading={submitting}
              onPress={handleSubmit}
              testID="support-submit"
            />
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Centre + cap width so the page reads well on desktop web.
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { marginHorizontal: 'auto' } : null),
  },
  faqItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  centerRow: {
    alignItems: 'center',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    ...typography.body,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
});
