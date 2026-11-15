import { useMemo, useState } from 'react';
import { formatarData, useDados } from '../estado';
import { descarregarModelo } from '../excel';
import type { Campo, Folha } from '../importar';
import { NOMES_CAMPO, aplicarImportacao, detetarCabecalho, lerExcel, mapearColunas, planearImportacao } from '../importar';

const CAMPOS_CLINICOS: Campo[] = ['cirurgias', 'lesoesAnteriores', 'alergias', 'restricoesAlimentares'];

export function ImportarExcel({ fechar }: { fechar: () => void }) {
  const { db, alterar } = useDados();
  const [folhas, setFolhas] = useState<Folha[] | null>(null);
  const [nomeFicheiro, setNomeFicheiro] = useState('');
  const [erro, setErro] = useState('');
  const [aLer, setALer] = useState(false);
  const [idxFolha, setIdxFolha] = useState(0);
  const [idxCab, setIdxCab] = useState(-1);
  const [mapa, setMapa] = useState<(Campo | null)[]>([]);
  const [clinicos, setClinicos] = useState(true);

  const escolherFolha = (fs: Folha[], i: number) => {
    setIdxFolha(i);
    const cab = detetarCabecalho(fs[i].linhas);
    setIdxCab(cab);
    setMapa(cab >= 0 ? mapearColunas(fs[i].linhas[cab]) : []);
  };

  const abrir = async (f: File) => {
    setErro('');
    setALer(true);
    try {
      if (f.size > 10 * 1024 * 1024) throw new Error('Ficheiro demasiado grande (máx. 10 MB).');
      const fs = await lerExcel(await f.arrayBuffer());
      if (!fs.length) throw new Error('O ficheiro não tem folhas.');
      setNomeFicheiro(f.name);
      setFolhas(fs);
      const comCabecalho = fs.findIndex((x) => detetarCabecalho(x.linhas) >= 0);
      escolherFolha(fs, comCabecalho >= 0 ? comCabecalho : 0);
    } catch (e) {
      setFolhas(null);
      setErro(
        (e as Error).message?.includes('zip') || (e as Error).message?.includes('central directory')
          ? 'Não foi possível ler o ficheiro. Confirme que é um Excel .xlsx (ficheiros .xls antigos devem ser guardados primeiro como .xlsx).'
          : (e as Error).message || 'Erro ao ler o ficheiro.',
      );
    } finally {
      setALer(false);
    }
  };

  const folha = folhas?.[idxFolha];
  const mapaEfetivo = useMemo(
    () => mapa.map((c) => (c && !clinicos && CAMPOS_CLINICOS.includes(c) ? null : c)),
    [mapa, clinicos],
  );
  const plano = useMemo(
    () =>
      folha && idxCab >= 0 && mapaEfetivo.includes('nome')
        ? planearImportacao(folha.linhas, idxCab, mapaEfetivo, db.jogadores)
        : [],
    [folha, idxCab, mapaEfetivo, db.jogadores],
  );
  const temClinicos = mapa.some((c) => c && CAMPOS_CLINICOS.includes(c));
  const novos = plano.filter((p) => p.acao === 'novo').length;
  const atualizados = plano.length - novos;
  const comAvisos = plano.filter((p) => p.avisos.length).length;

  const importar = () => {
    alterar((d) => ({ ...d, jogadores: aplicarImportacao(d.jogadores, plano) }));
    alert(`Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s).`);
    fechar();
  };

  const cabecalho = folha && idxCab >= 0 ? folha.linhas[idxCab] : [];

  return (
    <div className="modal-fundo" onClick={fechar}>
      <div className="modal largo" onClick={(e) => e.stopPropagation()}>
        <h2>Importar plantel de Excel</h2>

        <fieldset>
          <legend>1. Ficheiro</legend>
          <p className="sub">
            Aceita ficheiros .xlsx com uma linha de cabeçalhos (ex.: Nº, Nome, Data de Nascimento, Posição…), como o
            “Registo Geral Plantel” ou o Excel exportado por esta aplicação. Jogadores com o mesmo nome são{' '}
            <strong>atualizados</strong>; os restantes são <strong>adicionados</strong>. Nada é apagado.
          </p>
          <p>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) abrir(f);
                e.target.value = '';
              }}
            />{' '}
            <button className="ligacao" onClick={() => descarregarModelo()}>
              Descarregar modelo em branco
            </button>
          </p>
          {aLer && <p className="sub">A ler…</p>}
          {erro && <div className="erro">{erro}</div>}
          {folhas && (
            <div className="grelha">
              <label>
                Ficheiro
                <input value={nomeFicheiro} readOnly />
              </label>
              {folhas.length > 1 && (
                <label>
                  Folha
                  <select value={idxFolha} onChange={(e) => escolherFolha(folhas, Number(e.target.value))}>
                    {folhas.map((f, i) => (
                      <option key={i} value={i}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </fieldset>

        {folha && idxCab < 0 && (
          <div className="erro">
            Não encontrei uma linha de cabeçalhos com a coluna “Nome” nas primeiras 15 linhas desta folha.
          </div>
        )}

        {folha && idxCab >= 0 && (
          <fieldset>
            <legend>2. Colunas (linha {idxCab + 1} do Excel)</legend>
            <p className="sub">Confirme a correspondência. Colunas calculadas (Idade, IMC) são ignoradas.</p>
            <div className="mapa-colunas">
              {cabecalho.map((h, i) =>
                h == null || String(h).trim() === '' ? null : (
                  <label key={i}>
                    <span className="cab-excel">{String(h)}</span>
                    <select
                      value={mapa[i] ?? ''}
                      onChange={(e) => {
                        const v = (e.target.value || null) as Campo | null;
                        setMapa((m) => {
                          const n = [...m];
                          for (let k = 0; k < cabecalho.length; k++) if (v && n[k] === v) n[k] = null;
                          n[i] = v;
                          return n;
                        });
                      }}
                    >
                      <option value="">(ignorar)</option>
                      {(Object.keys(NOMES_CAMPO) as Campo[]).map((c) => (
                        <option key={c} value={c}>
                          {NOMES_CAMPO[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
            </div>
            {!mapa.includes('nome') && <div className="erro">É obrigatório indicar a coluna do Nome.</div>}
            {temClinicos && (
              <label className="check aviso-clinico">
                <input type="checkbox" checked={clinicos} onChange={(e) => setClinicos(e.target.checked)} />
                Importar também os dados clínicos (informação de saúde sensível)
              </label>
            )}
          </fieldset>
        )}

        {plano.length > 0 && (
          <fieldset>
            <legend>3. Pré-visualização</legend>
            <p>
              <strong>{novos}</strong> novo(s) · <strong>{atualizados}</strong> a atualizar
              {comAvisos > 0 && (
                <>
                  {' '}
                  · <span className="texto-aviso">{comAvisos} com avisos (verificar)</span>
                </>
              )}
            </p>
            <div className="rolagem curta">
              <table className="tabela compacta">
                <thead>
                  <tr>
                    <th className="num">Linha</th>
                    <th>Ação</th>
                    <th className="num">Nº</th>
                    <th>Nome</th>
                    <th>Posição</th>
                    <th>Outras</th>
                    <th>Nascimento</th>
                    <th>Clube anterior</th>
                    <th>Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.map((p) => (
                    <tr key={p.linhaExcel} className={p.avisos.length ? 'com-aviso' : ''}>
                      <td className="num">{p.linhaExcel}</td>
                      <td>
                        <span className={'selo ' + p.acao}>{p.acao === 'novo' ? 'Novo' : 'Atualizar'}</span>
                      </td>
                      <td className="num">{p.jogador.numero ?? '—'}</td>
                      <td>{p.jogador.nome}</td>
                      <td>{p.jogador.posicao}</td>
                      <td className="sub">{p.jogador.outrasPosicoes.join(', ')}</td>
                      <td>{formatarData(p.jogador.dataNascimento)}</td>
                      <td>{p.jogador.clubeAnterior}</td>
                      <td className="avisos-linha">{p.avisos.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        )}
        {folha && idxCab >= 0 && mapa.includes('nome') && plano.length === 0 && (
          <p className="vazio">Não há linhas com nome por baixo do cabeçalho.</p>
        )}

        <footer className="rodape-modal">
          <span className="espaco" />
          <button onClick={fechar}>Cancelar</button>
          <button className="primario" disabled={!plano.length} onClick={importar}>
            Importar {plano.length || ''} jogador(es)
          </button>
        </footer>
      </div>
    </div>
  );
}
