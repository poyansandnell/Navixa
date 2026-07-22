-- =============================================================================
-- Navixa — SEED DATA (DEV / PREVIEW ONLY)
-- =============================================================================
--  !!! DO NOT RUN AGAINST PRODUCTION !!!
--  This script inserts 20 fake demo players plus fabricated match history,
--  friendships, achievements, cosmetics, tournaments and daily quests so the
--  app has something to render in local/preview environments.
--
--  It inserts directly into auth.users with a fixed dummy password hash. These
--  accounts are NOT meant to be logged into and MUST NEVER exist in prod.
--
--  Run with:  supabase db reset   (auto-runs seed.sql)
--         or:  psql "$DATABASE_URL" -f supabase/seed.sql
--
--  NOTE: this script does NOT disable the on_auth_user_created trigger (the
--  pooled DB role used by `supabase db push` is not the owner of auth.users and
--  cannot ALTER its triggers). Instead, inserting into auth.users lets
--  handle_new_user() auto-create a profile + user_settings row, and we then
--  UPSERT (insert ... on conflict do update) the profiles to overwrite the
--  auto-generated username/display_name with the varied demo values we want.
--  Everything below is idempotent and safe to re-run.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fixed UUIDs for deterministic, re-runnable seeding.
-- -----------------------------------------------------------------------------
-- bcrypt hash of the string 'devpassword' (dev only).
-- 20 demo players with varied countries + ratings.
with demo (id, uname, display, country, locale, rating, wins, losses) as (
  values
    ('11111111-1111-1111-1111-111111111101'::uuid, 'nordic_ace',     'Nordic Ace',     'SE', 'sv', 2145, 210, 90),
    ('11111111-1111-1111-1111-111111111102'::uuid, 'kapten_kalle',   'Kapten Kalle',   'SE', 'sv', 1980, 150, 110),
    ('11111111-1111-1111-1111-111111111103'::uuid, 'sjoslag_sara',   'Sjöslag Sara',   'SE', 'sv', 1810, 88,  70),
    ('11111111-1111-1111-1111-111111111104'::uuid, 'oslo_orca',      'Oslo Orca',      'NO', 'en', 2260, 300, 120),
    ('11111111-1111-1111-1111-111111111105'::uuid, 'helsinki_hydra', 'Helsinki Hydra', 'FI', 'en', 1725, 60,  62),
    ('11111111-1111-1111-1111-111111111106'::uuid, 'copenhagen_cove','Copenhagen Cove','DK', 'en', 1555, 40,  55),
    ('11111111-1111-1111-1111-111111111107'::uuid, 'london_leviathan','London Leviathan','GB','en', 2410, 402, 150),
    ('11111111-1111-1111-1111-111111111108'::uuid, 'berlin_barracuda','Berlin Barracuda','DE','en', 2050, 175, 130),
    ('11111111-1111-1111-1111-111111111109'::uuid, 'paris_privateer','Paris Privateer','FR', 'en', 1890, 120, 95),
    ('11111111-1111-1111-1111-111111111110'::uuid, 'madrid_mariner', 'Madrid Mariner', 'ES', 'en', 1420, 30,  48),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'roma_reef',      'Roma Reef',      'IT', 'en', 1660, 55,  60),
    ('11111111-1111-1111-1111-111111111112'::uuid, 'nyc_nautilus',   'NYC Nautilus',   'US', 'en', 2320, 340, 140),
    ('11111111-1111-1111-1111-111111111113'::uuid, 'texas_torpedo',  'Texas Torpedo',  'US', 'en', 1770, 92,  88),
    ('11111111-1111-1111-1111-111111111114'::uuid, 'toronto_tide',   'Toronto Tide',   'CA', 'en', 1610, 48,  52),
    ('11111111-1111-1111-1111-111111111115'::uuid, 'saopaulo_swell', 'São Paulo Swell','BR', 'en', 1980, 160, 120),
    ('11111111-1111-1111-1111-111111111116'::uuid, 'tokyo_typhoon',  'Tokyo Typhoon',  'JP', 'en', 2500, 480, 160),
    ('11111111-1111-1111-1111-111111111117'::uuid, 'seoul_squall',   'Seoul Squall',   'KR', 'en', 2180, 240, 130),
    ('11111111-1111-1111-1111-111111111118'::uuid, 'sydney_surge',   'Sydney Surge',   'AU', 'en', 1345, 22,  40),
    ('11111111-1111-1111-1111-111111111119'::uuid, 'mumbai_monsoon', 'Mumbai Monsoon', 'IN', 'en', 1500, 35,  45),
    ('11111111-1111-1111-1111-111111111120'::uuid, 'cape_current',   'Cape Current',   'ZA', 'en', 1290, 15,  33)
)
-- 1) auth.users
, ins_users as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  select
    d.id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    d.uname || '@demo.navixa.local',
    crypt('devpassword', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', d.uname, 'display_name', d.display)
  from demo d
  on conflict (id) do nothing
  returning id
)
-- 2) profiles — UPSERT so we override whatever handle_new_user() auto-created
--    (the trigger fires on the auth.users insert above). This guarantees the
--    clean demo username/display_name/country/rating variety regardless of what
--    the trigger generated, and is fully re-runnable.
, ins_profiles as (
  insert into public.profiles (id, username, display_name, country_code, locale, xp, level, last_seen_at)
  select d.id, d.uname, d.display, d.country, d.locale,
         (d.wins * 25), greatest(1, (d.wins / 20) + 1), now() - (random() * interval '3 days')
  from demo d
  on conflict (id) do update set
    username     = excluded.username,
    display_name = excluded.display_name,
    country_code = excluded.country_code,
    locale       = excluded.locale,
    xp           = excluded.xp,
    level        = excluded.level,
    last_seen_at = excluded.last_seen_at,
    deleted_at   = null
  returning id
)
-- 3) user_settings — the trigger already creates a default row; ensure it
--    exists for any demo user (no-op when already present).
, ins_settings as (
  insert into public.user_settings (user_id)
  select d.id from demo d
  on conflict (user_id) do nothing
  returning user_id
)
-- 4) ranked ratings
insert into public.ratings (player_id, mode, rating, games_played, wins, losses, best_rating)
select d.id, 'ranked', d.rating, d.wins + d.losses, d.wins, d.losses, d.rating + 40
from demo d
on conflict (player_id, mode) do nothing;

