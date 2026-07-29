-- Aqua Hero Founding Hero database setup for Supabase
-- Run this complete file once in Supabase > SQL Editor.

create table if not exists public.founding_heroes (
  id bigint generated always as identity primary key,
  member_number integer not null unique check (member_number between 1 and 1000),
  first_name text not null check (char_length(first_name) between 2 and 50),
  email text not null check (char_length(email) <= 254),
  favorite_flavor text not null check (favorite_flavor in ('Watermelon','Strawberry','Lemon Lime','Passion Fruit')),
  marketing_consent boolean not null default true check (marketing_consent = true),
  consented_at timestamptz not null default now(),
  source text,
  campaign text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);

create unique index if not exists founding_heroes_email_unique
  on public.founding_heroes (lower(email));

alter table public.founding_heroes enable row level security;
revoke all on table public.founding_heroes from anon, authenticated;

create or replace function public.reserve_founding_hero(
  p_email text,
  p_first_name text,
  p_favorite_flavor text,
  p_source text default null,
  p_campaign text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.founding_heroes%rowtype;
  v_joined integer;
  v_next integer;
begin
  perform pg_advisory_xact_lock(4271761000::bigint);

  select * into v_existing
  from public.founding_heroes
  where lower(email) = lower(trim(p_email))
  limit 1;

  select count(*)::integer into v_joined from public.founding_heroes;

  if found then
    return jsonb_build_object(
      'status','existing',
      'memberNumber',v_existing.member_number,
      'firstName',v_existing.first_name,
      'favoriteFlavor',v_existing.favorite_flavor,
      'joined',v_joined,
      'remaining',greatest(1000-v_joined,0),
      'full',v_joined >= 1000
    );
  end if;

  if v_joined >= 1000 then
    return jsonb_build_object('status','full','joined',1000,'remaining',0,'full',true);
  end if;

  select coalesce(max(member_number),0)+1 into v_next from public.founding_heroes;

  insert into public.founding_heroes (
    member_number, first_name, email, favorite_flavor, marketing_consent,
    source, campaign, utm_source, utm_medium, utm_campaign
  ) values (
    v_next, trim(p_first_name), lower(trim(p_email)), p_favorite_flavor, true,
    nullif(trim(p_source),''), nullif(trim(p_campaign),''), nullif(trim(p_utm_source),''),
    nullif(trim(p_utm_medium),''), nullif(trim(p_utm_campaign),'')
  );

  v_joined := v_joined + 1;
  return jsonb_build_object(
    'status','created',
    'memberNumber',v_next,
    'firstName',trim(p_first_name),
    'favoriteFlavor',p_favorite_flavor,
    'joined',v_joined,
    'remaining',greatest(1000-v_joined,0),
    'full',v_joined >= 1000
  );
end;
$$;

create or replace function public.get_founding_hero_count()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'joined',count(*)::integer,
    'remaining',greatest(1000-count(*)::integer,0),
    'full',count(*) >= 1000
  )
  from public.founding_heroes;
$$;

revoke all on function public.reserve_founding_hero(text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.get_founding_hero_count() from public, anon, authenticated;
grant execute on function public.reserve_founding_hero(text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.get_founding_hero_count() to service_role;
