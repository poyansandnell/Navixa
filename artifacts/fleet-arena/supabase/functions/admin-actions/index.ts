// admin-actions — single admin/moderation dispatcher.
//
// Every request is `{ action, payload }`. The caller's JWT is verified, then
// their profiles.is_admin flag is checked SERVER-SIDE before any action runs.
// Each action validates its own payload with zod, performs the mutation with
// the service-role client, and writes an audit_logs row. The client UI never
// gates access on its own — this function is the sole authority.
import { serveJson } from '../_shared/serve.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceClient, writeAudit } from '../_shared/db.ts';
import { jsonResponse } from '../_shared/cors.ts';
import { appError } from '../_shared/errors.ts';
import { z } from 'npm:zod@3.23.8';

// ---------------------------------------------------------------------------
// Payload schemas
// ---------------------------------------------------------------------------
const uuid = z.string().uuid();

const searchUsersSchema = z.object({
  query: z.string().trim().min(1).max(48),
  limit: z.number().int().min(1).max(50).default(20),
});

const userIdSchema = z.object({ userId: uuid });

const suspendSchema = z.object({
  userId: uuid,
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  // ISO date/time; omit for a permanent suspension.
  until: z.string().datetime().optional(),
  permanent: z.boolean().default(false),
});

const listReportsSchema = z.object({
  status: z.enum(['open', 'reviewing', 'actioned', 'dismissed']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const resolveReportSchema = z.object({
  reportId: uuid,
  status: z.enum(['reviewing', 'actioned', 'dismissed']),
  resolution: z.string().max(2000).optional(),
});

const addBannedUsernameSchema = z.object({
  pattern: z.string().trim().min(2).max(48),
  reason: z.string().max(500).optional(),
});

const bannedUsernameIdSchema = z.object({ id: uuid });

const createTournamentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().max(2000).optional(),
  mode: z.enum(['ranked', 'casual', 'friendly', 'tournament', 'bot']).default('tournament'),
  format: z
    .enum(['single_elimination', 'double_elimination', 'round_robin', 'swiss'])
    .default('single_elimination'),
  maxPlayers: z.number().int().min(2).max(256).default(16),
  minPlayers: z.number().int().min(2).max(256).default(2),
  boardSize: z.number().int().min(8).max(16).default(10),
  entryFeeCoins: z.number().int().min(0).default(0),
  startsAt: z.string().datetime().optional(),
  registrationOpensAt: z.string().datetime().optional(),
  registrationClosesAt: z.string().datetime().optional(),
});

const updateTournamentStatusSchema = z.object({
  tournamentId: uuid,
  status: z.enum([
    'draft',
    'registration',
    'upcoming',
    'ongoing',
    'completed',
    'cancelled',
  ]),
});

const createQuestSchema = z.object({
  code: z.string().trim().min(2).max(64),
  period: z.enum(['daily', 'weekly', 'event']).default('daily'),
  titleKey: z.string().trim().min(1).max(120),
  descriptionKey: z.string().trim().min(1).max(120),
  metric: z.string().trim().min(1).max(48),
  goal: z.number().int().min(1).max(100000),
  rewardXp: z.number().int().min(0).max(100000).default(0),
  rewardCoins: z.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
});

const upsertCosmeticSchema = z.object({
  code: z.string().trim().min(2).max(64),
  type: z.enum([
    'board_theme',
    'ship_skin',
    'avatar_frame',
    'emote',
    'victory_effect',
    'title',
    'flag',
  ]),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).default('common'),
  nameKey: z.string().trim().min(1).max(120),
  descriptionKey: z.string().max(120).optional(),
  priceCoins: z.number().int().min(0).max(10000000).nullable().optional(),
  priceCents: z.number().int().min(0).max(10000000).nullable().optional(),
  isPurchasable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100000).default(0),
});

const annulMatchSchema = z.object({
  matchId: uuid,
  reason: z.string().max(1000).optional(),
});

const emptySchema = z.object({}).passthrough();

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    throw appError('INVALID_PAYLOAD', 'Payload failed validation', result.error.flatten());
  }
  return result.data;
}

const envelopeSchema = z.object({
  action: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});