-- -----------------------------------------------------------------------------
-- Friendships (canonical user_a < user_b) between a few players.
-- -----------------------------------------------------------------------------
insert into public.friendships (user_a, user_b)
select least(a, b), greatest(a, b) from (values
  ('11111111-1111-1111-1111-111111111101'::uuid, '11111111-1111-1111-1111-111111111102'::uuid),
  ('11111111-1111-1111-1111-111111111101'::uuid, '11111111-1111-1111-1111-111111111103'::uuid),
  ('11111111-1111-1111-1111-111111111104'::uuid, '11111111-1111-1111-1111-111111111107'::uuid),
  ('11111111-1111-1111-1111-111111111112'::uuid, '11111111-1111-1111-1111-111111111113'::uuid),
  ('11111111-1111-1111-1111-111111111116'::uuid, '11111111-1111-1111-1111-111111111117'::uuid)
) as f(a, b)
on conflict (user_a, user_b) do nothing;

-- A pending friend request.
insert into public.friend_requests (sender_id, receiver_id, status, message)
values ('11111111-1111-1111-1111-111111111105'::uuid,
        '11111111-1111-1111-1111-111111111106'::uuid,
        'pending', 'GG earlier, add me?')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Match history: a handful of finished ranked matches with players + moves.
-- -----------------------------------------------------------------------------
do $seed_matches$
declare
  v_match_id uuid;
  v_pairs record;
