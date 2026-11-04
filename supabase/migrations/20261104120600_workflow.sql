-- =============================================================================
-- Fluxo editorial: regras aplicadas no banco (ver CLAUDE.md › Fluxo editorial)
--
--   original ─► translation ─► review ─► approved
--                   ▲            │  ▲
--                   └── discussion ◄┘
--
-- Sem auth.uid() (service role / SQL editor) as checagens de PAPEL são puladas,
-- mas as regras de transição, aprovação e publicação continuam valendo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Threads abertas na tradução de um segmento (bloqueiam a aprovação)
create function public.open_target_threads(p_segment_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.comment_threads
   where segment_id = p_segment_id and side = 'target' and status = 'open';
$$;

-- Papel exigido para a transição; null = transição inválida
create function public.stage_transition_roles(p_from public.segment_stage, p_to public.segment_stage)
returns public.app_role[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_from = 'original'    and p_to = 'translation' then array['admin','translator','reviewer']
    when p_from = 'translation' and p_to = 'review'      then array['admin','translator','reviewer']
    when p_from = 'translation' and p_to = 'discussion'  then array['admin','translator','reviewer']
    when p_from = 'review'      and p_to = 'discussion'  then array['admin','translator','reviewer']
    when p_from = 'review'      and p_to = 'translation' then array['admin','reviewer']   -- devolver
    when p_from = 'review'      and p_to = 'approved'    then array['admin','reviewer']
    when p_from = 'discussion'  and p_to = 'translation' then array['admin','reviewer']   -- revisor fecha
    when p_from = 'discussion'  and p_to = 'review'      then array['admin','reviewer']
    when p_from = 'approved'    and p_to = 'review'      then array['admin','reviewer']   -- reabrir
    else null
  end::public.app_role[];
$$;

create function public.version_is_editable(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.translation_versions
     where id = p_version_id and status = 'in_progress'
  );
$$;

-- -----------------------------------------------------------------------------
-- Segmentos: validação de edição e de etapa
-- -----------------------------------------------------------------------------

create function public.guard_segment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roles public.app_role[];
  v_uid uuid := auth.uid();
begin
  if new.translation_version_id is distinct from old.translation_version_id
     or new.source_segment_id is distinct from old.source_segment_id
     or new.position is distinct from old.position then
    raise exception 'Versão, segmento-fonte e posição de um segmento não podem ser alterados.'
      using errcode = '42501';
  end if;

  if new.text is not distinct from old.text and new.stage is not distinct from old.stage then
    return new;
  end if;

  if not public.version_is_editable(new.translation_version_id) then
    raise exception 'Esta versão não está em andamento; crie uma nova versão para alterá-la.'
      using errcode = '42501';
  end if;

  -- Edição de texto
  if new.text is distinct from old.text then
    if old.stage = 'approved' and new.stage = 'approved' then
      raise exception 'Segmento aprovado: mova-o para revisão antes de editar.' using errcode = '42501';
    end if;
    -- primeiro texto de um segmento ainda não traduzido → etapa "translation"
    if old.stage = 'original' and new.stage = 'original' and length(trim(new.text)) > 0 then
      new.stage := 'translation';
    end if;
    new.updated_by := coalesce(v_uid, new.updated_by);
    new.updated_at := now();
  end if;

  -- Mudança de etapa
  if new.stage is distinct from old.stage then
    v_roles := public.stage_transition_roles(old.stage, new.stage);
    if v_roles is null then
      raise exception 'Transição de etapa inválida: % → %.', old.stage, new.stage using errcode = '22023';
    end if;
    if v_uid is not null and not public.has_role(variadic v_roles) then
      raise exception 'Seu papel não permite mover o segmento de % para %.', old.stage, new.stage
        using errcode = '42501';
    end if;
    if new.stage = 'approved' then
      if length(trim(new.text)) = 0 then
        raise exception 'Não é possível aprovar um segmento sem tradução.' using errcode = '22023';
      end if;
      if public.open_target_threads(new.id) > 0 then
        raise exception 'Resolva as threads abertas na tradução antes de aprovar o segmento.'
          using errcode = '22023';
      end if;
    end if;
    new.updated_by := coalesce(v_uid, new.updated_by);
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger segments_guard_update
  before update on public.segments
  for each row execute function public.guard_segment_update();

-- Histórico: revisão de texto e evento de etapa
-- A origem/modelo da revisão vêm de settings locais (ver apply_ai_translation);
-- o padrão é edição humana.
create function public.record_segment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text := nullif(current_setting('luther.revision_origin', true), '');
  v_model  text := nullif(current_setting('luther.revision_model', true), '');
  v_tokens text := nullif(current_setting('luther.revision_tokens', true), '');
begin
  if new.text is distinct from old.text then
    insert into public.segment_revisions (segment_id, text, origin, model, tokens, author_id)
    values (
      new.id,
      new.text,
      coalesce(v_origin, 'human')::public.revision_origin,
      v_model,
      v_tokens::integer,
      auth.uid()
    );
  end if;

  if new.stage is distinct from old.stage then
    insert into public.stage_events (segment_id, from_stage, to_stage, actor_id)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;

  return null;
end;
$$;

create trigger segments_record_history
  after update on public.segments
  for each row execute function public.record_segment_history();

-- -----------------------------------------------------------------------------
-- Threads e comentários
-- -----------------------------------------------------------------------------

create function public.guard_thread_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.version_is_editable(new.translation_version_id) then
    raise exception 'Só é possível comentar em versões em andamento.' using errcode = '42501';
  end if;
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

create trigger comment_threads_guard_insert
  before insert on public.comment_threads
  for each row execute function public.guard_thread_insert();

create function public.guard_thread_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.translation_version_id is distinct from old.translation_version_id
     or new.segment_id is distinct from old.segment_id
     or new.side is distinct from old.side
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'A origem de uma thread não pode ser alterada.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      -- quem abriu, revisores e admins resolvem
      if v_uid is not null and v_uid is distinct from old.created_by
         and not public.has_role('admin', 'reviewer') then
        raise exception 'Apenas quem abriu a thread, revisores ou admins podem resolvê-la.'
          using errcode = '42501';
      end if;
      new.resolved_by := coalesce(v_uid, new.resolved_by);
      new.resolved_at := now();
    else
      new.resolved_by := null;
      new.resolved_at := null;
    end if;
  else
    new.resolved_by := old.resolved_by;
    new.resolved_at := old.resolved_at;
  end if;

  return new;
end;
$$;

create trigger comment_threads_guard_update
  before update on public.comment_threads
  for each row execute function public.guard_thread_update();

create function public.guard_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.comment_threads where id = new.thread_id and status = 'resolved') then
      raise exception 'Thread resolvida: reabra-a para comentar.' using errcode = '22023';
    end if;
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.created_at := now();
    new.edited_at := null;
    new.mentions := coalesce(
      (select array_agg(distinct m) from unnest(new.mentions) m where m is distinct from new.author_id),
      '{}'
    );
  else
    if new.thread_id is distinct from old.thread_id
       or new.author_id is distinct from old.author_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Só o texto e as menções de um comentário podem ser editados.' using errcode = '42501';
    end if;
    if new.body is distinct from old.body or new.mentions is distinct from old.mentions then
      new.edited_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_guard
  before insert or update on public.comments
  for each row execute function public.guard_comment();

-- -----------------------------------------------------------------------------
-- Notificações (no app; o envio por e-mail via Mailgun lê emailed_at is null)
-- -----------------------------------------------------------------------------

create function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Menções
  insert into public.notifications (user_id, kind, actor_id, thread_id, comment_id)
  select p.id, 'mention', new.author_id, new.thread_id, new.id
    from public.profiles p
   where p.id = any (new.mentions) and p.active;

  -- Respostas: participantes da thread (quem abriu + quem comentou), exceto autor e mencionados
  insert into public.notifications (user_id, kind, actor_id, thread_id, comment_id)
  select distinct participant, 'reply'::public.notification_kind, new.author_id, new.thread_id, new.id
    from (
      select t.created_by as participant from public.comment_threads t where t.id = new.thread_id
      union
      select c.author_id from public.comments c where c.thread_id = new.thread_id and c.id <> new.id
    ) parts
    join public.profiles p on p.id = parts.participant and p.active
   where participant is not null
     and participant is distinct from new.author_id
     and not (participant = any (new.mentions));

  return null;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create function public.notify_on_thread_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, actor_id, thread_id)
  select distinct participant, 'thread_resolved'::public.notification_kind, new.resolved_by, new.id
    from (
      select new.created_by as participant
      union
      select c.author_id from public.comments c where c.thread_id = new.id
    ) parts
    join public.profiles p on p.id = parts.participant and p.active
   where participant is not null and participant is distinct from new.resolved_by;
  return null;