serveJson(async (req) => {
  const user = await requireUser(req);
  const db = serviceClient();

  // --- Admin gate: re-check on every request, server-side. ---
  const { data: me } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    throw appError('FORBIDDEN', 'Admin privileges required');
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (_e) {
    rawBody = {};
  }
  const envelope = envelopeSchema.safeParse(rawBody);
  if (!envelope.success) {
    throw appError('INVALID_PAYLOAD', 'Expected { action, payload }', envelope.error.flatten());
  }
  const { action, payload } = envelope.data;

  // Small audit helper that always tags the acting admin.
  const audit = (
    a: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) => writeAudit({ actorId: user.id, action: a, entityType, entityId, metadata });

  switch (action) {
    // -------------------------------------------------------------------
    case 'search_users': {
      const p = parse(searchUsersSchema, payload);
      const { data, error } = await db
        .from('profiles')
        .select('id, username, display_name, country_code, is_admin, is_bot, level, created_at')
        .ilike('username', `%${p.query}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(p.limit);
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_search_users', undefined, undefined, { query: p.query });
      return jsonResponse({ ok: true, users: data ?? [] });
    }

    // -------------------------------------------------------------------
    case 'get_user_status': {
      const p = parse(userIdSchema, payload);
      const [profileRes, actionsRes, ratingsRes] = await Promise.all([
        db
          .from('profiles')
          .select('id, username, display_name, country_code, is_admin, is_bot, level, xp, created_at, last_seen_at')
          .eq('id', p.userId)
          .maybeSingle(),
        db
          .from('moderation_actions')
          .select('id, action, reason, notes, expires_at, is_active, created_at')
          .eq('target_id', p.userId)
          .order('created_at', { ascending: false })
          .limit(25),
        db
          .from('ratings')
          .select('mode, rating, games_played, wins, losses, draws')
          .eq('player_id', p.userId),
      ]);
      if (!profileRes.data) throw appError('NOT_FOUND', 'User not found');
      const now = Date.now();
      const activeSuspension = (actionsRes.data ?? []).find(
        (a) =>
          a.is_active &&
          (a.action === 'suspend' || a.action === 'ban') &&
          (a.expires_at == null || new Date(a.expires_at).getTime() > now),
      );
      return jsonResponse({
        ok: true,
        profile: profileRes.data,
        moderationActions: actionsRes.data ?? [],
        ratings: ratingsRes.data ?? [],
        suspended: Boolean(activeSuspension),
        suspension: activeSuspension ?? null,
      });
    }

    // -------------------------------------------------------------------
    case 'suspend_account': {
      const p = parse(suspendSchema, payload);
      if (p.userId === user.id) {
        throw appError('INVALID_PAYLOAD', 'You cannot suspend yourself');
      }
      const { data: target } = await db
        .from('profiles')
        .select('id')
        .eq('id', p.userId)
        .maybeSingle();
      if (!target) throw appError('NOT_FOUND', 'User not found');

      const expiresAt = p.permanent ? null : p.until ?? null;
      if (!p.permanent && !expiresAt) {
        throw appError('INVALID_PAYLOAD', 'Provide `until` or set `permanent: true`');
      }

      // Deactivate previous suspensions so only one is active.
      await db
        .from('moderation_actions')
        .update({ is_active: false })
        .eq('target_id', p.userId)
        .in('action', ['suspend', 'ban'])
        .eq('is_active', true);

      const { data: modAction, error } = await db
        .from('moderation_actions')
        .insert({
          target_id: p.userId,
          moderator_id: user.id,
          action: p.permanent ? 'ban' : 'suspend',
          reason: p.reason ?? null,
          notes: p.notes ?? null,
          expires_at: expiresAt,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw appError('INTERNAL', error.message);

      await audit('admin_suspend_account', 'profile', p.userId, {
        permanent: p.permanent,
        expires_at: expiresAt,
        moderation_action_id: modAction.id,
      });
      return jsonResponse({ ok: true, moderationActionId: modAction.id });
    }

    // -------------------------------------------------------------------
    case 'unsuspend_account': {
      const p = parse(userIdSchema, payload);
      const { error } = await db
        .from('moderation_actions')
        .update({ is_active: false })
        .eq('target_id', p.userId)
        .in('action', ['suspend', 'ban', 'mute', 'shadow_ban'])
        .eq('is_active', true);
      if (error) throw appError('INTERNAL', error.message);

      // Record the lift as an explicit unban action for the trail.
      await db.from('moderation_actions').insert({
        target_id: p.userId,
        moderator_id: user.id,
        action: 'unban',
        is_active: false,
      });

      await audit('admin_unsuspend_account', 'profile', p.userId);
      return jsonResponse({ ok: true });
    }

    // -------------------------------------------------------------------
    case 'list_reports': {
      const p = parse(listReportsSchema, payload);
      let q = db
        .from('reports')
        .select(
          'id, reporter_id, reported_id, match_id, category, description, status, resolution, handled_by, handled_at, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(p.limit);
      if (p.status) q = q.eq('status', p.status);
      const { data, error } = await q;
      if (error) throw appError('INTERNAL', error.message);
      return jsonResponse({ ok: true, reports: data ?? [] });
    }

    // -------------------------------------------------------------------
    case 'resolve_report': {
      const p = parse(resolveReportSchema, payload);
      const { data: report } = await db
        .from('reports')
        .select('id')
        .eq('id', p.reportId)
        .maybeSingle();
      if (!report) throw appError('NOT_FOUND', 'Report not found');

      const { error } = await db
        .from('reports')
        .update({
          status: p.status,
          resolution: p.resolution ?? null,
          handled_by: user.id,
          handled_at: new Date().toISOString(),
        })
        .eq('id', p.reportId);
      if (error) throw appError('INTERNAL', error.message);

      await audit('admin_resolve_report', 'report', p.reportId, { status: p.status });
      return jsonResponse({ ok: true });
    }

    // -------------------------------------------------------------------
    case 'list_banned_usernames': {
      parse(emptySchema, payload);
      const { data, error } = await db
        .from('banned_usernames')
        .select('id, pattern, reason, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw appError('INTERNAL', error.message);
      return jsonResponse({ ok: true, banned: data ?? [] });
    }

    // -------------------------------------------------------------------
    case 'add_banned_username': {
      const p = parse(addBannedUsernameSchema, payload);
      const { data, error } = await db
        .from('banned_usernames')
        .upsert(
          { pattern: p.pattern, reason: p.reason ?? null, is_active: true, created_by: user.id },
          { onConflict: 'pattern' },
        )
        .select('id')
        .single();
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_add_banned_username', 'banned_username', data.id, { pattern: p.pattern });
      return jsonResponse({ ok: true, id: data.id });
    }

    // -------------------------------------------------------------------
    case 'remove_banned_username': {
      const p = parse(bannedUsernameIdSchema, payload);
      const { error } = await db
        .from('banned_usernames')
        .update({ is_active: false })
        .eq('id', p.id);
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_remove_banned_username', 'banned_username', p.id);
      return jsonResponse({ ok: true });
    }

    // -------------------------------------------------------------------
    case 'create_tournament': {
      const p = parse(createTournamentSchema, payload);
      if (p.maxPlayers < p.minPlayers) {
        throw appError('INVALID_PAYLOAD', 'maxPlayers must be >= minPlayers');
      }
      const { data, error } = await db
        .from('tournaments')
        .insert({
          name: p.name,
          description: p.description ?? null,
          mode: p.mode,
          format: p.format,
          max_players: p.maxPlayers,
          min_players: p.minPlayers,
          board_size: p.boardSize,
          entry_fee_coins: p.entryFeeCoins,
          status: 'draft',
          created_by: user.id,
          starts_at: p.startsAt ?? null,
          registration_opens_at: p.registrationOpensAt ?? null,
          registration_closes_at: p.registrationClosesAt ?? null,
        })
        .select('id')
        .single();
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_create_tournament', 'tournament', data.id, { name: p.name });
      return jsonResponse({ ok: true, tournamentId: data.id });
    }

    // -------------------------------------------------------------------
    case 'update_tournament_status': {
      const p = parse(updateTournamentStatusSchema, payload);
      const { data: t } = await db
        .from('tournaments')
        .select('id')
        .eq('id', p.tournamentId)
        .maybeSingle();
      if (!t) throw appError('TOURNAMENT_NOT_FOUND');
      const { error } = await db
        .from('tournaments')
        .update({ status: p.status })
        .eq('id', p.tournamentId);
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_update_tournament_status', 'tournament', p.tournamentId, {
        status: p.status,
      });
      return jsonResponse({ ok: true });
    }

    // -------------------------------------------------------------------
    case 'create_daily_quest': {
      const p = parse(createQuestSchema, payload);
      const { data, error } = await db
        .from('daily_quests')
        .insert({
          code: p.code,
          period: p.period,
          title_key: p.titleKey,
          description_key: p.descriptionKey,
          metric: p.metric,
          goal: p.goal,
          reward_xp: p.rewardXp,
          reward_coins: p.rewardCoins,
          is_active: p.isActive,
        })
        .select('id')
        .single();
      if (error) {
        if ((error.message ?? '').includes('duplicate')) {
          throw appError('CONFLICT', 'A quest with that code already exists');
        }
        throw appError('INTERNAL', error.message);
      }
      await audit('admin_create_daily_quest', 'daily_quest', data.id, { code: p.code });
      return jsonResponse({ ok: true, questId: data.id });
    }

    // -------------------------------------------------------------------
    case 'upsert_cosmetic_item': {
      const p = parse(upsertCosmeticSchema, payload);
      const { data, error } = await db
        .from('cosmetic_items')
        .upsert(
          {
            code: p.code,
            type: p.type,
            rarity: p.rarity,
            name_key: p.nameKey,
            description_key: p.descriptionKey ?? null,
            price_coins: p.priceCoins ?? null,
            price_cents: p.priceCents ?? null,
            is_purchasable: p.isPurchasable,
            sort_order: p.sortOrder,
          },
          { onConflict: 'code' },
        )
        .select('id')
        .single();
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_upsert_cosmetic_item', 'cosmetic_item', data.id, { code: p.code });
      return jsonResponse({ ok: true, itemId: data.id });
    }

    // -------------------------------------------------------------------
    case 'annul_match': {
      const p = parse(annulMatchSchema, payload);
      const { data: match } = await db
        .from('matches')
        .select('id, status')
        .eq('id', p.matchId)
        .maybeSingle();
      if (!match) throw appError('MATCH_NOT_FOUND');
      if (match.status === 'annulled') {
        return jsonResponse({ ok: true, alreadyAnnulled: true });
      }
      const { error } = await db.rpc('annul_match', {
        p_match_id: p.matchId,
        p_admin_id: user.id,
        p_reason: p.reason ?? null,
      });
      if (error) throw appError('INTERNAL', error.message);
      await audit('admin_annul_match', 'match', p.matchId, { reason: p.reason ?? null });
      return jsonResponse({ ok: true });
    }

    // -------------------------------------------------------------------
    case 'platform_stats': {
      parse(emptySchema, payload);
      const readCount = async (
        // deno-lint-ignore no-explicit-any
        query: any,
      ): Promise<number> => {
        const { count, error } = await query;
        if (error) throw appError('INTERNAL', error.message);
        return count ?? 0;
      };
      const head = (table: string) =>
        db.from(table).select('*', { count: 'exact', head: true });

      const [
        totalUsers,
        totalMatches,
        activeMatches,
        openReports,
        totalTournaments,
        activeSuspensions,
      ] = await Promise.all([
        readCount(head('profiles').is('deleted_at', null)),
        readCount(head('matches')),
        readCount(head('matches').in('status', ['active', 'placing'])),
        readCount(head('reports').eq('status', 'open')),
        readCount(head('tournaments')),
        readCount(head('moderation_actions').eq('is_active', true).in('action', ['suspend', 'ban'])),
      ]);

      return jsonResponse({
        ok: true,
        stats: {
          totalUsers,
          totalMatches,
          activeMatches,
          openReports,
          totalTournaments,
          activeSuspensions,
        },
      });
    }

    default:
      throw appError('INVALID_PAYLOAD', `Unknown action: ${action}`);
  }
});
