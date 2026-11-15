// Implementação do servidor com Supabase (base de dados + contas).
// As regras de acesso estão na base de dados (supabase/schema.sql); esta
// camada só lê e escreve.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Alteracoes, Papel, Perfil, Servidor, TabelaDados } from './servidor';
import type { BaseDados, Competicao, DadosClinicos, Definicoes, Jogador, Jogo, Treino } from './types';
import { baseDadosVazia } from './types';

const MENSAGENS: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email ou palavra-passe incorretos.'],
  [/email not confirmed/i, 'O email ainda não foi confirmado. Use o link do convite.'],
  [/password should be at least/i, 'A palavra-passe é demasiado curta.'],
  [/new password should be different/i, 'A nova palavra-passe tem de ser diferente da anterior.'],
  [/rate limit|too many requests/i, 'Demasiadas tentativas. Aguarde alguns minutos e tente de novo.'],
  [/failed to fetch|network/i, 'Sem ligação ao servidor. Verifique a internet.'],
  [/row-level security|permission denied/i, 'Sem permissão para esta operação.'],
  [/JWT expired|invalid jwt/i, 'A sessão expirou. Entre novamente.'],
];

function erro(e: { message?: string } | null | undefined): never {
  const m = e?.message ?? 'Erro desconhecido';
  const traducao = MENSAGENS.find(([r]) => r.test(m));
  throw new Error(traducao ? traducao[1] : m);
}

const linhaParaPerfil = (r: Record<string, unknown>): Perfil => ({
  userId: r.user_id as string,
  email: r.email as string,
  nome: (r.nome as string) ?? '',
  papel: (r.papel as Papel | null) ?? null,
  ativo: Boolean(r.ativo),
});

const CLINICO_VAZIO: DadosClinicos = { cirurgias: '', lesoesAnteriores: '', alergias: '', restricoesAlimentares: '' };

export function criarServidorSupabase(url: string, chave: string): Servidor {
  const sb: SupabaseClient = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });

  /** Lê todas as linhas de uma tabela, em páginas de 1000. */
  async function todas<T>(tabela: string, colunas: string): Promise<T[]> {
    const linhas: T[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from(tabela).select(colunas).range(de, de + 999);
      if (error) erro(error);
      linhas.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return linhas;
    }
  }

  const urlRetorno = () => window.location.origin + window.location.pathname;

  return {
    async sessao() {
      const { data, error } = await sb.auth.getSession();
      if (error) erro(error);
      const user = data.session?.user;
      if (!user) return null;
      const { data: p, error: e2 } = await sb.from('perfis').select('*').eq('user_id', user.id).maybeSingle();
      if (e2) erro(e2);
      return p
        ? linhaParaPerfil(p)
        : { userId: user.id, email: user.email ?? '', nome: '', papel: null, ativo: false };
    },
    async entrar(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) erro(error);
    },
    async sair() {
      const { error } = await sb.auth.signOut();
      if (error) erro(error);
    },
    async pedirRecuperacao(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlRetorno() });
      if (error) erro(error);
    },
    async definirPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) erro(error);
    },
    async atualizarNome(nome) {
      const { data } = await sb.auth.getUser();
      if (!data.user) throw new Error('Sem sessão.');
      const { error } = await sb.from('perfis').update({ nome }).eq('user_id', data.user.id);
      if (error) erro(error);
    },
    aoMudarSessao(cb) {
      const { data } = sb.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') setTimeout(cb, 0);
      });
      return () => data.subscription.unsubscribe();
    },

    async carregar(incluirClinicos) {
      type L = { id: string; dados: unknown };
      const [defs, jogadores, competicoes, jogos, treinos, clinicos] = await Promise.all([
        sb.from('definicoes').select('dados').eq('id', 1).maybeSingle(),
        todas<L>('jogadores', 'id,dados'),
        todas<L>('competicoes', 'id,dados'),
        todas<L>('jogos', 'id,dados'),
        todas<L>('treinos', 'id,dados'),
        incluirClinicos
          ? todas<{ jogador_id: string; dados: DadosClinicos }>('dados_clinicos', 'jogador_id,dados')
          : Promise.resolve([]),
      ]);
      if (defs.error) erro(defs.error);
      const clin = new Map(clinicos.map((c) => [c.jogador_id, c.dados]));
      const base = baseDadosVazia();
      return {
        versao: 1,
        definicoes: { ...base.definicoes, ...((defs.data?.dados as Partial<Definicoes>) ?? {}) },
        jogadores: jogadores.map((l) => ({
          ...(l.dados as Omit<Jogador, 'clinico'>),
          id: l.id,
          clinico: { ...CLINICO_VAZIO, ...(clin.get(l.id) ?? {}) },
        })),
        competicoes: competicoes.map((l) => ({ ...(l.dados as Competicao), id: l.id })),
        jogos: jogos.map((l) => ({ ...(l.dados as Jogo), id: l.id })),
        treinos: treinos.map((l) => ({ ...(l.dados as Treino), id: l.id })),
      } satisfies BaseDados;
    },

    async guardar(a: Alteracoes) {
      if (a.definicoes) {
        const { error } = await sb.from('definicoes').upsert({ id: 1, dados: a.definicoes });
        if (error) erro(error);
      }
      // Ordem: primeiro o que é referenciado (jogadores antes dos dados clínicos)
      const ordem: TabelaDados[] = ['competicoes', 'jogadores', 'jogos', 'treinos'];
      for (const t of ordem) {
        const linhas = a.gravar.filter((g) => g.tabela === t).map((g) => ({ id: g.id, dados: g.dados }));
        for (let i = 0; i < linhas.length; i += 200) {
          const { error } = await sb.from(t).upsert(linhas.slice(i, i + 200));
          if (error) erro(error);
        }
      }
      if (a.clinicos.length) {
        const { error } = await sb
          .from('dados_clinicos')
          .upsert(a.clinicos.map((c) => ({ jogador_id: c.jogadorId, dados: c.dados })));
        if (error) erro(error);
      }
      for (const t of [...ordem].reverse()) {
        const ids = a.apagar.filter((x) => x.tabela === t).map((x) => x.id);
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await sb.from(t).delete().in('id', ids.slice(i, i + 200));
          if (error) erro(error);
        }
      }
    },

    async perfis() {
      const { data, error } = await sb.from('perfis').select('*').order('email');
      if (error) erro(error);
      return (data ?? []).map(linhaParaPerfil);
    },
    async atualizarPerfil(userId, campos) {
      const { error } = await sb.from('perfis').update(campos).eq('user_id', userId);
      if (error) erro(error);
    },
    async registo(limite) {
      const { data, error } = await sb
        .from('registo_alteracoes')
        .select('*')
        .order('id', { ascending: false })
        .limit(limite);
      if (error) erro(error);
      return (data ?? []).map((r) => ({
        id: r.id,
        tabela: r.tabela,
        registoId: r.registo_id,
        acao: r.acao,
        userId: r.user_id,
        quando: r.quando,
      }));
    },
  };
}
