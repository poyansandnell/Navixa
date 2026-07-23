/**
 * Navixa — "Find friends" section for the Friends tab.
 *
 * Two entry points:
 *   1. Sync contacts — asks for a benefit-first permission, reads contact
 *      emails, hashes them client-side (sha256 hex of trimmed+lowercased email
 *      via expo-crypto), and matches them against Navixa players. Matches render
 *      with an "Add" (send friend request) action. Handles denied permission and
 *      zero matches gracefully. Hidden on web (expo-contacts is native-only).
 *   2. Invite friends — shares a Swedish/localized invite message with the
 *      caller's username + the app link via the React Native Share sheet.
 *
 * expo-contacts is loaded lazily so it never enters the web bundle.
 */
import React from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { Button, Card, SectionHeader, Spacer, Text } from '@/components/ui';
import { Avatar } from './Avatar';
import { matchContacts, sendFriendRequest, type ContactMatch } from './api';

const APP_LINK = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'navixa.app'}`;

async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

interface ContactDiscoveryProps {
  selfId: string;
  username: string;
}

export function ContactDiscovery({ selfId, username }: ContactDiscoveryProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const isWeb = Platform.OS === 'web';

  const [syncing, setSyncing] = React.useState(false);
  const [synced, setSynced] = React.useState(false);
  const [matches, setMatches] = React.useState<ContactMatch[]>([]);
  /** How many contact emails we scanned this sync (for the "no app yet" count). */
  const [contactCount, setContactCount] = React.useState(0);
  const [sentIds, setSentIds] = React.useState<Set<string>>(new Set());

  const runSync = React.useCallback(async () => {
    setSyncing(true);
    try {
      const Contacts = (await import('expo-contacts').catch(() => null)) as
        | (typeof import('expo-contacts'))
        | null;
      if (!Contacts) {
        showAlert(t('friends.discover.error'), '');
        return;
      }

      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          t('friends.discover.permissionDeniedTitle'),
          t('friends.discover.permissionDeniedBody'),
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails],
      });

      const emails = new Set<string>();
      for (const contact of data) {
        for (const e of contact.emails ?? []) {
          if (e.email) emails.add(e.email);
        }
      }

      const emailList = [...emails].slice(0, 500);
      const hashes = await Promise.all(emailList.map(hashEmail));
      const found = await matchContacts(hashes);
      setContactCount(emailList.length);
      setMatches(found);
      setSynced(true);
    } catch {
      showAlert(t('friends.discover.error'), '');
    } finally {
      setSyncing(false);
    }
  }, [t]);

  const handleSync = React.useCallback(() => {
    // Benefit-first permission ask before we touch the OS contacts prompt.
    showAlert(
      t('friends.discover.permissionTitle'),
      t('friends.discover.permissionBody'),
      [
        { text: t('friends.discover.permissionCancel'), style: 'cancel' },
        { text: t('friends.discover.permissionAllow'), onPress: () => void runSync() },
      ],
    );
  }, [t, runSync]);

  const handleAdd = React.useCallback(
    async (receiverId: string) => {
      try {
        await sendFriendRequest(selfId, receiverId);
        setSentIds((prev) => new Set(prev).add(receiverId));
      } catch (error) {
        showAlert(t('friends.discover.add'), (error as Error).message);
      }
    },
    [selfId, t],
  );

  const handleInvite = React.useCallback(async () => {
    try {
      await Share.share({
        message: t('friends.discover.shareMessage', { username, link: APP_LINK }),
      });
    } catch {
      // ignore (user cancelled the share sheet)
    }
  }, [t, username]);

  return (
    <View testID="contact-discovery">
      <SectionHeader title={t('friends.discover.title')} />
      <Card>
        {!isWeb ? (
          <>
            <View style={styles.actionRow}>
              <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
                <Feather name="users" size={iconSize.md} color={colors.accent} />
              </View>
              <View style={styles.actionBody}>
                <Text variant="bodyMedium">{t('friends.discover.syncContacts')}</Text>
                <Text variant="caption" color="muted">
                  {t('friends.discover.syncSubtitle')}
                </Text>
              </View>
            </View>
            <Spacer size="sm" />
            <Button
              label={syncing ? t('friends.discover.syncing') : t('friends.discover.syncContacts')}
              icon="refresh-cw"
              variant="secondary"
              size="sm"
              loading={syncing}
              onPress={handleSync}
              testID="sync-contacts-button"
            />
            <Spacer size="md" />
          </>
        ) : null}

        <View style={styles.actionRow}>
          <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
            <Feather name="share-2" size={iconSize.md} color={colors.accent} />
          </View>
          <View style={styles.actionBody}>
            <Text variant="bodyMedium">{t('friends.discover.invite')}</Text>
            <Text variant="caption" color="muted">
              {t('friends.discover.inviteSubtitle')}
            </Text>
          </View>
        </View>
        <Spacer size="sm" />
        <Button
          label={t('friends.discover.invite')}
          icon="send"
          variant="secondary"
          size="sm"
          onPress={handleInvite}
          testID="invite-friends-button"
        />
      </Card>

      {synced ? (
        <>
          <Spacer size="md" />
          {syncing ? (
            <View style={styles.centerPad}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : matches.length === 0 ? (
            /* Zero matches: friendly empty state with a prominent invite CTA. */
            <Card>
              <View style={styles.centerBody}>
                <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
                  <Feather name="user-plus" size={iconSize.md} color={colors.accent} />
                </View>
                <Spacer size="sm" />
                <Text variant="bodyMedium" center>
                  {t('friends.discover.noMatches')}
                </Text>
                <Spacer size="xs" />
                <Text variant="caption" color="muted" center>
                  {t('friends.discover.noMatchesBody')}
                </Text>
                <Spacer size="md" />
                <Button
                  label={t('friends.discover.inviteAll')}
                  icon="send"
                  fullWidth
                  onPress={handleInvite}
                  testID="invite-all-button"
                />
              </View>
            </Card>
          ) : (
            <>
              <SectionHeader title={t('friends.discover.suggestionsTitle')} />
              <Card padded={false}>
                {matches.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      styles.row,
                      i < matches.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <Avatar avatarUrl={m.avatarUrl} name={m.username} size={44} />
                    <View style={styles.rowBody}>
                      <Text variant="bodyMedium" numberOfLines={1}>
                        {m.displayName || m.username}
                      </Text>
                      <Text variant="caption" color="muted" numberOfLines={1}>
                        @{m.username}
                      </Text>
                    </View>
                    <Button
                      label={sentIds.has(m.id) ? t('friends.pending') : t('friends.discover.add')}
                      size="sm"
                      variant={sentIds.has(m.id) ? 'secondary' : 'primary'}
                      icon={sentIds.has(m.id) ? 'clock' : 'user-plus'}
                      disabled={sentIds.has(m.id)}
                      onPress={() => handleAdd(m.id)}
                    />
                  </View>
                ))}
              </Card>

              {/* Contacts without the app: prominent invite CTA. */}
              {contactCount > matches.length ? (
                <>
                  <Spacer size="md" />
                  <Card>
                    <View style={styles.actionRow}>
                      <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
                        <Feather name="user-plus" size={iconSize.md} color={colors.accent} />
                      </View>
                      <View style={styles.actionBody}>
                        <Text variant="bodyMedium">
                          {t('friends.discover.noAppCount', {
                            count: contactCount - matches.length,
                          })}
                        </Text>
                        <Text variant="caption" color="muted">
                          {t('friends.discover.noAppBody')}
                        </Text>
                      </View>
                    </View>
                    <Spacer size="sm" />
                    <Button
                      label={t('friends.discover.inviteAll')}
                      icon="send"
                      fullWidth
                      onPress={handleInvite}
                      testID="invite-remaining-button"
                    />
                  </Card>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: {
    flex: 1,
    gap: 2,
  },
  centerPad: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  centerBody: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
});