begin
  -- Idempotency guard: only seed match history once (rows use random UUIDs,
  -- so we key off the seed marker in match_events).
  if exists (
    select 1 from public.match_events
    where event_type = 'match_finalized' and payload @> '{"seed": true}'::jsonb
  ) then
    return;
  end if;

  for v_pairs in
    select * from (values
      ('11111111-1111-1111-1111-111111111101'::uuid, '11111111-1111-1111-1111-111111111102'::uuid, 0),
      ('11111111-1111-1111-1111-111111111104'::uuid, '11111111-1111-1111-1111-111111111107'::uuid, 1),
      ('11111111-1111-1111-1111-111111111116'::uuid, '11111111-1111-1111-1111-111111111112'::uuid, 0),
      ('11111111-1111-1111-1111-111111111113'::uuid, '11111111-1111-1111-1111-111111111114'::uuid, 1)
    ) as p(p0, p1, winner_seat)
  loop
    insert into public.matches (mode, status, is_rated, started_at, finished_at, turn_number,
                                winner_id)
    values ('ranked', 'finished', true,
            now() - interval '2 hours', now() - interval '1 hour', 42,
            case when v_pairs.winner_seat = 0 then v_pairs.p0 else v_pairs.p1 end)
    returning id into v_match_id;

    insert into public.match_players (match_id, player_id, seat, result, shots_fired, hits, ships_sunk)
    values
      (v_match_id, v_pairs.p0, 0,
       (case when v_pairs.winner_seat = 0 then 'win' else 'loss' end)::public.match_result, 30, 17, case when v_pairs.winner_seat = 0 then 5 else 3 end),
      (v_match_id, v_pairs.p1, 1,
       (case when v_pairs.winner_seat = 1 then 'win' else 'loss' end)::public.match_result, 28, 15, case when v_pairs.winner_seat = 1 then 5 else 2 end);

    insert into public.match_moves (match_id, player_id, move_number, target_x, target_y, is_hit)
    values
      (v_match_id, v_pairs.p0, 0, 3, 4, true),
      (v_match_id, v_pairs.p1, 1, 5, 5, false),
      (v_match_id, v_pairs.p0, 2, 3, 5, true);

    insert into public.match_events (match_id, event_type, payload)
    values (v_match_id, 'match_finalized', '{"seed": true}'::jsonb);
  end loop;
end$seed_matches$;

-- -----------------------------------------------------------------------------
-- Cosmetic test products.
-- -----------------------------------------------------------------------------
insert into public.cosmetic_items (code, type, rarity, name_key, description_key, price_coins, price_cents, is_default, sort_order)
values
  ('theme_classic',     'board_theme',    'common',    'cosmetic.theme_classic.name',     'cosmetic.theme_classic.desc',     0,    null, true,  0),
  ('theme_neon',        'board_theme',    'rare',      'cosmetic.theme_neon.name',        'cosmetic.theme_neon.desc',        500,  null, false, 1),
  ('theme_abyss',       'board_theme',    'epic',      'cosmetic.theme_abyss.name',       'cosmetic.theme_abyss.desc',       null, 299,  false, 2),
  ('ship_wooden',       'ship_skin',      'common',    'cosmetic.ship_wooden.name',       'cosmetic.ship_wooden.desc',       0,    null, true,  0),
  ('ship_ironclad',     'ship_skin',      'rare',      'cosmetic.ship_ironclad.name',     'cosmetic.ship_ironclad.desc',     750,  null, false, 1),
  ('ship_stealth',      'ship_skin',      'legendary', 'cosmetic.ship_stealth.name',      'cosmetic.ship_stealth.desc',      null, 499,  false, 2),
  ('frame_gold',        'avatar_frame',   'epic',      'cosmetic.frame_gold.name',        'cosmetic.frame_gold.desc',        1200, null, false, 0),
  ('emote_ggwp',        'emote',          'common',    'cosmetic.emote_ggwp.name',        'cosmetic.emote_ggwp.desc',        100,  null, false, 0),
  ('victory_fireworks', 'victory_effect', 'epic',      'cosmetic.victory_fireworks.name', 'cosmetic.victory_fireworks.desc', null, 199,  false, 0),
  ('title_admiral',     'title',          'legendary', 'cosmetic.title_admiral.name',     'cosmetic.title_admiral.desc',     2000, null, false, 0)
on conflict (code) do nothing;

-- Grant default cosmetics to all demo players + equip them.
insert into public.user_inventory (user_id, item_id, source)
select p.id, ci.id, 'default'
from public.profiles p
cross join public.cosmetic_items ci
where ci.is_default = true
on conflict (user_id, item_id) do nothing;

