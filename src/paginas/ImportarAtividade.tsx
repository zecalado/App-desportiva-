import { Fragment, useMemo, useState } from 'react';
import { resultado } from '../calc';
import { formatarData, useDados } from '../estado';
import { descarregarModeloJogos, descarregarModeloTreinos } from '../excel';
import type { Folha } from '../importar';
import { lerExcel, normalizar } from '../importar';
import { aplicarJogos, aplicarTreinos, planearJogos, planearTreinos } from '../importarAtividade';

/** Escolha e leitura do ficheiro, comum às duas importações. */
function useFicheiro() {
  const [folhas, setFolhas] = useState<Folha[] | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [aLer, setALer] = useState(false);
  const abrir = async (f: File) => {
    setErro('');
    setALer(true);
    try {
      if (f.size > 10 * 1024 * 1024) throw new Error('Ficheiro demasiado grande (máx. 10 MB).');
      const fs = await lerExcel(await f.arrayBuffer());
      setNome(f.name);
      setFolhas(fs);
    } catch (e) {
      setFolhas(null);
      const m = (e as Error).message ?? '';
      setErro(
        m.includes('zip') || m.includes('central directory')
          ? 'Não foi possível ler o ficheiro. Confirme que é um Excel .xlsx (um .xls antigo tem de ser guardado como .xlsx).'
          : m || 'Erro ao ler o ficheiro.',
      );
    } finally {
      setALer(false);
    }
  };
  const seletor = (
    <>
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) abrir(f);
          e.target.value = '';
        }}
      />
      {aLer && <p className="sub">A ler…</p>}
      {erro && <div className="erro">{erro}</div>}
      {folhas && <p className="sub">Ficheiro: {nome}</p>}
    </>
  );
  return { folhas, seletor };
}

