-- =============================================================================
-- Equipe do Luther: o app nunca fica sem administrador ativo
--
-- app_memberships é gerenciada só pelo servidor (/admin/users, com a chave secreta).
-- Mesmo assim, a regra fica no banco: rebaixar, desativar ou remover o último admin ativo
-- do Luther é recusado, venha a mudança do app, do SQL editor ou de um cascade.
-- =============================================================================

create function private.guard_last_luther_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.app = 'luther' and old.active and old.role = 'admin'
     and (tg_op = 'DELETE' or not new.active or new.role <> 'admin' or new.app <> 'luther') then
    -- serializa mudanças concorrentes nos admins (dois admins rebaixando um ao outro)
    perform 1
       from public.app_memberships m
      where m.app = 'luther' and m.role = 'admin' and m.active
        for update;

    if not exists (
      select 1
        from public.app_memberships m
       where m.app = 'luther' and m.role = 'admin' and m.active
         and m.user_id <> old.user_id
    ) then
      raise exception 'O Luther precisa de ao menos um administrador ativo.'
        using errcode = '23514', constraint = 'luther_last_admin';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger app_memberships_guard_last_luther_admin
  before update or delete on public.app_memberships
  for each row execute function private.guard_last_luther_admin();
