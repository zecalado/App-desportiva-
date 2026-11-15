import { useCallback, useEffect, useState } from 'react';
import { formatarData, useDados } from '../estado';
import type { EntradaRegisto, Papel, Perfil } from '../servidor';
import { NOMES_PAPEL } from '../servidor';
import { FormularioPassword } from './Entrar';

const NOMES_TABELA: Record<string, string> = {
  jogadores: 'Jogador',
  dados_clinicos: 'Dados clínicos',
  competicoes: 'Competição',
  jogos: 'Jogo',
  treinos: 'Treino',
  definicoes: 'Definições',
};
const NOMES_ACAO: Record<string, string> = { insert: 'criou', update: 'alterou', delete: 'apagou' };

export function Utilizadores() {
  const { servidor, perfil, db } = useDados();
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [registo, setRegisto] = useState<EntradaRegisto[]>([]);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!servidor) return;
    try {
      const [p, r] = await Promise.all([servidor.perfis(), servidor.registo(200)]);
      setPerfis(p);
      setRegisto(r);
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [servidor]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const alterarPerfil = async (p: Perfil, campos: Partial<Pick<Perfil, 'papel' | 'ativo'>>) => {
    if (!servidor) return;
    if (p.userId === perfil?.userId && (campos.papel !== undefined || campos.ativo === false))
      if (!confirm('Está a alterar o seu próprio acesso. Pode perder a gestão de utilizadores. Continuar?')) return;
    try {
      await servidor.atualizarPerfil(p.userId, campos);
      await carregar();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const nomeUtilizador = (id: string | null) => {
    const p = perfis.find((x) => x.userId === id);
    return p ? p.nome || p.email : '—';
  };
  const descricao = (r: EntradaRegisto) => {
    if (r.tabela === 'jogadores' || r.tabela === 'dados_clinicos')
      return db.jogadores.find((j) => j.id === r.registoId)?.nome ?? '(apagado)';
    if (r.tabela === 'jogos') {
      const j = db.jogos.find((x) => x.id === r.registoId);
      return j ? `${formatarData(j.data)} ${j.adversario}` : '(apagado)';
    }
    if (r.tabela === 'treinos') {
      const t = db.treinos.find((x) => x.id === r.registoId);
      return t ? formatarData(t.data) : '(apagado)';
    }
    if (r.tabela === 'competicoes') return db.competicoes.find((c) => c.id === r.registoId)?.nome ?? '(apagada)';
    return '';
  };

  return (
    <section>
      <header className="cabecalho">
        <h1>Utilizadores</h1>
        <button onClick={carregar}>Atualizar</button>
      </header>
      {erro && <div className="erro">{erro}</div>}

      <fieldset>
        <legend>Como adicionar alguém</legend>
        <ol className="passos">
          <li>
            No painel do Supabase: <strong>Authentication → Users → Add user → Create new user</strong>. Indique o email e
            uma palavra-passe temporária e marque <strong>Auto Confirm User</strong>.
          </li>
          <li>Entregue a palavra-passe temporária à pessoa (pessoalmente ou por telefone, não por email).</li>
          <li>
            A conta aparece aqui <strong>sem acesso</strong>. Atribua-lhe um perfil abaixo.
          </li>
          <li>
            A pessoa entra e muda a palavra-passe em <strong>A minha conta</strong>.
          </li>
        </ol>
        <p className="sub">
          Convites e recuperação de palavra-passe por email só funcionam depois de configurar um servidor de email
          (SMTP) no Supabase — ver CONFIGURAR.md.
        </p>
        <p className="sub">
          Perfis: <strong>Administrador</strong> — tudo, incluindo dados clínicos e esta página · <strong>Técnico</strong> —
          plantel, jogos, treinos e relatórios, sem dados clínicos · <strong>Médico / Fisioterapia</strong> — como o técnico,
          com dados clínicos. Para retirar o acesso, desative a conta.
        </p>
      </fieldset>

      <table className="tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Perfil</th>
            <th>Ativo</th>
          </tr>
        </thead>
        <tbody>
          {perfis.map((p) => (
            <tr key={p.userId} className={p.ativo && p.papel ? '' : 'inativo'}>
              <td>
                {p.nome || <span className="sub">(sem nome)</span>}
                {p.userId === perfil?.userId && <span className="sub"> (eu)</span>}
              </td>
              <td>{p.email}</td>
              <td>
                <select
                  value={p.papel ?? ''}
                  onChange={(e) => alterarPerfil(p, { papel: (e.target.value || null) as Papel | null })}
                >
                  <option value="">— Sem acesso —</option>
                  {(Object.keys(NOMES_PAPEL) as Papel[]).map((k) => (
                    <option key={k} value={k}>
                      {NOMES_PAPEL[k]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input type="checkbox" checked={p.ativo} onChange={(e) => alterarPerfil(p, { ativo: e.target.checked })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="titulo-seccao">Registo de alterações (últimas {registo.length})</h2>
      <p className="sub">Quem alterou o quê e quando. O conteúdo das alterações não é guardado.</p>
      <div className="rolagem curta">
        <table className="tabela compacta">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
              <th>Tipo</th>
              <th>Registo</th>
            </tr>
          </thead>
          <tbody>
            {registo.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.quando).toLocaleString('pt-PT')}</td>
                <td>{nomeUtilizador(r.userId)}</td>
                <td>{NOMES_ACAO[r.acao] ?? r.acao}</td>
                <td>{NOMES_TABELA[r.tabela] ?? r.tabela}</td>
                <td>{descricao(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Conta() {
  const { servidor, perfil, sair } = useDados();
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [msg, setMsg] = useState('');
  if (!servidor || !perfil) return null;
  return (
    <section>
      <header className="cabecalho">
        <h1>A minha conta</h1>
        <button onClick={sair}>Sair</button>
      </header>
      <fieldset>
        <legend>Dados</legend>
        <div className="grelha">
          <label>
            Email
            <input value={perfil.email} readOnly />
          </label>
          <label>
            Perfil
            <input value={perfil.papel ? NOMES_PAPEL[perfil.papel] : '—'} readOnly />
          </label>
          <label>
            Nome (aparece no registo de alterações)
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
        </div>
        <button
          onClick={async () => {
            try {
              await servidor.atualizarNome(nome.trim());
              setMsg('Nome guardado.');
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Guardar nome
        </button>{' '}
        {msg && <span className="sub">{msg}</span>}
      </fieldset>
      <fieldset>
        <legend>Alterar palavra-passe</legend>
        <FormularioPassword servidor={servidor} aoConcluir={() => alert('Palavra-passe alterada.')} textoBotao="Alterar palavra-passe" />
      </fieldset>
    </section>
  );
}
