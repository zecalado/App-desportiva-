-- Esboço do esquema para a fase 2 (Supabase / PostgreSQL).
-- Espelha src/types.ts. Ainda não está em uso.

create table jogadores (
  id uuid primary key default gen_random_uuid(),
  numero int,
  nome text not null,
  alcunha text,
  data_nascimento date,
  nacionalidade text,
  posicao text not null,
  outras_posicoes text[] default '{}',
  telemovel text,
  peso numeric(5,1),
  altura int,
  clube_anterior text,
  ativo boolean not null default true
);
-- Número único entre jogadores ativos
create unique index jogadores_numero_ativo on jogadores (numero) where ativo and numero is not null;

-- Dados de saúde numa tabela própria, com acesso restrito (RLS)
create table dados_clinicos (
  jogador_id uuid primary key references jogadores on delete cascade,
  cirurgias text, lesoes_anteriores text, alergias text, restricoes_alimentares text
);

create table competicoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('campeonato','taca','amigavel')),
  amarelos_para_castigo int
);

create table jogos (
  id uuid primary key default gen_random_uuid(),
  competicao_id uuid not null references competicoes,
  jornada text, data date not null, adversario text,
  local text not null check (local in ('casa','fora')),
  duracao int not null default 90,
  notas text
);

create table convocados (
  jogo_id uuid references jogos on delete cascade,
  jogador_id uuid references jogadores,
  numero int,
  titular boolean not null,
  primary key (jogo_id, jogador_id)
);

create table indisponiveis (
  jogo_id uuid references jogos on delete cascade,
  jogador_id uuid references jogadores,
  motivo text not null check (motivo in ('lesionado','doente','castigado','outro')),
  primary key (jogo_id, jogador_id)
);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid not null references jogos on delete cascade,
  tipo text not null check (tipo in ('golo','golo_adversario','amarelo','vermelho','substituicao')),
  minuto int not null,
  jogador_id uuid references jogadores,      -- marcador / cartão / quem sai
  jogador2_id uuid references jogadores,     -- assistência / quem entra
  penalti boolean default false,
  descricao text
);

create table treinos (id uuid primary key default gen_random_uuid(), data date not null, notas text);
create table presencas (
  treino_id uuid references treinos on delete cascade,
  jogador_id uuid references jogadores,
  presenca text not null check (presenca in ('presente','falta','lesionado','doente')),
  primary key (treino_id, jogador_id)
);

-- Perfis: 'tecnico' (tudo exceto clínicos) e 'medico' (inclui clínicos).
-- Políticas RLS a definir na fase 2.
