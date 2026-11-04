-- =============================================================================
-- Conteúdo-fonte (sempre em inglês): autores, obras e versões da fonte
-- =============================================================================

create table public.authors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio         text,
  era         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.works (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.authors (id) on delete restrict,
  type            public.work_type not null,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null check (length(trim(title)) > 0),   -- título original (EN)
  description     text,                                            -- descrição original (EN)
  date_text       text,                                            -- 1857 | 1857-03 | 1857-03-15
  date_precision  public.date_precision,
  source          text,                                            -- edição/origem do texto em inglês
  credits         text,                                            -- créditos da edição em inglês
  status          public.work_status not null default 'draft',
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (author_id, slug),
  constraint works_date_matches_precision check (
    (date_text is null and date_precision is null)
    or (date_precision = 'year'  and date_text ~ '^\d{4}$')
    or (date_precision = 'month' and date_text ~ '^\d{4}-(0[1-9]|1[0-2])$')
    or (date_precision = 'day'   and date_text ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$')
  )
);

create index works_author_id_idx on public.works (author_id);
create index works_created_by_idx on public.works (created_by);

-- Cada correção do original gera uma nova versão imutável
create table public.source_versions (
  id           uuid primary key default gen_random_uuid(),
  work_id      uuid not null references public.works (id) on delete cascade,
  version      integer not null check (version > 0),
  mdx          text not null,
  frontmatter  jsonb not null default '{}'::jsonb,
  notes        text,                                  -- o que mudou nesta versão
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (work_id, version)
);

create index source_versions_created_by_idx on public.source_versions (created_by);

create table public.source_segments (
  id                 uuid primary key default gen_random_uuid(),
  source_version_id  uuid not null references public.source_versions (id) on delete cascade,
  position           integer not null check (position >= 0),
  kind               public.segment_kind not null,
  text               text not null,
  ast_path           text not null,   -- caminho do nó na AST (reconstrução do MDX)
  unique (source_version_id, position)
);

create trigger authors_set_updated_at before update on public.authors
  for each row execute function public.set_updated_at();
create trigger works_set_updated_at before update on public.works
  for each row execute function public.set_updated_at();

-- Versões da fonte e seus segmentos são imutáveis (só podem ser removidos em cascata)
create function public.prevent_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% é imutável: crie uma nova versão.', tg_table_name using errcode = '42501';
end;
$$;

create trigger source_versions_immutable before update on public.source_versions
  for each row execute function public.prevent_update();
create trigger source_segments_immutable before update on public.source_segments
  for each row execute function public.prevent_update();

-- Versão mais recente da fonte de uma obra
create function private.latest_source_version_id(p_work_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.source_versions
   where work_id = p_work_id
   order by version desc
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- RLS: colaboradores leem; admins gerenciam. Escrita de versões via RPC (workflow).
-- -----------------------------------------------------------------------------

alter table public.authors enable row level security;
alter table public.works enable row level security;
alter table public.source_versions enable row level security;
alter table public.source_segments enable row level security;

create policy "Colaboradores leem autores" on public.authors
  for select to authenticated using ((select private.is_luther_member()));
create policy "Admins inserem autores" on public.authors
  for insert to authenticated with check ((select private.is_luther_admin()));
create policy "Admins editam autores" on public.authors
  for update to authenticated using ((select private.is_luther_admin())) with check ((select private.is_luther_admin()));
create policy "Admins removem autores" on public.authors
  for delete to authenticated using ((select private.is_luther_admin()));

create policy "Colaboradores leem obras" on public.works
  for select to authenticated using ((select private.is_luther_member()));
create policy "Admins inserem obras" on public.works
  for insert to authenticated with check ((select private.is_luther_admin()));
create policy "Admins editam obras" on public.works
  for update to authenticated using ((select private.is_luther_admin())) with check ((select private.is_luther_admin()));
create policy "Admins removem obras" on public.works
  for delete to authenticated using ((select private.is_luther_admin()));

create policy "Colaboradores leem versões da fonte" on public.source_versions
  for select to authenticated using ((select private.is_luther_member()));

create policy "Colaboradores leem segmentos da fonte" on public.source_segments
  for select to authenticated using ((select private.is_luther_member()));
