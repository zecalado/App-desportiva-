// Servidor simulado (só para testes da interface; nunca usado em produção).
// Reproduz as regras de acesso de supabase/schema.sql. Os "dados do servidor"
// ficam em localStorage para sobreviverem a recarregamentos da página.
import type { Alteracoes, EntradaRegisto, Papel, Perfil, Servidor } from './servidor';
import { podeVerClinicos } from './servidor';
import type { BaseDados, DadosClinicos, Definicoes } from './types';
import { baseDadosVazia } from './types';

interface Estado {
  utilizadores: (Perfil & { password: string })[];
  definicoes: Definicoes | null;
  tabelas: Record<string, Record<string, unknown>>;
  clinicos: Record<string, DadosClinicos>;
  registo: EntradaRegisto[];
}

const CHAVE = 'servidor-falso';
const PASSWORD = 'teste1234';

function inicial(): Estado {
  const u = (email: string, papel: Papel | null, nome: string) => ({
    userId: email, email, nome, papel, ativo: true, password: PASSWORD,
  });
  return {
    utilizadores: [
      u('admin@teste.pt', 'admin', 'Administrador'),
      u('tecnico@teste.pt', 'tecnico', 'Treinador'),
      u('medico@teste.pt', 'medico', 'Fisioterapeuta'),
      u('novo@teste.pt', null, ''),
    ],
    definicoes: null,
    tabelas: { jogadores: {}, competicoes: {}, jogos: {}, treinos: {} },
    clinicos: {},
    registo: [],
  };
}

export function criarServidorFalso(): Servidor {
  const ler = (): Estado => JSON.parse(localStorage.getItem(CHAVE) ?? 'null') ?? inicial();
  const escrever = (e: Estado) => localStorage.setItem(CHAVE, JSON.stringify(e));
  const atual = () => sessionStorage.getItem('sessao-falsa');
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((f) => setTimeout(f, 0));
  const atraso = () => new Promise((r) => setTimeout(r, 30));
  const falhar = () => {
    if ((window as unknown as { __falhar?: boolean }).__falhar) throw new Error('Sem ligação ao servidor. Verifique a internet.');
  };
  const eu = (e: Estado) => e.utilizadores.find((u) => u.userId === atual() && u.ativo);
  const papel = (e: Estado) => eu(e)?.papel ?? null;
  const exigir = (_e: Estado, ok: boolean) => {
    if (!ok) throw new Error('Sem permissão para esta operação.');
  };
  const registar = (e: Estado, tabela: string, registoId: string, acao: string) =>
    e.registo.push({ id: e.registo.length + 1, tabela, registoId, acao, userId: atual(), quando: new Date().toISOString() });
  const semPassword = ({ password: _p, ...p }: Perfil & { password: string }): Perfil => p;

  return {
    async sessao() {
      await atraso();
      const e = ler();
      const u = e.utilizadores.find((x) => x.userId === atual());
      return u ? semPassword(u) : null;
    },
    async entrar(email, password) {
      await atraso();
      falhar();
      const u = ler().utilizadores.find((x) => x.email === email.trim().toLowerCase());
      if (!u || u.password !== password) throw new Error('Email ou palavra-passe incorretos.');
      sessionStorage.setItem('sessao-falsa', u.userId);
      avisar();
    },
    async sair() {
      sessionStorage.removeItem('sessao-falsa');
      avisar();
    },
    async pedirRecuperacao() {
      await atraso();
    },
    async definirPassword(password) {
      const e = ler();
      const u = e.utilizadores.find((x) => x.userId === atual());
      if (!u) throw new Error('Sem sessão.');
      u.password = password;
      escrever(e);
    },
    async atualizarNome(nome) {
      const e = ler();
      const u = e.utilizadores.find((x) => x.userId === atual());
      if (u) u.nome = nome;
      escrever(e);
      avisar();
    },
    aoMudarSessao(cb) {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },

    async carregar(incluirClinicos) {
      await atraso();
      falhar();
      const e = ler();
      const p = papel(e);
      const base = baseDadosVazia();
      if (!p) return { ...base, competicoes: [] };
      const ver = incluirClinicos && podeVerClinicos(p);
      const vazio: DadosClinicos = { cirurgias: '', lesoesAnteriores: '', alergias: '', restricoesAlimentares: '' };
      const lista = <T,>(t: string) => Object.values(e.tabelas[t]) as T[];
      return {
        versao: 1,
        definicoes: e.definicoes ?? base.definicoes,
        jogadores: lista<BaseDados['jogadores'][number]>('jogadores').map((j) => ({
          ...j,
          clinico: ver ? { ...vazio, ...(e.clinicos[j.id] ?? {}) } : vazio,
        })),
        competicoes: lista('competicoes'),
        jogos: lista('jogos'),
        treinos: lista('treinos'),
      };
    },
    async guardar(a: Alteracoes) {
      await atraso();
      falhar();
      const e = ler();
      const p = papel(e);
      exigir(e, !!p);
      if (a.clinicos.length) exigir(e, podeVerClinicos(p));
      if (a.definicoes) {
        e.definicoes = a.definicoes;
        registar(e, 'definicoes', '1', 'update');
      }
      for (const g of a.gravar) {
        registar(e, g.tabela, g.id, e.tabelas[g.tabela][g.id] ? 'update' : 'insert');
        e.tabelas[g.tabela][g.id] = g.dados;
      }
      for (const c of a.clinicos) {
        exigir(e, !!e.tabelas.jogadores[c.jogadorId]);
        e.clinicos[c.jogadorId] = c.dados;
        registar(e, 'dados_clinicos', c.jogadorId, 'update');
      }
      for (const d of a.apagar) {
        delete e.tabelas[d.tabela][d.id];
        if (d.tabela === 'jogadores') delete e.clinicos[d.id];
        registar(e, d.tabela, d.id, 'delete');
      }
      escrever(e);
    },
    async perfis() {
      const e = ler();
      return e.utilizadores.filter((u) => papel(e) === 'admin' || u.userId === atual()).map(semPassword);
    },
    async atualizarPerfil(userId, campos) {
      const e = ler();
      const u = e.utilizadores.find((x) => x.userId === userId);
      if (!u) return;
      if ((campos.papel !== undefined || campos.ativo !== undefined) && papel(e) !== 'admin')
        throw new Error('Só um administrador pode alterar perfis.');
      const outrosAdmins = e.utilizadores.filter((x) => x.papel === 'admin' && x.ativo && x.userId !== userId);
      const deixaDeSerAdmin =
        u.papel === 'admin' && u.ativo && ((campos.papel !== undefined && campos.papel !== 'admin') || campos.ativo === false);
      if (deixaDeSerAdmin && !outrosAdmins.length) throw new Error('Tem de existir pelo menos um administrador ativo.');
      Object.assign(u, campos);
      escrever(e);
      avisar();
    },
    async registo(limite) {
      const e = ler();
      exigir(e, papel(e) === 'admin');
      return [...e.registo].reverse().slice(0, limite);
    },
  };
}
