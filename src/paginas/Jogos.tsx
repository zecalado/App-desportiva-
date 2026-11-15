import { useState } from 'react';
import { estadoNoJogo, golosSofridosEmCampo, intervaloEmCampo, minutosJogados, resultado, validarJogo } from '../calc';
import { formatarData, hoje, numOuNull, useDados } from '../estado';
import type { Evento, Jogo, MotivoIndisponivel, TipoEvento } from '../types';
import { novoId } from '../types';
import { ImportarJogos } from './ImportarAtividade';

export function Jogos() {
  const { db, alterar } = useDados();
  const [aberto, setAberto] = useState<string | null>(null);
  const [importar, setImportar] = useState(false);
  const jogo = db.jogos.find((j) => j.id === aberto);
  if (jogo) return <DetalheJogo jogo={jogo} voltar={() => setAberto(null)} />;

  const novo = () => {
    const j: Jogo = {
      id: novoId(),
      competicaoId: db.competicoes[0]?.id ?? '',
      jornada: '',
      data: hoje(),
      adversario: '',
      local: 'casa',
      duracao: 90,
      convocados: [],
      indisponiveis: [],
      eventos: [],
      notas: '',
    };
    alterar((d) => ({ ...d, jogos: [...d.jogos, j] }));
    setAberto(j.id);
  };

  const lista = [...db.jogos].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <section>
      <header className="cabecalho">
        <h1>Jogos</h1>
        <div className="acoes">
          <button onClick={() => setImportar(true)} disabled={!db.jogadores.length} title={db.jogadores.length ? '' : 'Importe ou crie primeiro o plantel'}>
            Importar Excel…
          </button>
          <button className="primario" onClick={novo} disabled={!db.competicoes.length}>
            + Novo jogo
          </button>
        </div>
      </header>
      {importar && <ImportarJogos fechar={() => setImportar(false)} />}
      {lista.length === 0 ? (
        <p className="vazio">Sem jogos registados.</p>
      ) : (
        <table className="tabela clicavel">
          <thead>
            <tr>
              <th>Data</th>
              <th>Competição</th>
              <th>Jornada</th>
              <th>Adversário</th>
              <th>Local</th>
              <th className="num">Resultado</th>
              <th className="num">Convocados</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((j) => {
              const r = resultado(j);
              const cls = r.marcados > r.sofridos ? 'vitoria' : r.marcados < r.sofridos ? 'derrota' : 'empate';
              return (
                <tr key={j.id} onClick={() => setAberto(j.id)}>
                  <td>{formatarData(j.data)}</td>
                  <td>{db.competicoes.find((c) => c.id === j.competicaoId)?.nome}</td>
                  <td>{j.jornada}</td>
                  <td>{j.adversario || <span className="sub">(sem adversário)</span>}</td>
                  <td>{j.local === 'casa' ? 'Casa' : 'Fora'}</td>
                  <td className="num">
                    <span className={'resultado ' + cls}>
                      {r.marcados} – {r.sofridos}
                    </span>
                  </td>
                  <td className="num">{j.convocados.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

type Situacao = 'nc' | 'titular' | 'suplente' | MotivoIndisponivel;

function DetalheJogo({ jogo, voltar }: { jogo: Jogo; voltar: () => void }) {
  const { db, alterar } = useDados();
  const [separador, setSeparador] = useState<'convocatoria' | 'eventos' | 'resumo'>(
    jogo.convocados.length ? 'eventos' : 'convocatoria',
  );

  const atualizar = (f: (j: Jogo) => void) =>
    alterar((d) => {
      const j = d.jogos.find((x) => x.id === jogo.id)!;
      f(j);
      return d;
    });

  const avisos = validarJogo(jogo, db.jogadores);
  const r = resultado(jogo);
  const comp = db.competicoes.find((c) => c.id === jogo.competicaoId);

  return (
    <section>
      <header className="cabecalho">
        <div>
          <button className="ligacao" onClick={voltar}>
            ← Jogos
          </button>
          <h1>
            {jogo.local === 'casa'
              ? `${db.definicoes.clube || 'Nós'}  ${r.marcados} – ${r.sofridos}  ${jogo.adversario || '…'}`
              : `${jogo.adversario || '…'}  ${r.sofridos} – ${r.marcados}  ${db.definicoes.clube || 'Nós'}`}
          </h1>
          <div className="sub">
            {comp?.nome} · {jogo.jornada} · {formatarData(jogo.data)}
          </div>
        </div>
        <button
          className="perigo"
          onClick={() => {
            if (!confirm('Apagar este jogo e todos os seus registos?')) return;
            alterar((d) => ({ ...d, jogos: d.jogos.filter((j) => j.id !== jogo.id) }));
            voltar();
          }}
        >
          Apagar jogo
        </button>
      </header>

      <fieldset>
        <legend>Dados do jogo</legend>
        <div className="grelha">
          <label>
            Competição
            <select value={jogo.competicaoId} onChange={(e) => atualizar((j) => (j.competicaoId = e.target.value))}>
              {db.competicoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jornada / eliminatória
            <input
              value={jogo.jornada}
              placeholder="ex.: 1ª Jornada"
              onChange={(e) => atualizar((j) => (j.jornada = e.target.value))}
            />
          </label>
          <label>
            Data
            <input type="date" value={jogo.data} onChange={(e) => atualizar((j) => (j.data = e.target.value))} />
          </label>
          <label>
            Adversário
            <input value={jogo.adversario} onChange={(e) => atualizar((j) => (j.adversario = e.target.value))} />
          </label>
          <label>
            Local
            <select value={jogo.local} onChange={(e) => atualizar((j) => (j.local = e.target.value as Jogo['local']))}>
              <option value="casa">Casa</option>
              <option value="fora">Fora</option>
            </select>
          </label>
          <label>
            Duração (min)
            <input
              type="number"
              value={jogo.duracao}
              onChange={(e) => atualizar((j) => (j.duracao = numOuNull(e.target.value) ?? 90))}
            />
          </label>
          <label className="largo">
            Notas
            <textarea value={jogo.notas} onChange={(e) => atualizar((j) => (j.notas = e.target.value))} />
          </label>
        </div>
      </fieldset>

      {avisos.length > 0 && (
        <div className="aviso">
          <strong>Verificar:</strong>
          <ul>
            {avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <nav className="separadores">
        {(
          [
            ['convocatoria', `Convocatória (${jogo.convocados.length})`],
            ['eventos', `Eventos (${jogo.eventos.length})`],
            ['resumo', 'Minutos e resumo'],
          ] as const
        ).map(([k, t]) => (
          <button key={k} className={separador === k ? 'ativo' : ''} onClick={() => setSeparador(k)}>
            {t}
          </button>
        ))}
      </nav>

      {separador === 'convocatoria' && <Convocatoria jogo={jogo} atualizar={atualizar} />}
      {separador === 'eventos' && <Eventos jogo={jogo} atualizar={atualizar} />}
      {separador === 'resumo' && <Resumo jogo={jogo} />}
    </section>
  );
}

function Convocatoria({ jogo, atualizar }: { jogo: Jogo; atualizar: (f: (j: Jogo) => void) => void }) {
  const { db } = useDados();
  const jogadores = db.jogadores
    .filter((j) => j.ativo || jogo.convocados.some((c) => c.jogadorId === j.id))
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));

  const situacao = (id: string): Situacao => {
    const c = jogo.convocados.find((x) => x.jogadorId === id);
    if (c) return c.titular ? 'titular' : 'suplente';
    return jogo.indisponiveis.find((x) => x.jogadorId === id)?.motivo ?? 'nc';
  };

  const definir = (id: string, s: Situacao) =>
    atualizar((j) => {
      const anterior = j.convocados.find((c) => c.jogadorId === id);
      j.convocados = j.convocados.filter((c) => c.jogadorId !== id);
      j.indisponiveis = j.indisponiveis.filter((c) => c.jogadorId !== id);
      if (s === 'titular' || s === 'suplente') {
        const numero = anterior?.numero ?? db.jogadores.find((x) => x.id === id)?.numero ?? null;
        j.convocados.push({ jogadorId: id, numero, titular: s === 'titular' });
      } else if (s !== 'nc') j.indisponiveis.push({ jogadorId: id, motivo: s });
    });

  const usadoEmEventos = (id: string) =>
    jogo.eventos.some((e) =>
      e.tipo === 'substituicao'
        ? e.saiId === id || e.entraId === id
        : e.tipo === 'golo'
          ? e.jogadorId === id || e.assistenciaId === id
          : e.tipo !== 'golo_adversario' && e.jogadorId === id,
    );

  const titulares = jogo.convocados.filter((c) => c.titular).length;
  const suplentes = jogo.convocados.length - titulares;

  return (
    <>
      <p className="sub">
        Titulares: <strong>{titulares}</strong> · Suplentes: <strong>{suplentes}</strong>. Quem não for escolhido conta
        como “não convocado”; use Lesionado/Doente/Castigado para registar o motivo.
      </p>
      <table className="tabela">
        <thead>
          <tr>
            <th className="num">Nº plantel</th>
            <th>Jogador</th>
            <th>Posição</th>
            <th>Situação</th>
            <th className="num">Nº neste jogo</th>
          </tr>
        </thead>
        <tbody>
          {jogadores.map((p) => {
            const s = situacao(p.id);
            const conv = jogo.convocados.find((c) => c.jogadorId === p.id);
            return (
              <tr key={p.id} className={'sit-' + s}>
                <td className="num">{p.numero ?? '—'}</td>
                <td>{p.nome}</td>
                <td className="sub">{p.posicao}</td>
                <td>
                  <select
                    value={s}
                    onChange={(e) => {
                      const novo = e.target.value as Situacao;
                      if ((novo !== 'titular' && novo !== 'suplente') && usadoEmEventos(p.id)) {
                        alert('Este jogador tem eventos neste jogo. Apague primeiro esses eventos.');
                        return;
                      }
                      definir(p.id, novo);
                    }}
                  >
                    <option value="nc">— Não convocado</option>
                    <option value="titular">Titular</option>
                    <option value="suplente">Suplente</option>
                    <option value="lesionado">Lesionado</option>
                    <option value="doente">Doente</option>
                    <option value="castigado">Castigado</option>
                    <option value="outro">Indisponível (outro)</option>
                  </select>
                </td>
                <td className="num">
                  {conv && (
                    <input
                      className="curto"
                      type="number"
                      value={conv.numero ?? ''}
                      onChange={(e) =>
                        atualizar((j) => {
                          const c = j.convocados.find((x) => x.jogadorId === p.id)!;
                          c.numero = numOuNull(e.target.value);
                        })
                      }
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

const NOMES_EVENTO: Record<TipoEvento, string> = {
  golo: 'Golo',
  golo_adversario: 'Golo do adversário',
  amarelo: 'Cartão amarelo',
  vermelho: 'Cartão vermelho (direto)',
  substituicao: 'Substituição',
};

function Eventos({ jogo, atualizar }: { jogo: Jogo; atualizar: (f: (j: Jogo) => void) => void }) {
  const { db } = useDados();
  const [tipo, setTipo] = useState<TipoEvento>('golo');
  const [minuto, setMinuto] = useState('');
  const [a, setA] = useState(''); // jogador / quem sai
  const [b, setB] = useState(''); // assistência / quem entra
  const [penalti, setPenalti] = useState(false);
  const [descricao, setDescricao] = useState('');

  const nome = (id: string | null) => (id ? db.jogadores.find((j) => j.id === id)?.nome ?? '?' : '');
  const numero = (id: string) => jogo.convocados.find((c) => c.jogadorId === id)?.numero;
  const rotulo = (id: string) => `${numero(id) ?? '—'} · ${nome(id)}`;
  const convocados = [...jogo.convocados].sort((x, y) => Number(y.titular) - Number(x.titular));
  const suplentes = convocados.filter((c) => !c.titular);

  if (!jogo.convocados.length)
    return <p className="vazio">Primeiro defina a convocatória (titulares e suplentes).</p>;

  const m = numOuNull(minuto);
  const valido =
    m !== null &&
    (tipo === 'golo_adversario' || a !== '') &&
    (tipo !== 'substituicao' || (b !== '' && a !== b));

  const adicionar = () => {
    if (!valido || m === null) return;
    const id = novoId();
    let e: Evento;
    if (tipo === 'golo') e = { id, tipo, minuto: m, jogadorId: a, assistenciaId: b || null, penalti };
    else if (tipo === 'golo_adversario') e = { id, tipo, minuto: m, descricao: descricao.trim() };
    else if (tipo === 'substituicao') e = { id, tipo, minuto: m, saiId: a, entraId: b };
    else e = { id, tipo, minuto: m, jogadorId: a };
    atualizar((j) => j.eventos.push(e));
    setMinuto('');
    setA('');
    setB('');
    setPenalti(false);
    setDescricao('');
  };

  const descrever = (e: Evento) => {
    switch (e.tipo) {
      case 'golo':
        return `${nome(e.jogadorId)}${e.penalti ? ' (penálti)' : ''}${e.assistenciaId ? ` — assistência de ${nome(e.assistenciaId)}` : ''}`;
      case 'golo_adversario':
        return e.descricao || '—';
      case 'substituicao':
        return `Sai ${nome(e.saiId)} · Entra ${nome(e.entraId)}`;
      default:
        return nome(e.jogadorId);
    }
  };

  const ordenados = [...jogo.eventos].sort((x, y) => x.minuto - y.minuto);

  return (
    <>
      <div className="formulario-evento">
        <label>
          Tipo
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoEvento);
              setA('');
              setB('');
            }}
          >
            {Object.entries(NOMES_EVENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Minuto
          <input
            className="curto"
            type="number"
            value={minuto}
            onChange={(e) => setMinuto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          />
        </label>

        {tipo === 'golo_adversario' ? (
          <label>
            Marcador (opcional)
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
        ) : (
          <label>
            {tipo === 'substituicao' ? 'Sai' : 'Jogador'}
            <select value={a} onChange={(e) => setA(e.target.value)}>
              <option value="">—</option>
              {convocados.map((c) => (
                <option key={c.jogadorId} value={c.jogadorId}>
                  {rotulo(c.jogadorId)}
                  {c.titular ? '' : ' (supl.)'}
                </option>
              ))}
            </select>
          </label>
        )}

        {tipo === 'golo' && (
          <>
            <label>
              Assistência
              <select value={b} onChange={(e) => setB(e.target.value)}>
                <option value="">— sem assistência</option>
                {convocados
                  .filter((c) => c.jogadorId !== a)
                  .map((c) => (
                    <option key={c.jogadorId} value={c.jogadorId}>
                      {rotulo(c.jogadorId)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={penalti} onChange={(e) => setPenalti(e.target.checked)} /> Penálti
            </label>
          </>
        )}
        {tipo === 'substituicao' && (
          <label>
            Entra
            <select value={b} onChange={(e) => setB(e.target.value)}>
              <option value="">—</option>
              {suplentes.map((c) => (
                <option key={c.jogadorId} value={c.jogadorId}>
                  {rotulo(c.jogadorId)}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="primario" disabled={!valido} onClick={adicionar}>
          Adicionar
        </button>
      </div>
      <p className="sub">
        Um 2º amarelo no mesmo jogo é tratado automaticamente como expulsão (o jogador sai de campo nesse minuto).
      </p>

      {ordenados.length === 0 ? (
        <p className="vazio">Sem eventos.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th className="num">Min.</th>
              <th>Evento</th>
              <th>Detalhe</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ordenados.map((e) => (
              <tr key={e.id}>
                <td className="num">{e.minuto}'</td>
                <td>
                  <span className={'marca ev-' + e.tipo} /> {NOMES_EVENTO[e.tipo]}
                </td>
                <td>{descrever(e)}</td>
                <td className="num">
                  <button
                    className="ligacao perigo"
                    onClick={() => atualizar((j) => (j.eventos = j.eventos.filter((x) => x.id !== e.id)))}
                  >
                    remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

const NOMES_ESTADO: Record<string, string> = {
  titular: 'Titular',
  suplente_utilizado: 'Suplente utilizado',
  suplente_nao_utilizado: 'Suplente não utilizado',
};

function Resumo({ jogo }: { jogo: Jogo }) {
  const { db } = useDados();
  const linhas = [...jogo.convocados]
    .sort((x, y) => Number(y.titular) - Number(x.titular) || (x.numero ?? 999) - (y.numero ?? 999))
    .map((c) => {
      const j = db.jogadores.find((x) => x.id === c.jogadorId)!;
      const iv = intervaloEmCampo(jogo, c.jogadorId);
      const cont = (t: 'golo' | 'amarelo' | 'vermelho') =>
        jogo.eventos.filter((e) => e.tipo === t && e.jogadorId === c.jogadorId).length;
      return {
        c,
        j,
        iv,
        estado: estadoNoJogo(jogo, c.jogadorId),
        minutos: minutosJogados(jogo, c.jogadorId),
        golos: cont('golo'),
        assist: jogo.eventos.filter((e) => e.tipo === 'golo' && e.assistenciaId === c.jogadorId).length,
        amarelos: cont('amarelo'),
        vermelhos: cont('vermelho'),
        gs: j?.posicao === 'Guarda-Redes' ? golosSofridosEmCampo(jogo, c.jogadorId) : null,
      };
    });

  return (
    <table className="tabela">
      <thead>
        <tr>
          <th className="num">Nº</th>
          <th>Jogador</th>
          <th>Situação</th>
          <th className="num">Entrou</th>
          <th className="num">Saiu</th>
          <th className="num">Minutos</th>
          <th className="num">Golos</th>
          <th className="num">Assist.</th>
          <th className="num">Amarelos</th>
          <th className="num">Verm.</th>
          <th className="num">Golos sofridos (GR)</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.c.jogadorId}>
            <td className="num">{l.c.numero ?? '—'}</td>
            <td>{l.j?.nome}</td>
            <td>{NOMES_ESTADO[l.estado]}</td>
            <td className="num">{l.iv && !l.c.titular ? `${l.iv.entrada}'` : ''}</td>
            <td className="num">
              {l.iv?.saida != null ? `${l.iv.saida}'` : ''}
              {l.iv?.motivoSaida && l.iv.motivoSaida !== 'substituicao' ? ' (expulso)' : ''}
            </td>
            <td className="num">
              <strong>{l.minutos}</strong>
            </td>
            <td className="num">{l.golos || ''}</td>
            <td className="num">{l.assist || ''}</td>
            <td className="num">{l.amarelos || ''}</td>
            <td className="num">{l.vermelhos || ''}</td>
            <td className="num">{l.gs ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