insert into public.equipped_cosmetics (user_id, type, item_id)
select ui.user_id, ci.type, ui.item_id
from public.user_inventory ui
join public.cosmetic_items ci on ci.id = ui.item_id
where ci.is_default = true
on conflict (user_id, type) do nothing;

-- Give the top player a couple of premium cosmetics.
insert into public.user_inventory (user_id, item_id, source)
select '11111111-1111-1111-1111-111111111116'::uuid, ci.id, 'grant'
from public.cosmetic_items ci
where ci.code in ('theme_abyss', 'title_admiral', 'frame_gold')
on conflict (user_id, item_id) do nothing;

-- -----------------------------------------------------------------------------
-- Achievements catalog + a couple of unlocks.
-- -----------------------------------------------------------------------------
insert into public.achievements (code, title_key, description_key, category, points, metric, goal)
values
  ('first_blood',   'achievement.first_blood.title',   'achievement.first_blood.desc',   'combat',   10, 'hits',           1),
  ('first_win',     'achievement.first_win.title',     'achievement.first_win.desc',     'progress', 20, 'wins',           1),
  ('ten_wins',      'achievement.ten_wins.title',      'achievement.ten_wins.desc',      'progress', 50, 'wins',           10),
  ('hundred_wins',  'achievement.hundred_wins.title',  'achievement.hundred_wins.desc',  'progress', 200,'wins',           100),
  ('sharpshooter',  'achievement.sharpshooter.title',  'achievement.sharpshooter.desc',  'skill',    75, 'accuracy_pct',   50),
  ('flawless',      'achievement.flawless.title',      'achievement.flawless.desc',      'skill',    100,'flawless_wins',  1)
on conflict (code) do nothing;

insert into public.user_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
select '11111111-1111-1111-1111-111111111116'::uuid, a.id, a.goal, true, now() - interval '1 day'
from public.achievements a
where a.code in ('first_blood', 'first_win', 'ten_wins', 'hundred_wins')
on conflict (user_id, achievement_id) do nothing;

-- -----------------------------------------------------------------------------
-- Daily quests + one in-progress user quest.
-- -----------------------------------------------------------------------------
insert into public.daily_quests (code, period, title_key, description_key, metric, goal, reward_xp, reward_coins)
values
  ('daily_play_3',   'daily',  'quest.daily_play_3.title',   'quest.daily_play_3.desc',   'matches_played', 3,  100, 50),
  ('daily_win_1',    'daily',  'quest.daily_win_1.title',    'quest.daily_win_1.desc',    'wins',           1,  150, 75),
  ('daily_hits_20',  'daily',  'quest.daily_hits_20.title',  'quest.daily_hits_20.desc',  'hits',           20, 120, 60),
  ('weekly_win_10',  'weekly', 'quest.weekly_win_10.title',  'quest.weekly_win_10.desc',  'wins',           10, 800, 400)
on conflict (code) do nothing;

insert into public.user_quests (user_id, quest_id, progress, status)
select '11111111-1111-1111-1111-111111111101'::uuid, q.id, 1, 'in_progress'
from public.daily_quests q where q.code = 'daily_play_3'
on conflict (user_id, quest_id, quest_date) do nothing;

-- -----------------------------------------------------------------------------
-- Tournaments: one upcoming + one ongoing, with entries, rounds, bracket.
-- -----------------------------------------------------------------------------
do $$
declare
  v_upcoming uuid;
  v_ongoing  uuid;
  v_round1   uuid;
  v_slot1    uuid;
  v_slot2    uuid;
