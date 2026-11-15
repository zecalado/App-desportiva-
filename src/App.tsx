import { useState } from 'react';
import { FornecedorDados, useDados } from './estado';
import { Dados } from './paginas/Dados';
import { Jogos } from './paginas/Jogos';
import { Plantel } from './paginas/Plantel';
import { Disciplina, Estatisticas } from './paginas/Relatorios';
import { Treinos } from './paginas/Treinos';

const PAGINAS = {
  plantel: { t: 'Plantel', C: Plantel },
  jogos: { t: 'Jogos', C: Jogos },
  treinos: { t: 'Treinos', C: Treinos },
  estatisticas: { t: 'Estatísticas', C: Estatisticas },
  disciplina: { t: 'Disciplina', C: Disciplina },
  dados: { t: 'Dados', C: Dados },
} as const;
type Pagina = keyof typeof PAGINAS;

function Moldura() {
  const { db } = useDados();
  const [pagina, setPagina] = useState<Pagina>(db.jogadores.length ? 'plantel' : 'dados');
  const { C } = PAGINAS[pagina];
  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca-app">
          <strong>{db.definicoes.clube || 'Gestão de Plantel'}</strong>
          <span>Séniores {db.definicoes.epoca}</span>
        </div>
        <nav>
          {(Object.keys(PAGINAS) as Pagina[]).map((p) => (
            <button key={p} className={p === pagina ? 'ativo' : ''} onClick={() => setPagina(p)}>
              {PAGINAS[p].t}
            </button>
          ))}
        </nav>
        <div className="versao">Protótipo · dados guardados neste browser</div>
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
