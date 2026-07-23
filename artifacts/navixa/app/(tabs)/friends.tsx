import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useColors } from '@/hooks/useColors';
import { iconSize, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useIsGuest } from '@/hooks/useIsGuest';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Spacer,
  Text,
} from '@/components/ui';
import {
  Avatar,
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  ContactDiscovery,
  fetchFriends,
  fetchPendingRequests,
  promptReport,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  touchPresence,
  type FriendEntry,
  type ProfileRow,
  type RequestWithProfile,
} from '@/features/social';

export default function FriendsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { user, profile } = useAuth();
  const isGuest = useIsGuest();
  const selfId = user?.id ?? null;

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<RequestWithProfile[]>([]);
  const [outgoing, setOutgoing] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!selfId) return;
    setLoading(true);
    try {
      const [f, reqs] = await Promise.all([
        fetchFriends(selfId),
        fetchPendingRequests(selfId),
      ]);
      setFriends(f);
      setIncoming(reqs.incoming);
      setOutgoing(reqs.outgoing);
    } catch (error) {
      showAlert(t('common.retry'), (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selfId, t]);

  useFocusEffect(
    useCallback(() => {
      if (selfId && !isGuest) {
        void touchPresence(selfId);
        void load();
      }
    }, [selfId, isGuest, load]),
  );

  // Debounced search.
  useEffect(() => {
    if (!selfId || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const found = await searchUsers(query, selfId);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, selfId]);

  const handleSend = async (receiverId: string) => {
    if (!selfId) return;
    try {
      await sendFriendRequest(selfId, receiverId);
      setSentIds((prev) => new Set(prev).add(receiverId));
    } catch (error) {
      showAlert(t('friends.addFriend'), (error as Error).message);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      await load();
    } catch (error) {
      showAlert(t('friends.accept'), (error as Error).message);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      setIncoming((prev) => prev.filter((r) => r.request.id !== requestId));
    } catch (error) {
      showAlert(t('friends.reject'), (error as Error).message);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await cancelFriendRequest(requestId);
      setOutgoing((prev) => prev.filter((r) => r.request.id !== requestId));
    } catch (error) {
      showAlert(t('friends.cancel'), (error as Error).message);
    }
  };

  const handleRemove = (entry: FriendEntry) => {
    showAlert(t('friends.removeTitle'), t('friends.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('friends.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(entry.friendshipId);
            setFriends((prev) => prev.filter((f) => f.friendshipId !== entry.friendshipId));
          } catch (error) {
            showAlert(t('friends.remove'), (error as Error).message);
          }
        },
      },
    ]);
  };

  const handleFriendActions = (entry: FriendEntry) => {
    showAlert(entry.profile.username, t('friends.actions'), [
      {
        text: t('friends.invite'),
        onPress: () => {
          router.push({
            pathname: '/game/setup',
            params: { invite: entry.profile.id, inviteName: entry.profile.username },
          });
        },
      },
      { text: t('friends.remove'), style: 'destructive', onPress: () => handleRemove(entry) },
      {
        text: t('friends.block'),
        style: 'destructive',
        onPress: () => confirmBlock(entry.profile.id),
      },
      { text: t('friends.report'), onPress: () => promptReport(entry.profile.id) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const confirmBlock = (targetId: string) => {
    if (!selfId) return;
    showAlert(t('social.block.title'), t('social.block.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.block.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(selfId, targetId);
            await load();
          } catch (error) {
            showAlert(t('friends.block'), (error as Error).message);
          }
        },
      },
    ]);
  };

  if (isGuest) {
    return (
      <Screen testID="friends-screen">
        <Text variant="h1">{t('friends.title')}</Text>
        <Text variant="subhead" color="muted">
          {t('friends.subtitle')}
        </Text>
        <Spacer size="xl" />
        <Card>
          <Text variant="title">{t('profile.guestUpgradeTitle')}</Text>
          <Spacer size="xs" />
          <Text variant="subhead" color="muted">
            {t('profile.guestUpgradeBody')}
          </Text>
          <Spacer size="md" />
          <Button
            label={t('onboarding.getStarted.createAccount')}
            fullWidth
            onPress={() => router.push('/(auth)/sign-up')}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen testID="friends-screen">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="h1">{t('friends.title')}</Text>
          <Text variant="subhead" color="muted">
            {t('friends.subtitle')}
          </Text>
        </View>
      </View>

      <Spacer size="lg" />

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={iconSize.sm} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('friends.searchPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.foreground }]}
          testID="friends-search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button">
            <Feather name="x" size={iconSize.sm} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {query.trim().length >= 2 ? (
        <>
          <Spacer size="md" />
          <SectionHeader title={t('friends.searchResults')} />
          <Card padded={false}>
            {searching ? (
              <View style={styles.centerPad}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : results.length === 0 ? (
              <View style={styles.centerPad}>
                <Text variant="subhead" color="muted">
                  {t('friends.noResults')}
                </Text>
              </View>
            ) : (
              results.map((p, i) => (
                <UserRow
                  key={p.id}
                  profile={p}
                  divider={i < results.length - 1}
                  onPress={() => router.push(`/profile/${p.id}`)}
                  trailing={
                    <Button
                      label={sentIds.has(p.id) ? t('friends.pending') : t('friends.addFriend')}
                      size="sm"
                      variant={sentIds.has(p.id) ? 'secondary' : 'primary'}
                      icon={sentIds.has(p.id) ? 'clock' : 'user-plus'}
                      disabled={sentIds.has(p.id)}
                      onPress={() => handleSend(p.id)}
                    />
                  }
                />
              ))
            )}
          </Card>
        </>
      ) : null}

      <Spacer size="xl" />

      {/* Find friends: contacts sync + invite */}
      {selfId ? (
        <>
          <ContactDiscovery selfId={selfId} username={profile?.username ?? ''} />
          <Spacer size="xl" />
        </>
      ) : null}

      {loading ? (
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          {/* Incoming requests */}
          {incoming.length > 0 ? (
            <>
              <SectionHeader title={t('friends.incomingRequests')} />
              <Card padded={false}>
                {incoming.map((r, i) =>
                  r.profile ? (
                    <UserRow
                      key={r.request.id}
                      profile={r.profile}
                      divider={i < incoming.length - 1}
                      onPress={() => router.push(`/profile/${r.profile!.id}`)}
                      trailing={
                        <View style={styles.reqActions}>
                          <Button
                            label={t('friends.accept')}
                            size="sm"
                            variant="success"
                            onPress={() => handleAccept(r.request.id)}
                          />
                          <Button
                            label={t('friends.reject')}
                            size="sm"
                            variant="ghost"
                            onPress={() => handleReject(r.request.id)}
                          />
                        </View>
                      }
                    />
                  ) : null,
                )}
              </Card>
              <Spacer size="xl" />
            </>
          ) : null}

          {/* Outgoing requests */}
          {outgoing.length > 0 ? (
            <>
              <SectionHeader title={t('friends.outgoingRequests')} />
              <Card padded={false}>
                {outgoing.map((r, i) =>
                  r.profile ? (
                    <UserRow
                      key={r.request.id}
                      profile={r.profile}
                      divider={i < outgoing.length - 1}
                      onPress={() => router.push(`/profile/${r.profile!.id}`)}
                      trailing={
                        <Button
                          label={t('friends.cancel')}
                          size="sm"
                          variant="ghost"
                          onPress={() => handleCancel(r.request.id)}
                        />
                      }
                    />
                  ) : null,
                )}
              </Card>
              <Spacer size="xl" />
            </>
          ) : null}

          {/* Friends list */}
          <SectionHeader title={t('friends.yourFriends')} />
          {friends.length === 0 ? (
            <Card>
              <EmptyState
                icon="users"
                title={t('friends.empty')}
                description={t('friends.emptyDescription')}
              />
            </Card>
          ) : (
            <Card padded={false}>
              {friends.map((entry, i) => (
                <UserRow
                  key={entry.friendshipId}
                  profile={entry.profile}
                  divider={i < friends.length - 1}
                  onPress={() => router.push(`/profile/${entry.profile.id}`)}
                  subtitle={`${entry.rating ?? '—'} · ${
                    entry.online ? t('social.online') : t('social.offline')
                  }`}
                  online={entry.online}
                  trailing={
                    <Pressable
                      onPress={() => handleFriendActions(entry)}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <Feather name="more-vertical" size={iconSize.md} color={colors.mutedForeground} />
                    </Pressable>
                  }
                />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function UserRow({
  profile,
  subtitle,
  trailing,
  divider,
  online,
  onPress,
}: {
  profile: ProfileRow;
  subtitle?: string;
  trailing?: React.ReactNode;
  divider?: boolean;
  online?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  const name = profile.display_name || profile.username;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.row,
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View>
        <Avatar avatarUrl={profile.avatar_url} name={profile.username} size={44} />
        {online ? (
          <View style={[styles.presenceDot, { backgroundColor: colors.success, borderColor: colors.card }]} />
        ) : null}
      </View>
      <View style={styles.rowBody}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          <Text variant="caption" color="muted" numberOfLines={1}>
            @{profile.username}
          </Text>
        )}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    padding: 0,
  },
  centerPad: {
    padding: spacing.xl,
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
  reqActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  presenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
