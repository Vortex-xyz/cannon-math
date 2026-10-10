create table if not exists pilots (
  user_id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists weekly_scores (
  user_id text not null,
  week_id text not null,
  score integer not null,
  name text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_id)
);

create index if not exists weekly_scores_week_score_idx on weekly_scores (week_id, score desc);

create table if not exists legends (
  user_id text primary key,
  name text not null,
  score integer not null,
  week_id text not null
);

create table if not exists board_meta (
  key text primary key,
  value text not null
);
