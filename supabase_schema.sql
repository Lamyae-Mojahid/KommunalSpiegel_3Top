-- ============================================================
-- KommunalSpiegel — vollständiges Schema
-- Basis-Benchmark + Live-/Periodendaten + Förderprogramme
-- Supabase SQL Editor → New Query → alles einfügen → Run
-- ============================================================

create table if not exists kommunen (
  id          serial primary key,
  name        text not null unique,
  landkreis   text,
  einwohner   int,
  flaeche_km2 float,
  lat         float,
  lng         float,
  created_at  timestamptz default now()
);

create table if not exists sichten (
  id          serial primary key,
  nr          int not null unique,
  name        text not null,
  schicht     text check (schicht in ('Strategie','Plattform','Netzwerk')),
  einheit     text,
  beschreibung text
);

create table if not exists benchmark (
  id              serial primary key,
  kommune_id      int references kommunen(id) on delete cascade,
  sicht_nr        int not null,
  kennzahl        text not null,
  wert_num        float,
  wert_text       text,
  score_normiert  float,
  erhebungsjahr   int default 2024,
  quelle          text,
  quelle_url      text,
  quelle_typ      text default 'manuell',
  letzter_abruf   timestamptz,
  updated_at      timestamptz default now(),
  unique (kommune_id, sicht_nr, kennzahl, erhebungsjahr)
);

create table if not exists scores (
  id              serial primary key,
  kommune_id      int references kommunen(id) on delete cascade,
  erhebungsjahr   int not null,
  score_strategie float,
  score_plattform float,
  score_netzwerk  float,
  score_gesamt    float,
  rang            int,
  datenvollst     float,
  updated_at      timestamptz default now(),
  unique (kommune_id, erhebungsjahr)
);

create table if not exists massnahmen (
  id          serial primary key,
  kommune_id  int references kommunen(id) on delete cascade,
  titel       text not null,
  sicht_nr    int,
  status      text check (status in ('geplant','in Umsetzung','umgesetzt','abgebrochen')),
  zieldatum   date,
  notiz       text,
  updated_at  timestamptz default now()
);

create table if not exists chat_verlauf (
  id          serial primary key,
  session_id  text not null,
  kommune_id  int references kommunen(id),
  role        text check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz default now()
);

-- Live-Cache: Ergebnisse der externen API-/Perioden-Abrufe je Kommune
create table if not exists live_cache (
  id          serial primary key,
  kommune_id  int references kommunen(id) on delete cascade unique,
  daten       jsonb not null,
  abgerufen   timestamptz default now()
);

-- Sync-Protokoll: jeder automatische/manuelle Aktualisierungslauf
create table if not exists sync_log (
  id              serial primary key,
  synced_at       timestamptz default now(),
  kommunen_count  int,
  fehler_count    int,
  dauer_ms        int,
  details         jsonb
);

-- Datenquellen-Katalog
create table if not exists datenquellen (
  id             serial primary key,
  sicht_nr       int not null,
  name           text not null unique,
  url            text,
  rhythmus       text check (rhythmus in ('live','täglich','wöchentlich','monatlich','quartalsweise','jährlich')),
  letzter_abruf  timestamptz,
  status         text check (status in ('ok','fehler','offline','fallback','unbekannt')) default 'unbekannt',
  api_typ        text check (api_typ in ('rest','graphql','scraper','manuell','arcgis','csv')),
  updated_at     timestamptz default now()
);

-- Förderprogramme: können aus externer API oder Fallback-Liste aktualisiert werden
create table if not exists funding_programs (
  id              text primary key,
  titel           text not null,
  anbieter        text,
  sicht_nr        int,
  match_basis     float default 0.6,
  max_foerderung  text,
  frist           text,
  url             text,
  beschreibung    text,
  tags            text[],
  quelle          text default 'Fallback-Liste',
  quelle_url      text,
  zuletzt_geprueft timestamptz default now(),
  aktiv           boolean default true
);

create index if not exists idx_benchmark_kommune on benchmark(kommune_id);
create index if not exists idx_scores_gesamt on scores(score_gesamt desc);
create index if not exists idx_scores_rang on scores(rang);
create index if not exists idx_live_cache_kommune on live_cache(kommune_id);
create index if not exists idx_sync_log_time on sync_log(synced_at desc);

alter table kommunen enable row level security;
alter table benchmark enable row level security;
alter table scores enable row level security;
alter table massnahmen enable row level security;
alter table live_cache enable row level security;
alter table sync_log enable row level security;
alter table datenquellen enable row level security;
alter table funding_programs enable row level security;

-- Policies idempotent anlegen
DO $$ BEGIN
  CREATE POLICY "public read kommunen" ON kommunen FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read benchmark" ON benchmark FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read scores" ON scores FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read massnahmen" ON massnahmen FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read live_cache" ON live_cache FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read sync_log" ON sync_log FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read datenquellen" ON datenquellen FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public read funding_programs" ON funding_programs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

insert into sichten (nr, name, schicht, einheit) values
(1,  'IGEK-Abdeckung',          'Strategie', 'Sichten von 10'),
(2,  'Virtuelle Touren',        'Plattform',  'pro 1.000 EW'),
(3,  '360° Streetview',         'Plattform',  '% Straßennetz'),
(4,  'Ladeinfrastruktur',       'Plattform',  'Plätze / 1.000 EW'),
(5,  'Festnetz',                'Plattform',  'Mbit/s Ø'),
(6,  'Mobilfunk',               'Plattform',  'dBm Empfang'),
(7,  'Digitale Services',       'Plattform',  'Reifegrad 1–3'),
(8,  'Social Media',            'Netzwerk',   'Kanaldichte'),
(9,  'Vernetzung',              'Netzwerk',   'Netzwerkkennzahl'),
(10, 'Daseinsvorsorge',         'Netzwerk',   '% Abdeckung')
on conflict (nr) do update set name=excluded.name, schicht=excluded.schicht, einheit=excluded.einheit;

insert into datenquellen (sicht_nr, name, url, rhythmus, api_typ, status) values
(1, 'Manuelle Erhebung IGEK/ISEK',      '',                                           'jährlich',    'manuell', 'fallback'),
(2, 'OpenStreetMap Overpass',           'https://overpass-api.de',                    'täglich',     'rest',    'unbekannt'),
(3, 'Streetview/360 manuelle Prüfung',  '',                                           'jährlich',    'manuell', 'fallback'),
(4, 'Bundesnetzagentur Ladesäulen',     'https://ladestationen.api.bund.dev',         'täglich',     'rest',    'unbekannt'),
(5, 'Bundesnetzagentur Breitbandatlas', 'https://maps.bundesnetzagentur.de',          'wöchentlich', 'arcgis',  'unbekannt'),
(6, 'Bundesnetzagentur Mobilfunkatlas', 'https://maps.bundesnetzagentur.de',          'wöchentlich', 'arcgis',  'unbekannt'),
(7, 'Dashboard Digitale Verwaltung/OZG','https://dashboard.digitale-verwaltung.de',   'wöchentlich', 'rest',    'unbekannt'),
(8, 'Manuelle Erhebung Social Media',   '',                                           'jährlich',    'manuell', 'fallback'),
(0, 'Förderprogramme',                  'https://www.foerderdatenbank.de',            'wöchentlich', 'rest',    'unbekannt')
on conflict (name) do update set
  sicht_nr=excluded.sicht_nr,
  url=excluded.url,
  rhythmus=excluded.rhythmus,
  api_typ=excluded.api_typ,
  updated_at=now();
