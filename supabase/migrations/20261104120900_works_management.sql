-- =============================================================================
-- Gestão de obras: criação atômica (obra + versão 1 do original) e sincronização
-- do título/descrição da obra com o frontmatter da versão mais recente do original.
-- =============================================================================

-- Título e descrição da obra são os do original (EN). Eles vêm do frontmatter: cada nova versão
-- do original atualiza a obra. Os demais metadados são editados direto na obra.
create function private.sync_work_from_source_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.works
     set title = coalesce(nullif(trim(new.frontmatter ->> 'title'), ''), title),
         description = case
           when new.frontmatter ? 'description' then nullif(trim(new.frontmatter ->> 'description'), '')
           else description
         end
   where id = new.work_id;
  return new;
end;
$$;

create trigger source_versions_sync_work after insert on public.source_versions
  for each row execute function private.sync_work_from_source_version();


-- Cria a obra e a versão 1 do original numa só transação.
-- O app faz o parse/segmentação do MDX (@euaggelion/mdx) e envia os segmentos.
create function public.create_work(
  p_author_id uuid,
  p_type public.work_type,
  p_slug text,
  p_mdx text,
  p_segments jsonb,
  p_frontmatter jsonb,
  p_date_text text default null,
  p_date_precision public.date_precision default null,
  p_source text default null,
  p_credits text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_title text := nullif(trim(p_frontmatter ->> 'title'), '');
begin
  if auth.uid() is not null and not private.is_luther_admin() then
    raise exception 'Apenas administradores criam obras.' using errcode = '42501';
  end if;
  if v_title is null then
    raise exception 'O frontmatter precisa de um título.' using errcode = '22023';
  end if;

  insert into public.works (author_id, type, slug, title, description, date_text, date_precision, source, credits, created_by)
  values (
    p_author_id, p_type, p_slug, v_title, nullif(trim(p_frontmatter ->> 'description'), ''),
    p_date_text, p_date_precision, p_source, p_credits, auth.uid()
  )
  returning id into v_work_id;

  perform public.create_source_version(v_work_id, p_mdx, p_segments, p_frontmatter, null);
  return v_work_id;
end;
$$;

revoke execute on function public.create_work(uuid, public.work_type, text, text, jsonb, jsonb, text, public.date_precision, text, text) from public, anon;
grant execute on function public.create_work(uuid, public.work_type, text, text, jsonb, jsonb, text, public.date_precision, text, text) to authenticated;