end;
$$;

create trigger comment_threads_notify_resolved
  after update of status on public.comment_threads
  for each row when (old.status = 'open' and new.status = 'resolved')
  execute function public.notify_on_thread_resolved();

-- -----------------------------------------------------------------------------
-- Versões da tradução: campos de ciclo de vida só mudam pela publicação
-- -----------------------------------------------------------------------------

create function public.guard_translation_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('luther.publishing', true), '') <> 'on'
     and (new.status is distinct from old.status
          or new.mdx is distinct from old.mdx
          or new.published_at is distinct from old.published_at
          or new.translation_id is distinct from old.translation_id
          or new.version is distinct from old.version
          or new.source_version_id is distinct from old.source_version_id
          or new.based_on_version_id is distinct from old.based_on_version_id) then
    raise exception 'Use publish_translation_version() para publicar; os demais campos de ciclo de vida são fixos.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger translation_versions_guard_update
  before update on public.translation_versions
  for each row execute function public.guard_translation_version_update();

create function public.guard_translation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('luther.publishing', true), '') <> 'on' then
    raise exception 'Traduções só são alteradas pela publicação.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger translations_guard_update
  before update on public.translations
  for each row execute function public.guard_translation_update();

-- =============================================================================
-- RPCs
-- =============================================================================

