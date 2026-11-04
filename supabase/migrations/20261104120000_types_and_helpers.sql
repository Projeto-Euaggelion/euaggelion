-- =============================================================================
-- Tipos e helpers gerais
-- =============================================================================

-- Schema não exposto pela API (PostgREST expõe só "public"): helpers de autorização
-- usados pelas policies ficam aqui e não podem ser chamados pelo client como RPC.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- Aplicações do Projeto Euaggelion (espelhado em @euaggelion/db/apps)
create type public.euaggelion_app as enum (
  'site', 'luther', 'commentary', 'reader', 'dictionary', 'chronology', 'atlas'
);

-- Papéis dentro do Luther (equipe de tradução e revisão)
create type public.luther_role as enum ('admin', 'translator', 'reviewer');

create type public.work_type as enum ('sermon', 'article', 'commentary');
create type public.work_status as enum ('draft', 'active', 'archived');
create type public.date_precision as enum ('year', 'month', 'day');

create type public.version_status as enum ('in_progress', 'published', 'archived');

create type public.segment_stage as enum ('original', 'translation', 'review', 'discussion', 'approved');
create type public.segment_kind as enum (
  'title', 'description', 'heading', 'paragraph', 'list_item', 'quote', 'footnote'
);

create type public.revision_origin as enum ('ai', 'human');

create type public.thread_side as enum ('source', 'target');
create type public.thread_status as enum ('open', 'resolved');

create type public.notification_kind as enum ('mention', 'reply', 'thread_resolved');

-- Mantém updated_at atualizado
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
