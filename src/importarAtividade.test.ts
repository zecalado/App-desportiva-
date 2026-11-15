import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { construirExcel } from './excel';
import { lerExcel } from './importar';
import type { PlanoJogos, PlanoTreinos } from './importarAtividade';
import {
  aplicarJogos,
  aplicarTreinos,
  converterDataEpoca,
  converterMinuto,
  converterPresenca,
  converterSituacao,
  converterTipoEvento,
  planearJogos,
  planearTreinos,
} from './importarAtividade';
import { dadosExemplo } from './seed';
import type { BaseDados, Jogo } from './types';

async function ler(wb: ExcelJS.Workbook) {
  const b = await wb.xlsx.writeBuffer();
  return lerExcel(b instanceof ArrayBuffer ? b : new Uint8Array(b as Uint8Array).buffer);
}
const ok = <T,>(r: T | { erro: string }): T => {
  if (r && typeof r === 'object' && 'erro' in r) throw new Error((r as { erro: string }).erro);
  return r as T;
};
/** Base de dados com o mesmo plantel e competições, mas sem jogos nem treinos. */
const semAtividade = (db: BaseDados): BaseDados => ({ ...structuredClone(db), jogos: [], treinos: [] });

function normalizarJogo(j: Jogo) {
  return {
    ...j,
    id: '',
    convocados: [...j.convocados].sort((a, b) => a.jogadorId.localeCompare(b.jogadorId)),
    indisponiveis: [...j.indisponiveis].sort((a, b) => a.jogadorId.localeCompare(b.jogadorId)),
    eventos: j.eventos
      .map(({ id: _id, ...e }) => e)
      .sort((a, b) => a.minuto - b.minuto || JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

describe('conversões', () => {
  it('presenças', () => {
    expect(['P', 'presente', 'x', '✓', 1].map(converterPresenca)).toEqual(Array(5).fill('presente'));
    expect(['F', 'Falta', 'FJ', 0].map(converterPresenca)).toEqual(Array(4).fill('falta'));
    expect(converterPresenca('L')).toBe('lesionado');
    expect(converterPresenca('Doente')).toBe('doente');
    expect(converterPresenca('')).toBeNull();
    expect(converterPresenca('Z')).toBe('invalido');
  });
  it('situação, tipo de evento e minuto', () => {
    expect(converterSituacao('Titular')).toBe('titular');
    expect(converterSituacao('Supl.')).toBe('suplente');
    expect(converterSituacao('Castigado')).toBe('castigado');
    expect(converterSituacao('NC')).toBe('nc');
    expect(converterTipoEvento('Golo adversário')).toBe('golo_adversario');
    expect(converterTipoEvento('Cartão Amarelo')).toBe('amarelo');
    expect(converterTipoEvento('Substituição')).toBe('substituicao');
    expect(converterMinuto("40'")).toBe(40);
    expect(converterMinuto('68"')).toBe(68);
    expect(converterMinuto('90+3')).toBe(93);
    expect(converterMinuto('abc')).toBeNull();
  });
  it('datas sem ano usam a época', () => {
    expect(converterDataEpoca('05/09', '2026/2027')).toBe('2026-09-05');
    expect(converterDataEpoca('10/01', '2026/2027')).toBe('2027-01-10');
    expect(converterDataEpoca('Treino 05/09', '2026/2027')).toBe('2026-09-05');
    expect(converterDataEpoca('Campeonato 1ª Jornada 27/09/26 Estrela da Planície', '2026/2027')).toBeNull();
  });
});

describe('ida e volta com o Excel exportado pela aplicação', async () => {
  const db = dadosExemplo();
  const folhas = await ler(await construirExcel(db, false));

  it('treinos: reimportar para uma base vazia reproduz todas as presenças', () => {
    const destino = semAtividade(db);
    const plano = ok<PlanoTreinos>(planearTreinos(folhas.find((f) => f.nome === 'Treinos')!, destino));
    expect(plano.avisos).toEqual([]);
    expect(plano.naoReconhecidos).toEqual([]);
    const r = aplicarTreinos(destino, plano);
    const resumo = (b: BaseDados) =>
      b.treinos.map((t) => ({ data: t.data, presencas: t.presencas })).sort((a, b) => a.data.localeCompare(b.data));
    expect(resumo(r)).toEqual(resumo(db));
  });

  it('jogos: reimportar para uma base vazia reproduz jogos, convocatórias e eventos', () => {
    const destino = semAtividade(db);
    const plano = ok<PlanoJogos>(planearJogos(folhas, destino, false));
    expect(plano.folhasUsadas).toEqual({ jogos: 'Jogos', convocatorias: 'Convocatórias', eventos: 'Eventos' });
    expect(plano.avisos).toEqual([]);
    expect(plano.competicoesNovas).toEqual([]);
    for (const p of plano.jogos) expect([p.jogo.data, p.avisos]).toEqual([p.jogo.data, []]);
    const r = aplicarJogos(destino, plano);
    const ord = (b: BaseDados) => [...b.jogos].sort((a, c) => a.data.localeCompare(c.data)).map(normalizarJogo);
    expect(ord(r)).toEqual(ord(db));
  });

  it('jogos já existentes são ignorados, a não ser que se peça para substituir', () => {
    const p1 = ok<PlanoJogos>(planearJogos(folhas, db, false));
    expect(p1.jogos).toHaveLength(0);
    expect(p1.ignorados).toHaveLength(db.jogos.length);
    const p2 = ok<PlanoJogos>(planearJogos(folhas, db, true));
    expect(p2.jogos.every((j) => j.acao === 'substituir')).toBe(true);
    const r = aplicarJogos(db, p2);
    expect(r.jogos).toHaveLength(db.jogos.length);
  });
});

describe('ficheiros preenchidos à mão', () => {
  const db = semAtividade(dadosExemplo());

  it('grelha de treinos com datas variadas, símbolos e erros', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Presenças');
    ws.getCell('A1').value = 'Assiduidade Setembro';
    ws.getRow(3).values = ['Nome', new Date(Date.UTC(2026, 8, 1)), 'Treino 02/09', '04/09/2026'];
    ws.getRow(4).values = ['Rui Fonseca', 'P', '✓', 'F'];
    ws.getRow(5).values = ['paulo gomes', 'x', 'L', 'Z'];
    ws.getRow(6).values = ['Jogador Desconhecido', 'P', 'P', 'P'];
    const [f] = await ler(wb);
    const plano = ok<PlanoTreinos>(planearTreinos(f, db));
    expect(plano.treinos.map((t) => t.data)).toEqual(['2026-09-01', '2026-09-02', '2026-09-04']);
    expect(plano.registos).toBe(5);
    expect(plano.naoReconhecidos).toEqual(['Jogador Desconhecido (linha 6)']);
    expect(plano.avisos.join(' ')).toContain('“Z” não reconhecido');
    const gr = db.jogadores.find((j) => j.nome === 'Rui Fonseca')!.id;
    expect(plano.treinos[2].presencas[gr]).toBe('falta');
  });

  it('jogo com jogadores por número, minutos em texto e erros', async () => {
    const wb = new ExcelJS.Workbook();
    const j = wb.addWorksheet('Jogos');
    j.addRow(['Data', 'Competição', 'Jornada', 'Adversário', 'Local']);
    j.addRow(['04/10/2026', 'Campeonato', '2ª Jornada', 'Juventude Serrana B', 'F']);
    j.addRow(['11/10/2026', 'Torneio de Verão', '', 'Equipa X', 'Casa']);
    const c = wb.addWorksheet('Convocatórias');
    c.addRow(['Data', 'Jogador', 'Situação']);
    for (const n of [99, 20, 23, 4, 14, 8, 5, 10, 13, 21, 9]) c.addRow(['04/10/2026', n, 'Titular']);
    for (const n of [1, 22, 7]) c.addRow(['04/10/2026', n, 'Suplente']);
    c.addRow(['04/10/2026', 'Sérgio Faria', 'Lesionado']);
    c.addRow(['04/10/2026', 'Fulano', 'Titular']);
    const e = wb.addWorksheet('Eventos');
    e.addRow(['Data', 'Minuto', 'Tipo', 'Jogador', 'Assistência / Entra', 'Penálti', 'Descrição']);
    e.addRow(['04/10/2026', "18'", 'Golo', 9, 13]);
    e.addRow(['04/10/2026', '33"', 'Golo adversário', null, null, null, 'Marcador X']);
    e.addRow(['04/10/2026', 55, 'Substituição', 13, 7]);
    e.addRow(['04/10/2026', '90+2', 'Golo', 'Samuel Costa', null, 'Sim']);
    e.addRow(['04/10/2026', 60, 'Canto', 10]);
    e.addRow(['05/10/2026', 10, 'Golo', 9]);
    const plano = ok<PlanoJogos>(planearJogos(await ler(wb), db, false));
    expect(plano.jogos).toHaveLength(2);
    expect(plano.competicoesNovas.map((x) => [x.nome, x.tipo])).toEqual([['Torneio de Verão', 'campeonato']]);
    expect(plano.avisos.join(' ')).toContain('não há jogo em 05/10/2026');
    const [j1, j2] = plano.jogos;
    expect(j1.jogo.local).toBe('fora');
    expect(j1.jogo.convocados).toHaveLength(14);
    expect(j1.jogo.indisponiveis).toHaveLength(1);
    expect(j1.jogo.eventos.map((x) => [x.minuto, x.tipo])).toEqual([
      [18, 'golo'], [33, 'golo_adversario'], [55, 'substituicao'], [92, 'golo'],
    ]);
    expect(j1.avisos.join(' ')).toContain('“Fulano” não existe');
    expect(j1.avisos.join(' ')).toContain('tipo “Canto” não reconhecido');
    expect(j2.avisos).toContain('Sem convocatória.');
  });

  it('erro claro quando não há folha de jogos', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Folha1').addRow(['Nome', 'Idade']);
    expect(planearJogos(await ler(wb), db, false)).toHaveProperty('erro');
  });
});
