-- =============================================================================
-- Threads de comentários ancoradas em trechos, comentários e notificações
-- =============================================================================

create table public.comment_threads (
  id                      uuid primary key default gen_random_uuid(),
  translation_version_id  uuid not null,
  segment_id              uuid not null,
  side                    public.thread_side not null,       -- source (EN) | target (tradução)
  quote                   text not null check (length(quote) > 0),
  prefix                  text not null default '',          -- contexto para re-ancorar
  suffix                  text not null default '',
  start_offset            integer not null check (start_offset >= 0),
  end_offset              integer not null,
  detached                boolean not null default false,    -- trecho não encontrado após edição
  status                  public.thread_status not null default 'open',
  created_by              uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  resolved_by             uuid references public.profiles (id) on delete set null,
  resolved_at             timestamptz,
  check (end_offset > start_offset),
  check ((status = 'resolved') = (resolved_at is not null)),
  -- o segmento precisa pertencer à versão
  foreign key (segment_id, translation_version_id)
    references public.segments (id, translation_version_id) on delete cascade
);

create index comment_threads_version_idx on public.comment_threads (translation_version_id, status);
create index comment_threads_segment_idx on public.comment_threads (segment_id, side, status);
create index comment_threads_created_by_idx on public.comment_threads (created_by);
create index comment_threads_resolved_by_idx on public.comment_threads (resolved_by);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.comment_threads (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  body        text not null check (length(trim(body)) > 0),
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index comments_thread_idx on public.comments (thread_id, created_at);
create index comments_author_idx on public.comments (author_id);

-- Notificações no app; emailed_at é preenchido pelo envio via Mailgun (servidor)
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.notification_kind not null,
  actor_id    uuid references public.profiles (id) on delete set null,
  thread_id   uuid not null references public.comment_threads (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_pending_email_idx on public.notifications (created_at) where emailed_at is null;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_thread_idx on public.notifications (thread_id);
create index notifications_comment_idx on public.notifications (comment_id);

create trigger comment_threads_set_updated_at before update on public.comment_threads
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.comment_threads enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

create policy "Colaboradores leem threads" on public.comment_threads
  for select to authenticated using ((select private.is_luther_member()));
create policy "Colaboradores criam threads" on public.comment_threads
  for insert to authenticated
  with check ((select private.is_luther_member()) and created_by = (select auth.uid()));
create policy "Colaboradores atualizam threads" on public.comment_threads
  for update to authenticated
  using ((select private.is_luther_member()))
  with check ((select private.is_luther_member()));   -- quem pode resolver é checado por trigger
create policy "Autor ou admin remove thread" on public.comment_threads
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_luther_admin()));

create policy "Colaboradores leem comentários" on public.comments
  for select to authenticated using ((select private.is_luther_member()));
create policy "Colaboradores comentam" on public.comments
  for insert to authenticated
  with check ((select private.is_luther_member()) and author_id = (select auth.uid()));
create policy "Autor edita o próprio comentário" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "Autor ou admin remove comentário" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_luther_admin()));

create policy "Usuário lê as próprias notificações" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Usuário marca as próprias notificações" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Usuário remove as próprias notificações" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