begin
  -- Idempotency guard: only seed these named demo tournaments once.
  if exists (
    select 1 from public.tournaments
    where name in ('Weekend Blitz Cup', 'Global Admiral Invitational')
  ) then
    return;
  end if;

  -- Upcoming tournament (registration open).
  insert into public.tournaments (name, description, format, status, max_players, min_players,
                                  registration_opens_at, registration_closes_at, starts_at, ends_at)
  values ('Weekend Blitz Cup',
          'Fast single-elimination bracket. Open to all captains.',
          'single_elimination', 'upcoming', 16, 4,
          now() - interval '1 day', now() + interval '2 days',
          now() + interval '3 days', now() + interval '3 days' + interval '4 hours')
  returning id into v_upcoming;

  insert into public.tournament_entries (tournament_id, player_id, seed)
  select v_upcoming, p.id, row_number() over (order by r.rating desc)
  from public.profiles p
  join public.ratings r on r.player_id = p.id and r.mode = 'ranked'
  where p.id in (
    '11111111-1111-1111-1111-111111111101','11111111-1111-1111-1111-111111111104',
    '11111111-1111-1111-1111-111111111107','11111111-1111-1111-1111-111111111112',
    '11111111-1111-1111-1111-111111111116','11111111-1111-1111-1111-111111111117'
  )
  on conflict do nothing;

  -- Ongoing tournament with a first round in progress.
  insert into public.tournaments (name, description, format, status, max_players, min_players,
                                  registration_opens_at, registration_closes_at, starts_at)
  values ('Global Admiral Invitational',
          'Top-rated captains battle for the crown.',
          'single_elimination', 'ongoing', 4, 4,
          now() - interval '5 days', now() - interval '2 days', now() - interval '1 hour')
  returning id into v_ongoing;

  insert into public.tournament_entries (tournament_id, player_id, seed)
  values
    (v_ongoing, '11111111-1111-1111-1111-111111111116'::uuid, 1),
    (v_ongoing, '11111111-1111-1111-1111-111111111107'::uuid, 2),
    (v_ongoing, '11111111-1111-1111-1111-111111111112'::uuid, 3),
    (v_ongoing, '11111111-1111-1111-1111-111111111104'::uuid, 4)
  on conflict do nothing;

  insert into public.tournament_rounds (tournament_id, round_number, name, status, starts_at)
  values (v_ongoing, 1, 'Semifinals', 'ongoing', now() - interval '1 hour')
  returning id into v_round1;

  insert into public.tournament_matches (tournament_id, round_id, bracket_position,
                                         player_one_id, player_two_id, status)
  values
    (v_ongoing, v_round1, 1,
     '11111111-1111-1111-1111-111111111116'::uuid, '11111111-1111-1111-1111-111111111104'::uuid, 'active')
  returning id into v_slot1;

  insert into public.tournament_matches (tournament_id, round_id, bracket_position,
                                         player_one_id, player_two_id, status)
  values
    (v_ongoing, v_round1, 2,
     '11111111-1111-1111-1111-111111111107'::uuid, '11111111-1111-1111-1111-111111111112'::uuid, 'active')
  returning id into v_slot2;
end$$;

-- -----------------------------------------------------------------------------
-- A couple of in-app notifications for the first demo player.
-- (Guarded so re-running the seed does not pile up duplicate notifications.)
-- -----------------------------------------------------------------------------
insert into public.notifications (user_id, type, title, body, data)
select v.user_id, v.ntype::public.notification_type, v.title, v.body, '{"seed": true}'::jsonb
from (values
  ('11111111-1111-1111-1111-111111111101'::uuid, 'friend_request',
   'New friend request', 'Helsinki Hydra wants to be friends'),
  ('11111111-1111-1111-1111-111111111101'::uuid, 'achievement_unlocked',
   'Achievement unlocked', 'You reached 10 wins!')
) as v(user_id, ntype, title, body)
where not exists (
  select 1 from public.notifications n
  where n.user_id = v.user_id and n.title = v.title and n.data @> '{"seed": true}'::jsonb
);

-- -----------------------------------------------------------------------------
-- Public app config flags.
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, description, is_public)
values
  ('maintenance_mode',      'false'::jsonb,          'When true, blocks new matches', true),
  ('min_supported_version', '"1.0.0"'::jsonb,        'Minimum client version', true),
  ('matchmaking_enabled',   'true'::jsonb,           'Global matchmaking toggle', true),
  ('season',                '{"id":1,"name":"Season 1"}'::jsonb, 'Current ranked season', true)
on conflict (key) do nothing;

commit;

-- =============================================================================
-- END SEED (DEV / PREVIEW ONLY)
-- =============================================================================
