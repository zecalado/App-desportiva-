import { useRef, useState } from 'react';
import { numOuNull, useDados } from '../estado';
import { descarregarModelo, descarregarModeloJogos, descarregarModeloTreinos, exportarExcel } from '../excel';
import { ImportarJogos, ImportarTreinos } from './ImportarAtividade';
import { ImportarExcel } from './ImportarExcel';
import { dadosExemplo } from '../seed';
import { validarBaseDados } from '../store';
import type { TipoCompeticao } from '../types';
import { baseDadosVazia, novoId } from '../types';

export function Dados() {
  const { db, alterar, substituir } = useDados();
  const ficheiro = useRef<HTMLInputElement>(null);
  const [clinicos, setClinicos] = useState(false);
  const [importar, setImportar] = useState<null | 'plantel' | 'jogos' | 'treinos'>(null);

  const exportarJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date().toISOString().slice(0, 10);
    a.download = `copia-seguranca-plantel-${d}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importarJson = async (f: File) => {
    try {
      const novo = validarBaseDados(JSON.parse(await f.text()));
      if (!confirm('Substituir TODOS os dados atuais pelos do ficheiro?')) return;
      substituir(novo);
    } catch (e) {
      alert((e as Error).message || 'Ficheiro inválido.');
    }
  };

  const vazio = db.jogadores.length === 0 && db.jogos.length === 0 && db.treinos.length === 0;

  return (
    <section>
      <header className="cabecalho">
        <h1>Dados e definições</h1>
      </header>

      <fieldset>
        <legend>Clube e época</legend>
        <div className="grelha">
          <label>
            Clube
            <input
              value={db.definicoes.clube}
              onChange={(e) => alterar((d) => ({ ...d, definicoes: { ...d.definicoes, clube: e.target.value } }))}
            />
          </label>
          <label>
            Época
            <input
              value={db.definicoes.epoca}
              placeholder="2026/2027"
              onChange={(e) => alterar((d) => ({ ...d, definicoes: { ...d.definicoes, epoca: e.target.value } }))}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Competições</legend>
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Amarelos que dão castigo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {db.competicoes.map((c) => {
              const set = (f: (x: typeof c) => void) =>
                alterar((d) => {
                  f(d.competicoes.find((x) => x.id === c.id)!);
                  return d;
                });
              const emUso = db.jogos.some((j) => j.competicaoId === c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <input value={c.nome} onChange={(e) => set((x) => (x.nome = e.target.value))} />
                  </td>
                  <td>
                    <select value={c.tipo} onChange={(e) => set((x) => (x.tipo = e.target.value as TipoCompeticao))}>
                      <option value="campeonato">Campeonato</option>
                      <option value="taca">Taça</option>
                      <option value="amigavel">Amigável</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="curto"
                      type="number"
                      min={1}
                      value={c.amarelosParaCastigo ?? ''}
                      placeholder="—"
                      onChange={(e) => set((x) => (x.amarelosParaCastigo = numOuNull(e.target.value)))}
                    />
                  </td>
                  <td>
                    <button
                      className="ligacao perigo"
                      disabled={emUso}
                      title={emUso ? 'Tem jogos associados' : ''}
                      onClick={() => alterar((d) => ({ ...d, competicoes: d.competicoes.filter((x) => x.id !== c.id) }))}
                    >
                      remover
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button
          onClick={() =>
            alterar((d) => ({
              ...d,
              competicoes: [...d.competicoes, { id: novoId(), nome: 'Nova competição', tipo: 'amigavel', amarelosParaCastigo: null }],
            }))
          }
        >
          + Competição
        </button>
        <p className="sub">
          O número de amarelos que dá castigo depende do regulamento da associação de futebol. Confirme antes de
          configurar; a aplicação só emite alertas.
        </p>
      </fieldset>

      <fieldset>
        <legend>Importar de Excel</legend>
        <p>
          <button className="primario" onClick={() => setImportar('plantel')}>
            Importar plantel…
          </button>{' '}
          <button onClick={() => setImportar('jogos')} disabled={!db.jogadores.length}>
            Importar jogos…
          </button>{' '}
          <button onClick={() => setImportar('treinos')} disabled={!db.jogadores.length}>
            Importar treinos…
          </button>
        </p>
        <p className="sub">
          Importe primeiro o plantel: jogos e treinos só reconhecem jogadores que já existam. Cada importação mostra uma
          pré-visualização com avisos antes de gravar e tem um modelo para descarregar. O Excel exportado pela aplicação
          pode ser editado e importado de volta.
        </p>
        <p>
          <button className="ligacao" onClick={() => descarregarModelo()}>Modelo do plantel</button> ·{' '}
          <button className="ligacao" onClick={() => descarregarModeloJogos()}>Modelo de jogos</button> ·{' '}
          <button className="ligacao" onClick={() => descarregarModeloTreinos(db)}>Modelo de treinos</button>
        </p>
      </fieldset>
      {importar === 'plantel' && <ImportarExcel fechar={() => setImportar(null)} />}
      {importar === 'jogos' && <ImportarJogos fechar={() => setImportar(null)} />}
      {importar === 'treinos' && <ImportarTreinos fechar={() => setImportar(null)} />}

      <fieldset>
        <legend>Exportar</legend>
        <p>
          <button className="primario" onClick={() => exportarExcel(db, clinicos).catch((e) => alert('Erro ao exportar: ' + (e as Error).message))}>
            Exportar registos para Excel
          </button>{' '}
          <label className="check">
            <input type="checkbox" checked={clinicos} onChange={(e) => setClinicos(e.target.checked)} />
            Incluir dados clínicos
          </label>
        </p>
        <p className="sub">
          Gera Registo Geral, totais por jogador (geral e por competição), Disciplina, Jogos, Convocatórias, Eventos e
          Treinos.
        </p>
      </fieldset>

      <fieldset>
        <legend>Cópia de segurança</legend>
        <p className="aviso">
          Nesta versão de teste os dados ficam guardados <strong>apenas neste browser, neste computador</strong>.
          Limpar os dados do browser apaga-os. Faça cópias de segurança regularmente.
        </p>
        <p>
          <button onClick={exportarJson}>Descarregar cópia de segurança</button>{' '}
          <button onClick={() => ficheiro.current?.click()}>Restaurar cópia de segurança…</button>
          <input
            ref={ficheiro}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importarJson(f);
              e.target.value = '';
            }}
          />
        </p>
      </fieldset>

      <fieldset>
        <legend>Dados de exemplo</legend>
        <p>
          <button
            onClick={() => {
              if (!vazio && !confirm('Isto substitui todos os dados atuais pelos dados de exemplo. Continuar?')) return;
              substituir(dadosExemplo());
            }}
          >
            Carregar dados de exemplo
          </button>{' '}
          <button
            className="perigo"
            onClick={() => {
              if (!confirm('Apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
              substituir(baseDadosVazia());
            }}
          >
            Apagar todos os dados
          </button>
        </p>
        <p className="sub">
          O exemplo inclui um plantel de 23 jogadores, 8 jogos (6 de campeonato e 2 de Taça) entre 20/09 e 08/11 e
          cerca de 30 treinos. Todos os nomes, clubes, resultados, eventos e presenças são <strong>fictícios</strong>. O limite de 5 amarelos no Campeonato é um
          valor de exemplo. Inclui casos para testar: troca de guarda-redes, penálti, vermelho direto, expulsão por 2º
          amarelo, jogadores castigados e lesionados.
        </p>
      </fieldset>
    </section>
  );
}
