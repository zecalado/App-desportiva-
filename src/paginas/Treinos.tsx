import { useState } from 'react';
import { formatarData, hoje, useDados } from '../estado';
import type { Presenca, Treino } from '../types';
import { novoId } from '../types';
import { ImportarTreinos } from './ImportarAtividade';

const OPCOES: { v: Presenca; t: string }[] = [
  { v: 'presente', t: 'Presente' },
  { v: 'falta', t: 'Falta' },
  { v: 'lesionado', t: 'Lesionado' },
  { v: 'doente', t: 'Doente' },
];

export function Treinos() {
  const { db, alterar } = useDados();
  const [aberto, setAberto] = useState<string | null>(null);
  const [importar, setImportar] = useState(false);
  const treino = db.treinos.find((t) => t.id === aberto);

  const novo = () => {
    const presencas: Record<string, Presenca> = {};
    for (const j of db.jogadores) if (j.ativo) presencas[j.id] = 'presente';
    const t: Treino = { id: novoId(), data: hoje(), notas: '', presencas };
    alterar((d) => ({ ...d, treinos: [...d.treinos, t] }));
    setAberto(t.id);
  };

  if (treino) {
    const atualizar = (f: (t: Treino) => void) =>
      alterar((d) => {
        f(d.treinos.find((x) => x.id === treino.id)!);
        return d;
      });
    const jogadores = db.jogadores
      .filter((j) => j.ativo || treino.presencas[j.id])
      .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));
    const contagem = (p: Presenca) => Object.values(treino.presencas).filter((x) => x === p).length;

    return (
      <section>
        <header className="cabecalho">
          <div>
            <button className="ligacao" onClick={() => setAberto(null)}>
              ← Treinos
            </button>
            <h1>Treino de {formatarData(treino.data)}</h1>
          </div>
          <button
            className="perigo"
            onClick={() => {
              if (!confirm('Apagar este treino?')) return;
              alterar((d) => ({ ...d, treinos: d.treinos.filter((t) => t.id !== treino.id) }));
              setAberto(null);
            }}
          >
            Apagar treino
          </button>
        </header>
        <div className="grelha">
          <label>
            Data
            <input type="date" value={treino.data} onChange={(e) => atualizar((t) => (t.data = e.target.value))} />
          </label>
          <label className="largo">
            Notas
            <input value={treino.notas} onChange={(e) => atualizar((t) => (t.notas = e.target.value))} />
          </label>
        </div>
        <p className="sub">
          {OPCOES.map((o) => `${o.t}: ${contagem(o.v)}`).join(' · ')}. Por defeito todos ficam “Presente”; altere
          apenas as exceções. Jogadores sem registo neste treino não contam para a percentagem.
        </p>
        <table className="tabela">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Jogador</th>
              <th>Presença</th>
            </tr>
          </thead>
          <tbody>
            {jogadores.map((j) => (
              <tr key={j.id}>
                <td className="num">{j.numero ?? '—'}</td>
                <td>{j.nome}</td>
                <td>
                  <div className="botoes-presenca">
                    {OPCOES.map((o) => (
                      <button
                        key={o.v}
                        className={'pr-' + o.v + (treino.presencas[j.id] === o.v ? ' ativo' : '')}
                        onClick={() => atualizar((t) => (t.presencas[j.id] = o.v))}
                      >
                        {o.t}
                      </button>
                    ))}
                    {treino.presencas[j.id] && (
                      <button className="ligacao" title="Sem registo neste treino" onClick={() => atualizar((t) => delete t.presencas[j.id])}>
                        limpar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  const lista = [...db.treinos].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <section>
      <header className="cabecalho">
        <h1>Treinos</h1>
        <div className="acoes">
          <button onClick={() => setImportar(true)} disabled={!db.jogadores.length} title={db.jogadores.length ? '' : 'Importe ou crie primeiro o plantel'}>
            Importar Excel…
          </button>
          <button className="primario" onClick={novo}>
            + Novo treino
          </button>
        </div>
      </header>
      {importar && <ImportarTreinos fechar={() => setImportar(false)} />}
      {lista.length === 0 ? (
        <p className="vazio">Sem treinos registados.</p>
      ) : (
        <table className="tabela clicavel">
          <thead>
            <tr>
              <th>Data</th>
              {OPCOES.map((o) => (
                <th key={o.v} className="num">
                  {o.t}
                </th>
              ))}
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} onClick={() => setAberto(t.id)}>
                <td>{formatarData(t.data)}</td>
                {OPCOES.map((o) => (
                  <td key={o.v} className="num">
                    {Object.values(t.presencas).filter((x) => x === o.v).length}
                  </td>
                ))}
                <td className="sub">{t.notas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