function ListaAvisos({ avisos, titulo }: { avisos: string[]; titulo?: string }) {
  if (!avisos.length) return null;
  return (
    <div className="aviso">
      {titulo && <strong>{titulo}</strong>}
      <ul>
        {avisos.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- Treinos ----------------

export function ImportarTreinos({ fechar }: { fechar: () => void }) {
  const { db, alterar } = useDados();
  const { folhas, seletor } = useFicheiro();
  const [idxEscolhido, setIdxEscolhido] = useState<number | null>(null);

  // Folha por defeito: a chamada "Treinos"/"Presenças", senão a primeira que tenha uma grelha válida.
  const idxFolha = useMemo(() => {
    if (!folhas) return 0;
    if (idxEscolhido !== null) return idxEscolhido;
    const porNome = folhas.findIndex((f) => ['treinos', 'presencas', 'assiduidade'].includes(normalizar(f.nome)));
    if (porNome >= 0) return porNome;
    const valida = folhas.findIndex((f) => !('erro' in planearTreinos(f, db)));
    return valida >= 0 ? valida : 0;
  }, [folhas, idxEscolhido, db]);

  const plano = useMemo(() => (folhas?.[idxFolha] ? planearTreinos(folhas[idxFolha], db) : null), [folhas, idxFolha, db]);
  const valido = plano && !('erro' in plano) ? plano : null;
  const nome = (id: string) => db.jogadores.find((j) => j.id === id)?.nome ?? '?';

  return (
    <div className="modal-fundo" onClick={fechar}>
      <div className="modal largo" onClick={(e) => e.stopPropagation()}>
        <h2>Importar treinos de Excel</h2>
        <fieldset>
          <legend>1. Ficheiro</legend>
          <p className="sub">
            Formato em grelha: <strong>uma linha por jogador</strong> (coluna “Nome” e/ou “Nº”) e{' '}
            <strong>uma coluna por treino</strong> com a data no cabeçalho. Em cada célula: <strong>P</strong> presente,{' '}
            <strong>F</strong> falta, <strong>L</strong> lesionado, <strong>D</strong> doente; vazio = sem registo. Se já
            existir um treino nessa data, as presenças são juntas. É também o formato da folha “Treinos” do Excel exportado
            pela aplicação.
          </p>
          <p>
            <button className="ligacao" onClick={() => descarregarModeloTreinos(db)}>
              Descarregar modelo (com o plantel atual)
            </button>
          </p>
          {seletor}
          {folhas && folhas.length > 1 && (
            <label>
              Folha
              <select value={idxFolha} onChange={(e) => setIdxEscolhido(Number(e.target.value))}>
                {folhas.map((f, i) => (
                  <option key={i} value={i}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        {plano && 'erro' in plano && <div className="erro">{plano.erro}</div>}

        {valido && (
          <fieldset>
            <legend>2. Pré-visualização</legend>
            <p>
              <strong>{valido.treinos.length}</strong> treino(s) ·{' '}
              <strong>{valido.treinos.filter((t) => !t.existenteId).length}</strong> novo(s) ·{' '}
              <strong>{valido.treinos.filter((t) => t.existenteId).length}</strong> já existente(s) (presenças juntas) ·{' '}
              <strong>{valido.jogadoresReconhecidos}</strong> jogador(es) · <strong>{valido.registos}</strong> registo(s)
            </p>
            {valido.naoReconhecidos.length > 0 && (
              <ListaAvisos
                titulo="Jogadores que não existem no plantel (ignorados — importe primeiro o plantel ou corrija o nome):"
                avisos={valido.naoReconhecidos}
              />
            )}
            <ListaAvisos titulo="Avisos:" avisos={valido.avisos} />
            <div className="rolagem curta">
              <table className="tabela compacta">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ação</th>
                    <th className="num">Presentes</th>
                    <th className="num">Faltas</th>
                    <th className="num">Lesionados</th>
                    <th className="num">Doentes</th>
                    <th>Ausências</th>
                  </tr>
                </thead>
                <tbody>
                  {valido.treinos.map((t) => {
                    const v = Object.entries(t.presencas);
                    const c = (p: string) => v.filter(([, x]) => x === p).length;
                    return (
                      <tr key={t.data}>
                        <td>{formatarData(t.data)}</td>
                        <td>
                          <span className={'selo ' + (t.existenteId ? 'atualizar' : 'novo')}>
                            {t.existenteId ? 'Juntar' : 'Novo'}
                          </span>
                        </td>
                        <td className="num">{c('presente')}</td>
                        <td className="num">{c('falta') || ''}</td>
                        <td className="num">{c('lesionado') || ''}</td>
                        <td className="num">{c('doente') || ''}</td>
                        <td className="avisos-linha">
                          {v
                            .filter(([, x]) => x !== 'presente')
                            .map(([id, x]) => `${nome(id)} (${x[0].toUpperCase()})`)
                            .join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </fieldset>
        )}

        <footer className="rodape-modal">
          <span className="espaco" />
          <button onClick={fechar}>Cancelar</button>
          <button
            className="primario"
            disabled={!valido?.treinos.length}
            onClick={() => {
              alterar((d) => aplicarTreinos(d, valido!));
              alert(`Importação concluída: ${valido!.treinos.length} treino(s).`);
              fechar();
            }}
          >
            Importar {valido?.treinos.length || ''} treino(s)
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------------- Jogos ----------------

export function ImportarJogos({ fechar }: { fechar: () => void }) {
  const { db, alterar } = useDados();
  const { folhas, seletor } = useFicheiro();
  const [substituir, setSubstituir] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const plano = useMemo(() => (folhas ? planearJogos(folhas, db, substituir) : null), [folhas, db, substituir]);
  const valido = plano && !('erro' in plano) ? plano : null;
  const compNome = (id: string) =>
    db.competicoes.find((c) => c.id === id)?.nome ?? valido?.competicoesNovas.find((c) => c.id === id)?.nome ?? '?';
  const nome = (id: string) => db.jogadores.find((j) => j.id === id)?.nome ?? '?';
  const comAvisos = valido?.jogos.filter((j) => j.avisos.length).length ?? 0;

  return (
    <div className="modal-fundo" onClick={fechar}>
      <div className="modal largo" onClick={(e) => e.stopPropagation()}>
        <h2>Importar jogos de Excel</h2>
        <fieldset>
          <legend>1. Ficheiro</legend>
          <p className="sub">
            Três folhas ligadas pela <strong>data do jogo</strong>: <strong>Jogos</strong> (um jogo por linha),{' '}
            <strong>Convocatórias</strong> (um jogador por linha: Titular, Suplente, Lesionado…) e{' '}
            <strong>Eventos</strong> (golos, cartões e substituições com o minuto). Só a folha Jogos é obrigatória. É
            também o formato do Excel exportado pela aplicação. Os jogadores têm de existir no plantel.
          </p>
          <p>
            <button className="ligacao" onClick={() => descarregarModeloJogos()}>
              Descarregar modelo com instruções
            </button>
          </p>
          {seletor}
        </fieldset>

        {plano && 'erro' in plano && <div className="erro">{plano.erro}</div>}

        {valido && (
          <fieldset>
            <legend>2. Pré-visualização</legend>
            <p className="sub">
              Folhas usadas: Jogos = “{valido.folhasUsadas.jogos}” · Convocatórias ={' '}
              {valido.folhasUsadas.convocatorias ? `“${valido.folhasUsadas.convocatorias}”` : <em>não encontrada</em>} ·
              Eventos = {valido.folhasUsadas.eventos ? `“${valido.folhasUsadas.eventos}”` : <em>não encontrada</em>}
            </p>
            <p>
              <strong>{valido.jogos.filter((j) => j.acao === 'novo').length}</strong> novo(s) ·{' '}
              <strong>{valido.jogos.filter((j) => j.acao === 'substituir').length}</strong> a substituir
              {valido.ignorados.length > 0 && (
                <>
                  {' '}
                  · <strong>{valido.ignorados.length}</strong> já existente(s), ignorado(s)
                </>
              )}
              {comAvisos > 0 && (
                <>
                  {' '}
                  · <span className="texto-aviso">{comAvisos} com avisos</span>
                </>
              )}
            </p>
            {(valido.ignorados.length > 0 || substituir) && (
              <label className="check">
                <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
                Substituir os jogos que já existem na aplicação com a mesma data (a convocatória e os eventos atuais
                desses jogos são apagados)
              </label>
            )}
            {valido.competicoesNovas.length > 0 && (
              <ListaAvisos
                titulo="Competições novas que vão ser criadas:"
                avisos={valido.competicoesNovas.map((c) => `${c.nome} (${c.tipo})`)}
              />
            )}
            <ListaAvisos titulo="Avisos gerais:" avisos={valido.avisos} />
            <div className="rolagem curta">
              <table className="tabela compacta clicavel">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ação</th>
                    <th>Competição</th>
                    <th>Jornada</th>
                    <th>Adversário</th>
                    <th>Local</th>
                    <th className="num">Resultado</th>
                    <th className="num">Tit./Supl.</th>
                    <th className="num">Eventos</th>
                    <th>Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {valido.jogos.map(({ jogo, acao, avisos }) => {
                    const r = resultado(jogo);
                    const tit = jogo.convocados.filter((c) => c.titular).length;
                    return (
                      <Fragment key={jogo.data}>
                        <tr
                          className={avisos.length ? 'com-aviso' : ''}
                          onClick={() => setAberto(aberto === jogo.data ? null : jogo.data)}
                          title="Clique para ver o detalhe"
                        >
                          <td>{formatarData(jogo.data)}</td>
                          <td>
                            <span className={'selo ' + (acao === 'novo' ? 'novo' : 'atualizar')}>
                              {acao === 'novo' ? 'Novo' : 'Substituir'}
                            </span>
                          </td>
                          <td>{compNome(jogo.competicaoId)}</td>
                          <td>{jogo.jornada}</td>
                          <td>{jogo.adversario}</td>
                          <td>{jogo.local === 'casa' ? 'Casa' : 'Fora'}</td>
                          <td className="num">
                            {r.marcados} – {r.sofridos}
                          </td>
                          <td className="num">
                            {tit}/{jogo.convocados.length - tit}
                          </td>
                          <td className="num">{jogo.eventos.length}</td>
                          <td className="avisos-linha">{avisos.length ? `${avisos.length} aviso(s) — ver detalhe` : ''}</td>
                        </tr>
                        {aberto === jogo.data && (
                          <tr>
                            <td colSpan={10} className="detalhe-import">
                              {avisos.length > 0 && <ListaAvisos avisos={avisos} />}
                              <div>
                                <strong>Titulares:</strong>{' '}
                                {jogo.convocados.filter((c) => c.titular).map((c) => `${c.numero ?? '—'} ${nome(c.jogadorId)}`).join(', ') || '—'}
                              </div>
                              <div>
                                <strong>Suplentes:</strong>{' '}
                                {jogo.convocados.filter((c) => !c.titular).map((c) => `${c.numero ?? '—'} ${nome(c.jogadorId)}`).join(', ') || '—'}
                              </div>
                              {jogo.indisponiveis.length > 0 && (
                                <div>
                                  <strong>Indisponíveis:</strong>{' '}
                                  {jogo.indisponiveis.map((i) => `${nome(i.jogadorId)} (${i.motivo})`).join(', ')}
                                </div>
                              )}
                              <div>
                                <strong>Eventos:</strong>{' '}
                                {[...jogo.eventos]
                                  .sort((a, b) => a.minuto - b.minuto)
                                  .map((e) =>
                                    e.tipo === 'golo'
                                      ? `${e.minuto}' golo ${nome(e.jogadorId)}`
                                      : e.tipo === 'golo_adversario'
                                        ? `${e.minuto}' golo adv.`
                                        : e.tipo === 'substituicao'
                                          ? `${e.minuto}' ${nome(e.saiId)} → ${nome(e.entraId)}`
                                          : `${e.minuto}' ${e.tipo} ${nome(e.jogadorId)}`,
                                  )
                                  .join(' · ') || '—'}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </fieldset>
        )}

        <footer className="rodape-modal">
          <span className="espaco" />
          <button onClick={fechar}>Cancelar</button>
          <button
            className="primario"
            disabled={!valido?.jogos.length}
            onClick={() => {
              alterar((d) => aplicarJogos(d, valido!));
              alert(`Importação concluída: ${valido!.jogos.length} jogo(s).`);
              fechar();
            }}
          >
            Importar {valido?.jogos.length || ''} jogo(s)
          </button>
        </footer>
      </div>
    </div>
  );
}
