-- =====================================================================
-- Gestão de Plantel — esquema da base de dados (Supabase / PostgreSQL)
-- Executar UMA vez no Supabase: SQL Editor → New query → colar → Run.
-- Pode ser executado de novo sem perder dados (é idempotente).
-- =====================================================================
--
-- Perfis:
--   admin   — tudo, incluindo dados clínicos e gestão de utilizadores
--   tecnico — plantel, jogos, treinos e definições; SEM dados clínicos
--   medico  — como técnico, mas COM dados clínicos
--   (sem perfil ou inativo) — sem acesso a nenhum dado
--
-- O primeiro utilizador a ser criado fica automaticamente admin.
-- Os seguintes ficam sem perfil até o admin lhes atribuir um na aplicação.

-- ---------- Perfis de utilizador ----------

create table if not exists public.perfis (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  nome      text not null default '',
  papel     text check (papel in ('admin', 'tecnico', 'medico')),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Papel do utilizador autenticado (null se não tiver acesso).
-- security definer: evita recursão nas políticas da própria tabela perfis.
create or replace function public.papel_atual()
returns text
language sql stable security definer set search_path = public
as $$
  select papel from public.perfis where user_id = auth.uid() and ativo
$$;

create or replace function public.e_equipa() returns boolean
language sql stable as $$ select public.papel_atual() in ('admin', 'tecnico', 'medico') $$;

create or replace function public.ve_clinicos() returns boolean
language sql stable as $$ select public.papel_atual() in ('admin', 'medico') $$;

create or replace function public.e_admin() returns boolean
language sql stable as $$ select public.papel_atual() = 'admin' $$;

-- Cria o perfil quando um utilizador é convidado/criado. O primeiro é admin.
create or replace function public.novo_utilizador()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfis (user_id, email, nome, papel)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when exists (select 1 from public.perfis where papel = 'admin') then null else 'admin' end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_utilizador on auth.users;
create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function public.novo_utilizador();

-- Impede que alguém altere o próprio papel/estado ou que se fique sem admins.
create or replace function public.proteger_perfis()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.papel is distinct from old.papel or new.ativo is distinct from old.ativo
        or new.email is distinct from old.email or new.user_id is distinct from old.user_id)
       and not public.e_admin() then
      raise exception 'Só um administrador pode alterar perfis.';
    end if;
    if old.papel = 'admin' and old.ativo and (new.papel is distinct from 'admin' or not new.ativo)
       and not exists (select 1 from public.perfis
                       where papel = 'admin' and ativo and user_id <> old.user_id) then
      raise exception 'Tem de existir pelo menos um administrador ativo.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfis on public.perfis;
create trigger proteger_perfis
  before update on public.perfis
  for each row execute function public.proteger_perfis();

alter table public.perfis enable row level security;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (user_id = auth.uid() or public.e_admin());

drop policy if exists perfis_alterar on public.perfis;
create policy perfis_alterar on public.perfis for update to authenticated
  using (user_id = auth.uid() or public.e_admin())
  with check (user_id = auth.uid() or public.e_admin());

-- ---------- Dados da aplicação ----------
-- Cada registo guarda o objeto da aplicação em "dados" (JSON). Os dados
-- clínicos ficam numa tabela à parte, com acesso restrito.

create table if not exists public.definicoes (
  id             int primary key default 1 check (id = 1),
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

do $$
declare t text;
begin
  foreach t in array array['jogadores', 'competicoes', 'jogos', 'treinos'] loop
    execute format($f$
      create table if not exists public.%I (
        id             uuid primary key,
        dados          jsonb not null,
        atualizado_em  timestamptz not null default now(),
        atualizado_por uuid default auth.uid()
      )$f$, t);
  end loop;
end $$;

create table if not exists public.dados_clinicos (
  jogador_id     uuid primary key references public.jogadores (id) on delete cascade,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

-- Carimbo de quem/quando alterou
create or replace function public.carimbar()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

-- Registo de alterações (quem alterou o quê e quando; sem o conteúdo)
create table if not exists public.registo_alteracoes (
  id         bigint generated always as identity primary key,
  tabela     text not null,
  registo_id text not null,
  acao       text not null,
  user_id    uuid,
  quando     timestamptz not null default now()
);

create or replace function public.registar_alteracao()
returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  insert into public.registo_alteracoes (tabela, registo_id, acao, user_id)
  values (tg_table_name, coalesce(r ->> 'id', r ->> 'jogador_id', '?'), lower(tg_op), auth.uid());
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['definicoes', 'jogadores', 'competicoes', 'jogos', 'treinos', 'dados_clinicos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists carimbar on public.%I', t);
    execute format('create trigger carimbar before insert or update on public.%I
                    for each row execute function public.carimbar()', t);
    execute format('drop trigger if exists registar on public.%I', t);
    execute format('create trigger registar after insert or update or delete on public.%I
                    for each row execute function public.registar_alteracao()', t);
    execute format('drop policy if exists acesso on public.%I', t);
    if t = 'dados_clinicos' then
      execute format('create policy acesso on public.%I for all to authenticated
                      using (public.ve_clinicos()) with check (public.ve_clinicos())', t);
    else
      execute format('create policy acesso on public.%I for all to authenticated
                      using (public.e_equipa()) with check (public.e_equipa())', t);
    end if;
  end loop;
end $$;

alter table public.registo_alteracoes enable row level security;
drop policy if exists ler on public.registo_alteracoes;
create policy ler on public.registo_alteracoes for select to authenticated using (public.e_admin());

-- Sem acesso para visitantes não autenticados
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.definicoes, public.jogadores, public.competicoes, public.jogos, public.treinos, public.dados_clinicos
  to authenticated;
grant select, update on public.perfis to authenticated;
grant select on public.registo_alteracoes to authenticated;