-- Cria uma nova versão (imutável) do original a partir do MDX já segmentado pelo app.
-- p_segments: [{ "position": 0, "kind": "paragraph", "text": "...", "ast_path": "..." }, ...]
create function public.create_source_version(
  p_work_id uuid,
  p_mdx text,
  p_segments jsonb,
  p_frontmatter jsonb default '{}'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores criam versões do original.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_segments) <> 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'A versão precisa de ao menos um segmento.' using errcode = '22023';
  end if;

  perform 1 from public.works where id = p_work_id for update;
  if not found then
    raise exception 'Obra não encontrada.' using errcode = 'P0002';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.source_versions where work_id = p_work_id;

  insert into public.source_versions (work_id, version, mdx, frontmatter, notes, created_by)
  values (p_work_id, v_version, p_mdx, coalesce(p_frontmatter, '{}'::jsonb), p_notes, auth.uid())
  returning id into v_id;

  insert into public.source_segments (source_version_id, position, kind, text, ast_path)
  select v_id, s.position, s.kind, s.text, s.ast_path
    from jsonb_to_recordset(p_segments)
      as s(position integer, kind public.segment_kind, text text, ast_path text);

  return v_id;
end;
$$;

-- Cria a próxima versão da tradução de uma obra num idioma (cria a tradução se preciso).
--   p_mode = 'copy'  → reaproveita o texto da versão anterior onde o segmento-fonte não mudou
--                      (esses segmentos vão para "review"; os demais ficam em "original")
--   p_mode = 'blank' → todos os segmentos em "original"
-- p_source_version_id: padrão = versão mais recente do original.
create function public.create_translation_version(
  p_work_id uuid,
  p_language text,
  p_mode text default 'copy',
  p_source_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_translation_id uuid;
  v_source_version_id uuid;
  v_based_on uuid;
  v_version integer;
  v_id uuid;
begin
  if auth.uid() is not null and not public.has_role('admin', 'reviewer') then
    raise exception 'Apenas administradores e revisores criam versões de tradução.' using errcode = '42501';
  end if;
  if p_mode not in ('copy', 'blank') then
    raise exception 'Modo inválido: use copy ou blank.' using errcode = '22023';
  end if;

  v_source_version_id := coalesce(p_source_version_id, public.latest_source_version_id(p_work_id));
  if v_source_version_id is null
     or not exists (select 1 from public.source_versions where id = v_source_version_id and work_id = p_work_id) then
    raise exception 'A obra não tem essa versão do original.' using errcode = '22023';
  end if;

  insert into public.translations (work_id, language)
  values (p_work_id, p_language)
  on conflict (work_id, language) do nothing;

  select id into v_translation_id
    from public.translations
   where work_id = p_work_id and language = p_language
   for update;

  if exists (select 1 from public.translation_versions
              where translation_id = v_translation_id and status = 'in_progress') then
    raise exception 'Já existe uma versão em andamento para esta tradução.' using errcode = '23505';
  end if;

  select id into v_based_on
    from public.translation_versions
   where translation_id = v_translation_id
   order by version desc
   limit 1;

  select coalesce(max(version), 0) + 1 into v_version
    from public.translation_versions where translation_id = v_translation_id;

  insert into public.translation_versions (translation_id, version, source_version_id, based_on_version_id, created_by)
  values (v_translation_id, v_version, v_source_version_id, v_based_on, auth.uid())
  returning id into v_id;

  insert into public.segments (translation_version_id, source_segment_id, position, text, stage)
  select v_id, ss.id, ss.position, coalesce(prev.text, ''),
         case when coalesce(trim(prev.text), '') <> '' then 'review' else 'original' end::public.segment_stage
    from public.source_segments ss
    left join lateral (
      select s.text
        from public.segments s
        join public.source_segments pss on pss.id = s.source_segment_id
       where p_mode = 'copy'
         and s.translation_version_id = v_based_on
         and pss.kind = ss.kind
         and pss.text = ss.text
       order by abs(pss.position - ss.position)
       limit 1
    ) prev on true
   where ss.source_version_id = v_source_version_id;

  return v_id;
end;
$$;

-- Grava uma tradução feita pela IA (DeepSeek), registrando origem/modelo/tokens na revisão.
-- Roda com os privilégios de quem chama: RLS e regras de etapa continuam valendo.
create function public.apply_ai_translation(
  p_segment_id uuid,
  p_text text,
  p_model text,
  p_tokens integer default null
)
returns public.segments
language plpgsql
set search_path = ''
as $$
declare
  v_row public.segments;
begin
  perform set_config('luther.revision_origin', 'ai', true);
  perform set_config('luther.revision_model', coalesce(p_model, ''), true);
  perform set_config('luther.revision_tokens', coalesce(p_tokens::text, ''), true);

  update public.segments
     set text = p_text,
         stage = case when stage = 'original' then 'translation'::public.segment_stage else stage end
   where id = p_segment_id
  returning * into v_row;

  perform set_config('luther.revision_origin', '', true);
  perform set_config('luther.revision_model', '', true);
  perform set_config('luther.revision_tokens', '', true);

  if v_row.id is null then
    raise exception 'Segmento não encontrado.' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Publica uma versão: exige todos os segmentos aprovados e nenhuma thread aberta na tradução.
-- p_mdx: MDX reconstruído pelo app (packages/mdx). Arquiva a versão publicada anterior.
create function public.publish_translation_version(p_version_id uuid, p_mdx text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.translation_versions;
  v_pending integer;
  v_threads integer;
begin
  if auth.uid() is not null and not public.has_role('admin', 'reviewer') then
    raise exception 'Apenas administradores e revisores publicam traduções.' using errcode = '42501';
  end if;
  if p_mdx is null or length(trim(p_mdx)) = 0 then
    raise exception 'O MDX publicado não pode ser vazio.' using errcode = '22023';
  end if;

  select * into v_version from public.translation_versions where id = p_version_id for update;
  if v_version.id is null then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;
  if v_version.status <> 'in_progress' then
    raise exception 'Só versões em andamento podem ser publicadas.' using errcode = '22023';
  end if;

  select count(*) filter (where stage <> 'approved') into v_pending
    from public.segments where translation_version_id = p_version_id;
  if v_pending > 0 then
    raise exception 'Ainda há % segmento(s) não aprovado(s).', v_pending using errcode = '22023';
  end if;

  select count(*) into v_threads
    from public.comment_threads
   where translation_version_id = p_version_id and side = 'target' and status = 'open';
  if v_threads > 0 then
    raise exception 'Ainda há % thread(s) aberta(s) na tradução.', v_threads using errcode = '22023';
  end if;

  perform set_config('luther.publishing', 'on', true);

  update public.translation_versions
     set status = 'archived'
   where translation_id = v_version.translation_id and status = 'published';

  update public.translation_versions
     set status = 'published', mdx = p_mdx, published_at = now()
   where id = p_version_id;

  update public.translations
     set published_version_id = p_version_id
   where id = v_version.translation_id;

  perform set_config('luther.publishing', '', true);
end;
$$;

revoke execute on function public.create_source_version(uuid, text, jsonb, jsonb, text) from public, anon;
revoke execute on function public.create_translation_version(uuid, text, text, uuid) from public, anon;
revoke execute on function public.apply_ai_translation(uuid, text, text, integer) from public, anon;
revoke execute on function public.publish_translation_version(uuid, text) from public, anon;
grant execute on function public.create_source_version(uuid, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.create_translation_version(uuid, text, text, uuid) to authenticated;
grant execute on function public.apply_ai_translation(uuid, text, text, integer) to authenticated;
grant execute on function public.publish_translation_version(uuid, text) to authenticated;

-- =============================================================================
-- Visão geral das versões (progresso por etapa, pendências, desatualização)
-- =============================================================================

create view public.translation_version_overview
with (security_invoker = on)
as
select
  tv.id,
  tv.translation_id,
  t.work_id,
  t.language,
  tv.version,
  tv.status,
  tv.source_version_id,
  tv.translator_id,
  tv.reviewer_id,
  tv.created_at,
  tv.published_at,
  coalesce(seg.total, 0)        as segments_total,
  coalesce(seg.original, 0)     as segments_original,
  coalesce(seg.translation, 0)  as segments_translation,
  coalesce(seg.review, 0)       as segments_review,
  coalesce(seg.discussion, 0)   as segments_discussion,
  coalesce(seg.approved, 0)     as segments_approved,
  coalesce(thr.open_target, 0)  as open_target_threads,
  coalesce(thr.open_source, 0)  as open_source_threads,
  tv.source_version_id is distinct from public.latest_source_version_id(t.work_id) as is_outdated,
  (tv.status = 'in_progress'
     and coalesce(seg.total, 0) > 0
     and coalesce(seg.approved, 0) = coalesce(seg.total, 0)
     and coalesce(thr.open_target, 0) = 0) as can_publish
from public.translation_versions tv
join public.translations t on t.id = tv.translation_id
left join lateral (
  select count(*)                                       as total,
         count(*) filter (where stage = 'original')     as original,
         count(*) filter (where stage = 'translation')  as translation,
         count(*) filter (where stage = 'review')       as review,
         count(*) filter (where stage = 'discussion')   as discussion,
         count(*) filter (where stage = 'approved')     as approved
    from public.segments s where s.translation_version_id = tv.id
) seg on true
left join lateral (
  select count(*) filter (where side = 'target' and status = 'open') as open_target,
         count(*) filter (where side = 'source' and status = 'open') as open_source
    from public.comment_threads c where c.translation_version_id = tv.id
) thr on true;

revoke all on public.translation_version_overview from anon;
