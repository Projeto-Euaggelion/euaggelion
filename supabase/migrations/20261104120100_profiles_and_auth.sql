-- =============================================================================
-- Perfis e papéis
--
-- Não há cadastro público: colaboradores são criados manualmente (painel do
-- Supabase ou auth.admin.inviteUserByEmail no servidor). O perfil é criado por
-- trigger a partir de auth.users. O papel inicial pode vir de
-- raw_app_meta_data.role (só a service role grava app_metadata); padrão: translator.
--
-- Primeiro admin (SQL editor):
--   update public.profiles set role = 'admin' where email = 'voce@exemplo.com';
-- =============================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  email       text,
  role        public.app_role not null default 'translator',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Colaboradores do Luther (1:1 com auth.users).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers de papel (security definer para não recursar nas policies)
-- -----------------------------------------------------------------------------

create function public.has_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = any (roles)
       from public.profiles p
      where p.id = auth.uid() and p.active),
    false
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

-- Qualquer colaborador ativo
create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin', 'translator', 'reviewer');
$$;

-- -----------------------------------------------------------------------------
-- Criação automática do perfil
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := 'translator';
begin
  if new.raw_app_meta_data ? 'role'
     and new.raw_app_meta_data ->> 'role' in ('admin', 'translator', 'reviewer') then
    v_role := (new.raw_app_meta_data ->> 'role')::public.app_role;
  end if;

  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Colaborador'),
    new.email,
    v_role
  );
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

-- -----------------------------------------------------------------------------
-- Só admins mudam papel/estado. Sem auth.uid() (service role, SQL editor) é permitido.
-- -----------------------------------------------------------------------------

create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.is_admin() then
    raise exception 'Apenas administradores podem alterar papel ou status de colaboradores.'
      using errcode = '42501';
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    new.email := old.email; -- e-mail vem de auth.users
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

create policy "Colaboradores veem perfis"
  on public.profiles for select
  to authenticated
  using ((select public.is_member()));

create policy "Colaborador edita o próprio perfil; admin edita todos"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.profiles from anon;
