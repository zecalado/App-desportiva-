import { useState } from 'react';
import { alertaDisciplina, estadoNoJogo, jogosFiltrados, totaisJogador } from '../calc';
import type { Totais } from '../calc';
import { useDados } from '../estado';
import { SIGLA_ESTADO, rotuloJogo } from '../excel';

function SeletorCompeticao({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const { db } = useDados();
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">Todas as competições</option>
      {db.competicoes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}

const COLUNAS: { k: keyof Totais; t: string; titulo?: string }[] = [
  { k: 'treinosRealizados', t: 'Treinos', titulo: 'Treinos realizados' },
  { k: 'pctTreinos', t: '% Tr.', titulo: '% de treinos realizados (sobre os treinos com registo)' },
  { k: 'faltasTreino', t: 'Faltas' },
  { k: 'treinosLesionado', t: 'Les.', titulo: 'Treinos lesionado' },
  { k: 'treinosDoente', t: 'Doente', titulo: 'Treinos doente' },
  { k: 'convocado', t: 'Conv.', titulo: 'Convocado' },
  { k: 'minutos', t: 'Min.', titulo: 'Minutos jogados' },
  { k: 'titular', t: 'Tit.', titulo: 'Titular' },
  { k: 'jogoCompleto', t: 'Compl.', titulo: 'Jogo completo' },
  { k: 'suplenteUtilizado', t: 'SU', titulo: 'Suplente utilizado' },
  { k: 'suplenteNaoUtilizado', t: 'SNU', titulo: 'Suplente não utilizado' },
  { k: 'golos', t: 'Golos' },
  { k: 'assistencias', t: 'Assist.' },
  { k: 'golosSofridos', t: 'GS', titulo: 'Golos sofridos (só guarda-redes)' },
  { k: 'amarelos', t: 'Am.', titulo: 'Amarelos' },
  { k: 'vermelhos', t: 'Verm.', titulo: 'Vermelhos diretos' },
  { k: 'expulsoesSegundoAmarelo', t: '2ºAm.', titulo: 'Expulsões por 2º amarelo' },
];

export function Estatisticas() {
  const { db } = useDados();
  const [comp, setComp] = useState('');
  const [ordem, setOrdem] = useState<keyof Totais | 'numero'>('numero');

  const linhas = db.jogadores
    .filter((j) => j.ativo)
    .map((j) => ({ j, t: totaisJogador(db, j, comp || null) }))
    .sort((a, b) =>
      ordem === 'numero'
        ? (a.j.numero ?? 999) - (b.j.numero ?? 999)
        : ((b.t[ordem] as number | null) ?? -1) - ((a.t[ordem] as number | null) ?? -1),
    );

  return (
    <section>
      <header className="cabecalho">
        <h1>Estatísticas do plantel</h1>
        <SeletorCompeticao valor={comp} onChange={setComp} />
      </header>
      <p className="sub">
        {jogosFiltrados(db, comp || null).length} jogo(s) · {db.treinos.length} treino(s). Clique num cabeçalho para
        ordenar. Os treinos não dependem da competição selecionada.
      </p>
      <div className="rolagem">
        <table className="tabela compacta">
          <thead>
            <tr>
              <th className="num ordenavel" onClick={() => setOrdem('numero')}>
                Nº
              </th>
              <th>Nome</th>
              {COLUNAS.map((c) => (
                <th
                  key={c.k}
                  className={'num ordenavel' + (ordem === c.k ? ' ordenado' : '')}
                  title={c.titulo ?? c.t}
                  onClick={() => setOrdem(c.k)}
                >
                  {c.t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ j, t }) => (
              <tr key={j.id}>
                <td className="num">{j.numero ?? '—'}</td>
                <td>{j.nome}</td>
                {COLUNAS.map((c) => {
                  const v = t[c.k];
                  const mostrar =
                    c.k === 'golosSofridos' && j.posicao !== 'Guarda-Redes'
                      ? ''
                      : c.k === 'pctTreinos'
                        ? v == null
                          ? '—'
                          : `${v}%`
                        : c.k === 'golosSofridos'
                          ? v
                          : v || '';
                  return (
                    <td key={c.k} className="num">
                      {mostrar}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Disciplina() {
  const { db } = useDados();
  const [comp, setComp] = useState('');
  const jogos = jogosFiltrados(db, comp || null);
  const jogadores = db.jogadores.filter((j) => j.ativo).sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));
  const competicoes = comp ? db.competicoes.filter((c) => c.id === comp) : db.competicoes;

  return (
    <section>
      <header className="cabecalho">
        <h1>Disciplina e participação</h1>
        <SeletorCompeticao valor={comp} onChange={setComp} />
      </header>
      <div className="legenda">
        <span className="cel sit-titular">T</span> Titular
        <span className="cel sit-suplente_utilizado">SU</span> Suplente utilizado
        <span className="cel sit-suplente_nao_utilizado">SNU</span> Não utilizado
        <span className="cel sit-nao_convocado">NC</span> Não convocado
        <span className="cel sit-lesionado">L</span> Lesionado
        <span className="cel sit-doente">D</span> Doente
        <span className="cel sit-castigado">C</span> Castigado
        <span className="cartao amarelo" /> Amarelo
        <span className="cartao vermelho" /> Vermelho
      </div>
      {jogos.length === 0 ? (
        <p className="vazio">Sem jogos.</p>
      ) : (
        <div className="rolagem">
          <table className="tabela matriz">
            <thead>
              <tr>
                <th className="num">Nº</th>
                <th>Nome</th>
                {jogos.map((g) => (
                  <th key={g.id} className="vertical" title={rotuloJogo(db, g)}>
                    <span>{rotuloJogo(db, g)}</span>
                  </th>
                ))}
                {competicoes.map((c) => (
                  <th key={c.id} className="num" title={`Amarelos acumulados — ${c.nome}`}>
                    Am. {c.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jogadores.map((j) => (
                <tr key={j.id}>
                  <td className="num">{j.numero ?? '—'}</td>
                  <td>{j.nome}</td>
                  {jogos.map((g) => {
                    const est = estadoNoJogo(g, j.id);
                    const am = g.eventos.filter((e) => e.tipo === 'amarelo' && e.jogadorId === j.id);
                    const vm = g.eventos.filter((e) => e.tipo === 'vermelho' && e.jogadorId === j.id);
                    const titulo = [
                      ...am.map((e) => `Amarelo ${e.minuto}'`),
                      ...vm.map((e) => `Vermelho ${e.minuto}'`),
                    ].join(', ');
                    return (
                      <td key={g.id} className={'cel sit-' + est} title={titulo}>
                        {SIGLA_ESTADO[est]}
                        {am.map((e) => (
                          <span key={e.id} className="cartao amarelo" />
                        ))}
                        {vm.map((e) => (
                          <span key={e.id} className="cartao vermelho" />
                        ))}
                      </td>
                    );
                  })}
                  {competicoes.map((c) => {
                    const a = alertaDisciplina(db, j.id, c);
                    const cls = a.atingiuLimite ? 'alerta-forte' : a.faltam === 1 ? 'alerta' : '';
                    const titulo = a.limite
                      ? a.atingiuLimite
                        ? `Atingiu ${a.amarelos} amarelos (múltiplo de ${a.limite}) — verificar castigo`
                        : `Faltam ${a.faltam} para ${a.amarelos + (a.faltam ?? 0)}`
                      : 'Limite de amarelos não configurado (ver Dados)';
                    return (
                      <td key={c.id} className={'num ' + cls} title={titulo}>
                        {a.amarelos || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sub">
        Alertas de castigo: laranja = falta 1 amarelo para o limite; vermelho = limite atingido. O limite por competição
        configura-se em “Dados” e deve ser confirmado no regulamento da associação.
      </p>
    </section>
  );
}
