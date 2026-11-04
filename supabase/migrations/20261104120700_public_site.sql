-- =============================================================================
-- Leitura pública (site): acesso anônimo apenas ao que foi publicado
-- =============================================================================

-- security definer: evita recursão entre as policies de works e translations
create function private.is_published_work(p_work_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.works w
      join public.translations t on t.work_id = w.id
     where w.id = p_work_id
       and w.status = 'active'
       and t.published_version_id is not null
  );
$$;


-- Tabelas internas: nenhum acesso anônimo (além da RLS, sem grant)
revoke all on
  public.source_versions, public.source_segments, public.segments, public.segment_revisions,
  public.stage_events, public.comment_threads, public.comments, public.notifications
from anon;

-- Colunas visíveis ao público (o resto das tabelas fica fechado para anon)
revoke all on public.authors, public.works, public.translations, public.translation_versions from anon;

grant select (id, name, slug, bio, era) on public.authors to anon;
grant select (id, author_id, type, slug, title, description, date_text, date_precision, source, credits, status)
  on public.works to anon;
grant select (id, work_id, language, published_version_id) on public.translations to anon;
grant select (id, translation_id, version, credits, mdx, published_at) on public.translation_versions to anon;

create policy "Público lê autores com obras publicadas" on public.authors
  for select to anon
  using (exists (select 1 from public.works w where w.author_id = authors.id and private.is_published_work(w.id)));

create policy "Público lê obras publicadas" on public.works
  for select to anon
  using (private.is_published_work(id));

create policy "Público lê traduções publicadas" on public.translations
  for select to anon
  using (published_version_id is not null and private.is_published_work(work_id));

create policy "Público lê versões publicadas" on public.translation_versions
  for select to anon
  using (
    status = 'published'
    and exists (
      select 1 from public.translations t
       where t.id = translation_versions.translation_id
         and t.published_version_id = translation_versions.id
         and private.is_published_work(t.work_id)
    )
  );

-- Visão consumida pelo site
create view public.published_translations
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
  tv.published_at
from public.translations t
join public.translation_versions tv on tv.id = t.published_version_id
join public.works w on w.id = t.work_id
join public.authors a on a.id = w.author_id
where w.status = 'active';

grant select on public.published_translations to anon, authenticated;
