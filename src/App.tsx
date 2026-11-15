import { useState } from 'react';
import type { ComponentType } from 'react';
import { FornecedorDados, useDados } from './estado';
import { Dados } from './paginas/Dados';
import { Jogos } from './paginas/Jogos';
import { Plantel } from './paginas/Plantel';
import { Disciplina, Estatisticas } from './paginas/Relatorios';
import { Treinos } from './paginas/Treinos';
import { Conta, Utilizadores } from './paginas/Utilizadores';
import { NOMES_PAPEL } from './servidor';

type Pagina = 'plantel' | 'jogos' | 'treinos' | 'estatisticas' | 'disciplina' | 'dados' | 'utilizadores' | 'conta';

const PAGINAS: Record<Pagina, { t: string; C: ComponentType }> = {
  plantel: { t: 'Plantel', C: Plantel },
  jogos: { t: 'Jogos', C: Jogos },
  treinos: { t: 'Treinos', C: Treinos },
  estatisticas: { t: 'Estatísticas', C: Estatisticas },
  disciplina: { t: 'Disciplina', C: Disciplina },
  dados: { t: 'Dados', C: Dados },
  utilizadores: { t: 'Utilizadores', C: Utilizadores },
  conta: { t: 'A minha conta', C: Conta },
};

function EstadoSincronizacao() {
  const { modo, estadoSync, erroSync, pendentes } = useDados();
  if (modo === 'local') return <div className="versao">Protótipo · dados guardados neste browser</div>;
  const textos = {
    guardado: '✓ Tudo guardado',
    pendente: '● Alterações por guardar…',
    a_guardar: `↻ A guardar${pendentes ? ` (${pendentes})` : ''}…`,
    erro: '⚠ Não guardado — a tentar de novo',
  };
  return (
    <div className={'sync sync-' + estadoSync} title={erroSync || undefined} role="status">
      {textos[estadoSync]}
      {estadoSync === 'erro' && erroSync && <div className="sync-erro">{erroSync}</div>}
    </div>
  );
}

function Moldura() {
  const { db, modo, perfil, eAdmin } = useDados();
  const [pagina, setPagina] = useState<Pagina>(db.jogadores.length ? 'plantel' : 'dados');
  const visiveis: Pagina[] = ['plantel', 'jogos', 'treinos', 'estatisticas', 'disciplina', 'dados'];
  if (modo !== 'local' && eAdmin) visiveis.push('utilizadores');
  const { C } = PAGINAS[pagina];
  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca-app">
          <strong>{db.definicoes.clube || 'Gestão de Plantel'}</strong>
          <span>Séniores {db.definicoes.epoca}</span>
        </div>
        <nav>
          {visiveis.map((p) => (
            <button key={p} className={p === pagina ? 'ativo' : ''} onClick={() => setPagina(p)}>
              {PAGINAS[p].t}
            </button>
          ))}
        </nav>
        <div className="rodape-lateral">
          <EstadoSincronizacao />
          {perfil && (
            <button className={'utilizador' + (pagina === 'conta' ? ' ativo' : '')} onClick={() => setPagina('conta')}>
              <strong>{perfil.nome || perfil.email}</strong>
              <span>{perfil.papel ? NOMES_PAPEL[perfil.papel] : ''}</span>
            </button>
          )}
        </div>
      </aside>
      <main className="conteudo">
        <C key={pagina} />
      </main>
    </div>
  );
}

export function App() {
  return (
    <FornecedorDados>
      <Moldura />
    </FornecedorDados>
  );
}
