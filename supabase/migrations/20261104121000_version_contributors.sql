-- =============================================================================
-- Colaboradores de cada versão da tradução (tradutores e revisores)
--
-- Derivados do histórico que o banco já grava (segment_revisions e stage_events), não do
-- papel da conta: conta o que a pessoa fez nesta versão.
--   - tradutor: editou o texto (à mão ou aplicando IA) com o segmento em original/translation;
--   - revisor:  editou o texto em review/discussion/approved, ou fez uma transição de etapa
--               reservada a revisores (aprovar, devolver, fechar discussão, reabrir).
-- Texto copiado da versão anterior (modo 'copy') mantém o crédito dos tradutores de origem.
-- Na publicação, a lista é congelada em translation_versions.contributors (só nome e papéis).
-- =============================================================================

-- Etapa do segmento no momento da edição (distingue tradução de revisão)
alter table public.segment_revisions add column stage public.segment_stage;
comment on column public.segment_revisions.stage is 'Etapa do segmento quando o texto foi editado (antes da edição).';

create or replace function public.record_segment_history()
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
    insert into public.segment_revisions (segment_id, text, origin, model, tokens, author_id, stage)
    values (
      new.id,
      new.text,
      coalesce(v_origin, 'human')::public.revision_origin,
      v_model,
      v_tokens::integer,
      auth.uid(),
      old.stage
    );
  end if;

  if new.stage is distinct from old.stage then
    insert into public.stage_events (segment_id, from_stage, to_stage, actor_id)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;

  return null;
end;
$$;


-- Lista congelada na publicação: [{ "name": "…", "roles": ["translator", "reviewer"] }]
alter table public.translation_versions
  add column contributors jsonb not null default '[]'::jsonb
  constraint translation_versions_contributors_is_array check (jsonb_typeof(contributors) = 'array');
comment on column public.translation_versions.contributors is
  'Colaboradores congelados na publicação: [{name, roles}]. Calculado por publish_translation_version.';

-- contributors só muda na publicação
create or replace function public.guard_translation_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('luther.publishing', true), '') <> 'on'
     and (new.status is distinct from old.status
          or new.mdx is distinct from old.mdx
          or new.published_at is distinct from old.published_at
          or new.contributors is distinct from old.contributors
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


-- Contribuições por pessoa numa versão (sem checagem de acesso: uso interno)
create function private.version_contributions(p_version_id uuid)
returns table (user_id uuid, translations integer, reviews integer)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    -- a própria versão e, enquanto houver texto copiado, as versões de onde ele veio
    select tv.id, tv.based_on_version_id, 0 as depth
      from public.translation_versions tv
     where tv.id = p_version_id
    union all
    select prev.id, prev.based_on_version_id, c.depth + 1
      from chain c
      join public.translation_versions prev on prev.id = c.based_on_version_id
     where c.depth < 50
       and exists (
         select 1
           from public.segments s
          where s.translation_version_id = c.id
            and length(trim(s.text)) > 0
            and not exists (select 1 from public.segment_revisions r where r.segment_id = s.id)
       )
  ),
  actions as (
    -- edições de texto (tradução em toda a cadeia; revisão só na própria versão)
    select r.author_id as user_id,
           case when r.stage is null or r.stage in ('original', 'translation') then 'translation' else 'review' end as kind,
           c.depth
      from public.segment_revisions r
      join public.segments s on s.id = r.segment_id
      join chain c on c.id = s.translation_version_id
     where r.author_id is not null
    union all
    -- transições reservadas a revisores (só na própria versão)
    select e.actor_id, 'review', 0
      from public.stage_events e
      join public.segments s on s.id = e.segment_id
     where s.translation_version_id = p_version_id
       and e.actor_id is not null
       and e.from_stage is not null
       and not ('translator' = any (coalesce(private.stage_transition_roles(e.from_stage, e.to_stage), '{}')))
  )
  select user_id,
         count(*) filter (where kind = 'translation')::integer as translations,
         count(*) filter (where kind = 'review' and depth = 0)::integer as reviews
    from actions
   where kind = 'translation' or depth = 0
   group by user_id;
$$;


-- Colaboradores de uma versão, com nome e papéis (para o editor e para montar o MDX publicado)
create function public.version_contributors(p_version_id uuid)
returns table (user_id uuid, name text, roles text[], translations integer, reviews integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.is_luther_member() then
    raise exception 'Acesso restrito à equipe do Luther.' using errcode = '42501';
  end if;

  return query
  select c.user_id,
         coalesce(p.name, 'Colaborador'),
         array_remove(array[
           case when c.translations > 0 then 'translator' end,
           case when c.reviews > 0 then 'reviewer' end
         ], null),
         c.translations,
         c.reviews
    from private.version_contributions(p_version_id) c
    left join public.profiles p on p.id = c.user_id
   where c.translations > 0 or c.reviews > 0
   order by (c.translations > 0) desc, c.translations desc, c.reviews desc, p.name;
end;
$$;

revoke execute on function public.version_contributors(uuid) from public, anon;
grant execute on function public.version_contributors(uuid) to authenticated;


-- Publicação: igual à anterior, agora congelando os colaboradores
create or replace function public.publish_translation_version(p_version_id uuid, p_mdx text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.translation_versions;
  v_pending integer;
  v_threads integer;
  v_contributors jsonb;
begin
  if auth.uid() is not null and not private.luther_has_role('admin', 'reviewer') then
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

  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'roles', to_jsonb(c.roles))), '[]'::jsonb)
    into v_contributors
    from public.version_contributors(p_version_id) c;

  perform set_config('luther.publishing', 'on', true);

  update public.translation_versions
     set status = 'archived'
   where translation_id = v_version.translation_id and status = 'published';

  update public.translation_versions
     set status = 'published', mdx = p_mdx, published_at = now(), contributors = v_contributors
   where id = p_version_id;

  update public.translations
     set published_version_id = p_version_id
   where id = v_version.translation_id;

  perform set_config('luther.publishing', '', true);
end;
$$;


-- Site: os colaboradores fazem parte dos metadados públicos da versão publicada
grant select (contributors) on public.translation_versions to anon;

create or replace view public.published_translations
with (security_invoker = on)
as
select
  t.id              as translation_id,
  tv.id             as version_id,
  w.id              as work_id,
  w.slug            as work_slug,
  w.type            as work_type,
  w.title           as original_title,
  w.description     as original_description,
  w.date_text,
  w.date_precision,
  w.source,
  w.credits         as original_credits,
  a.name            as author_name,
  a.slug            as author_slug,
  t.language,
  tv.version,
  tv.credits        as translation_credits,
  tv.mdx,
  tv.published_at,
  tv.contributors
from public.translations t
join public.translation_versions tv on tv.id = t.published_version_id
join public.works w on w.id = t.work_id
join public.authors a on a.id = w.author_id
where w.status = 'active';
