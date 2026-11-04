-- =============================================================================
-- Glossário: termos com tradução fixa por idioma (entram no prompt da IA)
-- =============================================================================

create table public.glossary_terms (
  id           uuid primary key default gen_random_uuid(),
  language     text not null check (language ~ '^[a-z]{2}(-[A-Z]{2})?$' and language not like 'en%'),
  source_term  text not null check (length(trim(source_term)) > 0),
  target_term  text not null check (length(trim(target_term)) > 0),
  notes        text,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index glossary_terms_unique_term on public.glossary_terms (language, lower(source_term));
create index glossary_terms_created_by_idx on public.glossary_terms (created_by);

create trigger glossary_terms_set_updated_at before update on public.glossary_terms
  for each row execute function public.set_updated_at();

alter table public.glossary_terms enable row level security;

create policy "Colaboradores leem o glossário" on public.glossary_terms
  for select to authenticated using ((select public.is_member()));
create policy "Admins e revisores inserem termos" on public.glossary_terms
  for insert to authenticated with check ((select public.has_role('admin', 'reviewer')));
create policy "Admins e revisores editam termos" on public.glossary_terms
  for update to authenticated
  using ((select public.has_role('admin', 'reviewer')))
  with check ((select public.has_role('admin', 'reviewer')));
create policy "Admins e revisores removem termos" on public.glossary_terms
  for delete to authenticated using ((select public.has_role('admin', 'reviewer')));

revoke all on public.glossary_terms from anon;
