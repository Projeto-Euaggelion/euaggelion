-- =============================================================================
-- Contas e acesso às aplicações
--
-- Um único login (Supabase Auth) vale para todo o Euaggelion. O perfil é global;
-- o acesso a cada aplicação é dado por app_memberships (usuário × app × papel).
-- Um mesmo usuário pode ter acesso a um app e não a outro.
--
-- app_memberships NÃO é exposta à API do client (sem grants para anon/authenticated):
-- é lida e gerenciada apenas no servidor, com a chave secreta (service role).
-- As policies usam os helpers security definer abaixo.
--
-- Convites podem trazer as memberships em app_metadata (só a service role grava):
--   { "apps": { "luther": "translator" } }
-- Primeiro admin do Luther (SQL editor):
--   insert into public.app_memberships (user_id, app, role)
--   select id, 'luther', 'admin' from public.profiles where email = 'voce@exemplo.com';
-- =============================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Conta do Euaggelion (1:1 com auth.users), comum a todos os apps.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.app_memberships (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  app         public.euaggelion_app not null,
  role        text not null,
  active      boolean not null default true,
  granted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, app),
  constraint app_memberships_luther_role
    check (app <> 'luther' or role in ('admin', 'translator', 'reviewer'))
);

comment on table public.app_memberships is
  'Acesso de cada usuário a cada aplicação. Somente servidor (service role); sem acesso pela API do client.';

create index app_memberships_app_idx on public.app_memberships (app, role) where active;
create index app_memberships_granted_by_idx on public.app_memberships (granted_by);

create trigger app_memberships_set_updated_at
  before update on public.app_memberships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers do Luther (security definer: leem app_memberships sem expô-la)
-- -----------------------------------------------------------------------------

create function private.luther_has_role(variadic roles public.luther_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.app_memberships m
     where m.user_id = auth.uid()
       and m.app = 'luther'
       and m.active
       and m.role = any (roles::text[])
  );
$$;

create function private.is_luther_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.luther_has_role('admin');
$$;

-- Qualquer integrante ativo da equipe de tradução e revisão
create function private.is_luther_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.luther_has_role('admin', 'translator', 'reviewer');
$$;

-- Integrante ativo do Luther (por id), usado em notificações
create function private.is_active_luther_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_memberships m
     where m.user_id = p_user_id and m.app = 'luther' and m.active
  );
$$;

-- -----------------------------------------------------------------------------
-- Criação automática do perfil (+ memberships vindas do convite)
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Usuário'),
    new.email
  );

  if jsonb_typeof(new.raw_app_meta_data -> 'apps') = 'object' then
    insert into public.app_memberships (user_id, app, role)
    select new.id, a.key::public.euaggelion_app, a.value
      from jsonb_each_text(new.raw_app_meta_data -> 'apps') a
     where a.key in (select unnest(enum_range(null::public.euaggelion_app))::text)
       and (a.key <> 'luther' or a.value in ('admin', 'translator', 'reviewer'));
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém o e-mail do perfil sincronizado
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- O e-mail vem de auth.users: o usuário não o altera pelo perfil
create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.app_memberships enable row level security;   -- sem policies: só service role

create policy "Usuário lê o próprio perfil; equipe do Luther lê os perfis" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_luther_member()));

create policy "Usuário edita o próprio perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke all on public.app_memberships from anon, authenticated;

-- Helpers ficam no schema private (fora da API). is_active_luther_member só é usado
-- dentro de funções security definer.
revoke execute on function private.is_active_luther_member(uuid) from public, anon, authenticated;
