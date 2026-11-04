-- =============================================================================
-- Traduções, versões, segmentos, revisões e eventos de etapa
-- =============================================================================

-- No máximo uma tradução por obra e idioma; retraduzir cria uma nova versão.
create table public.translations (
  id                    uuid primary key default gen_random_uuid(),
  work_id               uuid not null references public.works (id) on delete cascade,
  language              text not null check (language ~ '^[a-z]{2}(-[A-Z]{2})?$' and language not like 'en%'),
  published_version_id  uuid,   -- FK adicionada abaixo
  created_at            timestamptz not null default now(),
  unique (work_id, language)
);

create table public.translation_versions (
  id                   uuid primary key default gen_random_uuid(),
  translation_id       uuid not null references public.translations (id) on delete cascade,
  version              integer not null check (version > 0),
  source_version_id    uuid not null references public.source_versions (id) on delete restrict,
  based_on_version_id  uuid references public.translation_versions (id) on delete set null,
  status               public.version_status not null default 'in_progress',
  credits              text,                      -- tradutor/revisor (editável)
  translator_id        uuid references public.profiles (id) on delete set null,
  reviewer_id          uuid references public.profiles (id) on delete set null,
  mdx                  text,                      -- MDX reconstruído, gravado na publicação
  created_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  published_at         timestamptz,
  unique (translation_id, version),
  constraint translation_versions_published_has_mdx
    check (status <> 'published' or (mdx is not null and published_at is not null))
);

-- Uma versão publicada e no máximo uma em andamento por tradução
create unique index translation_versions_one_published
  on public.translation_versions (translation_id) where status = 'published';
create unique index translation_versions_one_in_progress
  on public.translation_versions (translation_id) where status = 'in_progress';

create index translation_versions_source_version_id_idx on public.translation_versions (source_version_id);
create index translation_versions_based_on_idx on public.translation_versions (based_on_version_id);
create index translation_versions_translator_idx on public.translation_versions (translator_id);
create index translation_versions_reviewer_idx on public.translation_versions (reviewer_id);
create index translation_versions_created_by_idx on public.translation_versions (created_by);

alter table public.translations
  add constraint translations_published_version_fk
  foreign key (published_version_id) references public.translation_versions (id) on delete set null;
create index translations_published_version_idx on public.translations (published_version_id);

create table public.segments (
  id                      uuid primary key default gen_random_uuid(),
  translation_version_id  uuid not null references public.translation_versions (id) on delete cascade,
  source_segment_id       uuid not null references public.source_segments (id) on delete restrict,
  position                integer not null check (position >= 0),
  text                    text not null default '',
  stage                   public.segment_stage not null default 'original',
  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (translation_version_id, source_segment_id),
  unique (translation_version_id, position),
  unique (id, translation_version_id)   -- alvo da FK composta de comment_threads
);

create index segments_source_segment_id_idx on public.segments (source_segment_id);
create index segments_updated_by_idx on public.segments (updated_by);
create index segments_stage_idx on public.segments (translation_version_id, stage);

create table public.segment_revisions (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid not null references public.segments (id) on delete cascade,
  text        text not null,
  origin      public.revision_origin not null,
  model       text,
  tokens      integer check (tokens is null or tokens >= 0),
  author_id   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index segment_revisions_segment_idx on public.segment_revisions (segment_id, created_at desc);
create index segment_revisions_author_idx on public.segment_revisions (author_id);

create table public.stage_events (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid not null references public.segments (id) on delete cascade,
  from_stage  public.segment_stage,
  to_stage    public.segment_stage not null,
  actor_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index stage_events_segment_idx on public.stage_events (segment_id, created_at desc);
create index stage_events_actor_idx on public.stage_events (actor_id);

create trigger translation_versions_set_updated_at before update on public.translation_versions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- Criação de traduções/versões/segmentos e publicação: só via RPC (workflow).
-- Revisões e eventos de etapa: só por trigger.
-- -----------------------------------------------------------------------------

alter table public.translations enable row level security;
alter table public.translation_versions enable row level security;
alter table public.segments enable row level security;
alter table public.segment_revisions enable row level security;
alter table public.stage_events enable row level security;

create policy "Colaboradores leem traduções" on public.translations
  for select to authenticated using ((select public.is_member()));

create policy "Colaboradores leem versões" on public.translation_versions
  for select to authenticated using ((select public.is_member()));
create policy "Admins e revisores editam dados da versão" on public.translation_versions
  for update to authenticated
  using ((select public.has_role('admin', 'reviewer')))
  with check ((select public.has_role('admin', 'reviewer')));

create policy "Colaboradores leem segmentos" on public.segments
  for select to authenticated using ((select public.is_member()));
create policy "Colaboradores editam segmentos" on public.segments
  for update to authenticated
  using ((select public.is_member()))
  with check ((select public.is_member()));

create policy "Colaboradores leem revisões" on public.segment_revisions
  for select to authenticated using ((select public.is_member()));

create policy "Colaboradores leem eventos de etapa" on public.stage_events
  for select to authenticated using ((select public.is_member()));
