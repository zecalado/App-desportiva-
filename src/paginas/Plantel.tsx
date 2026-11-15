import { useState } from 'react';
import { idade, imc, numerosRepetidos } from '../calc';
import { formatarData, numOuNull, useDados } from '../estado';
import { ImportarExcel } from './ImportarExcel';
import type { Jogador, Posicao } from '../types';
import { POSICOES, jogadorVazio } from '../types';

export function Plantel() {
  const { db, alterar } = useDados();
  const [edicao, setEdicao] = useState<Jogador | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [importar, setImportar] = useState(false);

  const lista = [...db.jogadores]
    .filter((j) => mostrarInativos || j.ativo)
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));
  const repetidos = numerosRepetidos(db.jogadores);

  const guardar = (j: Jogador) => {
    alterar((d) => {
      const i = d.jogadores.findIndex((x) => x.id === j.id);
      if (i >= 0) d.jogadores[i] = j;
      else d.jogadores.push(j);
      return d;
    });
    setEdicao(null);
  };

  return (
    <section>
      <header className="cabecalho">
        <h1>Plantel</h1>
        <div className="acoes">
          <label className="check">
            <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
            Mostrar inativos
          </label>
          <button onClick={() => setImportar(true)}>Importar Excel…</button>
          <button className="primario" onClick={() => setEdicao(jogadorVazio())}>
            + Novo jogador
          </button>
        </div>
      </header>

      {repetidos.size > 0 && (
        <div className="aviso">
          {[...repetidos].map(([n, nomes]) => (
            <div key={n}>
              Número {n} repetido: {nomes.join(', ')}
            </div>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <p className="vazio">Ainda não há jogadores. Use “+ Novo jogador”, “Importar Excel…” ou carregue os dados de exemplo em “Dados”.</p>
      ) : (
        <table className="tabela clicavel">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Nome</th>
              <th>Posição</th>
              <th>Outras posições</th>
              <th className="num">Idade</th>
              <th>Nascimento</th>
              <th>Nacionalidade</th>
              <th>Clube anterior</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((j) => (
              <tr key={j.id} onClick={() => setEdicao(structuredClone(j))} className={j.ativo ? '' : 'inativo'}>
                <td className="num">{j.numero ?? '—'}</td>
                <td>
                  {j.nome}
                  {j.alcunha && <span className="sub"> ({j.alcunha})</span>}
                </td>
                <td>{j.posicao}</td>
                <td className="sub">{j.outrasPosicoes.join(', ')}</td>
                <td className="num">{idade(j.dataNascimento) ?? '—'}</td>
                <td>{formatarData(j.dataNascimento)}</td>
                <td>{j.nacionalidade}</td>
                <td>{j.clubeAnterior}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {importar && <ImportarExcel fechar={() => setImportar(false)} />}

      {edicao && (
        <FichaJogador
          inicial={edicao}
          existe={db.jogadores.some((j) => j.id === edicao.id)}
          outros={db.jogadores.filter((j) => j.id !== edicao.id)}
          onGuardar={guardar}
          onCancelar={() => setEdicao(null)}
          onApagar={() => {
            const usado =
              db.jogos.some((g) => g.convocados.some((c) => c.jogadorId === edicao.id)) ||
              db.treinos.some((t) => t.presencas[edicao.id]);
            if (usado) {
              alert('Este jogador já tem jogos ou treinos registados. Em vez de apagar, marque-o como inativo.');
              return;
            }
            if (!confirm(`Apagar ${edicao.nome || 'este jogador'}?`)) return;
            alterar((d) => ({ ...d, jogadores: d.jogadores.filter((j) => j.id !== edicao.id) }));
            setEdicao(null);
          }}
        />
      )}
    </section>
  );
}

function FichaJogador(props: {
  inicial: Jogador;
  existe: boolean;
  outros: Jogador[];
  onGuardar: (j: Jogador) => void;
  onCancelar: () => void;
  onApagar: () => void;
}) {
  const { verClinicos } = useDados();
  const [j, setJ] = useState<Jogador>(props.inicial);
  const set = <K extends keyof Jogador>(k: K, v: Jogador[K]) => setJ({ ...j, [k]: v });
  const setClin = (k: keyof Jogador['clinico'], v: string) => setJ({ ...j, clinico: { ...j.clinico, [k]: v } });

  const conflito =
    j.ativo && j.numero != null ? props.outros.find((o) => o.ativo && o.numero === j.numero) : undefined;
  const erros = [
    !j.nome.trim() && 'O nome é obrigatório.',
    conflito && `O número ${j.numero} já pertence a ${conflito.nome}.`,
  ].filter(Boolean) as string[];

  const alternarPosicao = (p: Posicao) =>
    set('outrasPosicoes', j.outrasPosicoes.includes(p) ? j.outrasPosicoes.filter((x) => x !== p) : [...j.outrasPosicoes, p]);

  return (
    <div className="modal-fundo" onClick={props.onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{props.existe ? j.nome || 'Jogador' : 'Novo jogador'}</h2>

        <fieldset>
          <legend>Identificação</legend>
          <div className="grelha">
            <label>
              Nº
              <input type="number" value={j.numero ?? ''} onChange={(e) => set('numero', numOuNull(e.target.value))} />
            </label>
            <label className="largo">
              Nome *
              <input value={j.nome} onChange={(e) => set('nome', e.target.value)} autoFocus />
            </label>
            <label>
              Alcunha
              <input value={j.alcunha} onChange={(e) => set('alcunha', e.target.value)} />
            </label>
            <label>
              Data de nascimento
              <input type="date" value={j.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} />
              <small>Idade: {idade(j.dataNascimento) ?? '—'}</small>
            </label>
            <label>
              Nacionalidade
              <input value={j.nacionalidade} onChange={(e) => set('nacionalidade', e.target.value)} />
            </label>
            <label>
              Telemóvel
              <input type="tel" value={j.telemovel} onChange={(e) => set('telemovel', e.target.value)} />
            </label>
            <label>
              Clube anterior
              <input value={j.clubeAnterior} onChange={(e) => set('clubeAnterior', e.target.value)} />
            </label>
            <label>
              Posição principal
              <select value={j.posicao} onChange={(e) => set('posicao', e.target.value as Posicao)}>
                {POSICOES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={j.ativo} onChange={(e) => set('ativo', e.target.checked)} />
              Ativo no plantel
            </label>
          </div>
          <div className="etiquetas">
            <span className="sub">Outras posições:</span>
            {POSICOES.filter((p) => p !== j.posicao).map((p) => (
              <button
                key={p}
                type="button"
                className={'etiqueta' + (j.outrasPosicoes.includes(p) ? ' ativa' : '')}
                onClick={() => alternarPosicao(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Dados físicos</legend>
          <div className="grelha">
            <label>
              Peso (kg)
              <input type="number" step="0.1" value={j.peso ?? ''} onChange={(e) => set('peso', numOuNull(e.target.value))} />
            </label>
            <label>
              Altura (cm)
              <input type="number" value={j.altura ?? ''} onChange={(e) => set('altura', numOuNull(e.target.value))} />
            </label>
            <label>
              IMC (kg/m²)
              <input value={imc(j.peso, j.altura) ?? '—'} readOnly />
            </label>
          </div>
        </fieldset>

        {verClinicos && (
        <fieldset className="sensivel">
          <legend>Dados clínicos — informação sensível</legend>
          <p className="sub">
            Dados de saúde (RGPD, art. 9.º). Visíveis apenas para os perfis Administrador e Médico / Fisioterapia.
          </p>
          <div className="grelha">
            <label className="largo">
              Cirurgias / dados clínicos
              <textarea value={j.clinico.cirurgias} onChange={(e) => setClin('cirurgias', e.target.value)} />
            </label>
            <label className="largo">
              Lesões anteriores
              <textarea value={j.clinico.lesoesAnteriores} onChange={(e) => setClin('lesoesAnteriores', e.target.value)} />
            </label>
            <label className="largo">
              Alergias
              <textarea value={j.clinico.alergias} onChange={(e) => setClin('alergias', e.target.value)} />
            </label>
            <label className="largo">
              Restrições alimentares
              <textarea
                value={j.clinico.restricoesAlimentares}
                onChange={(e) => setClin('restricoesAlimentares', e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        )}

        {erros.length > 0 && (
          <div className="erro">
            {erros.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        <footer className="rodape-modal">
          {props.existe && (
            <button className="perigo" onClick={props.onApagar}>
              Apagar
            </button>
          )}
          <span className="espaco" />
          <button onClick={props.onCancelar}>Cancelar</button>
          <button className="primario" disabled={erros.length > 0} onClick={() => props.onGuardar({ ...j, nome: j.nome.trim() })}>
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}
