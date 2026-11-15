import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { construirExcel } from './excel';
import { converterData, converterPosicao, detetarCabecalho, lerExcel, mapearColunas, planearImportacao } from './importar';
import { dadosExemplo } from './seed';

async function paraBuffer(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const b = await wb.xlsx.writeBuffer();
  return b instanceof ArrayBuffer ? b : new Uint8Array(b as Uint8Array).buffer;
}

describe('conversões', () => {
  it('posições escritas de várias formas', () => {
    expect(converterPosicao('Médio-Def.')).toBe('Médio-Defensivo');
    expect(converterPosicao('Médio-Def')).toBe('Médio-Defensivo');
    expect(converterPosicao('Defesa-Esq')).toBe('Defesa-Esquerdo');
    expect(converterPosicao('Extremo-Direit')).toBe('Extremo-Direito');
    expect(converterPosicao('Médio-Ofensiv')).toBe('Médio-Ofensivo');
    expect(converterPosicao('Ponta-Lança')).toBe('Ponta-de-Lança');
    expect(converterPosicao('guarda redes')).toBe('Guarda-Redes');
    expect(converterPosicao('Avançado')).toBe('Avançado');
    expect(converterPosicao('Treinador')).toBeNull();
  });
  it('datas em vários formatos', () => {
    expect(converterData(new Date(Date.UTC(2000, 7, 5)))).toBe('2000-08-05');
    expect(converterData('05/08/2000')).toBe('2000-08-05');
    expect(converterData('5-8-00')).toBe('2000-08-05');
    expect(converterData('2000-08-05')).toBe('2000-08-05');
    expect(converterData(36743)).toBe('2000-08-05'); // número de série do Excel
    expect(converterData('31/02/2000')).toBeNull();
  });
});

describe('ficheiro no formato do "Registo Geral Plantel"', () => {
  async function ficheiroClube() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Folha1');
    ws.mergeCells('A1:P2');
    ws.getCell('A1').value = 'Registo Geral Plantel     Séniores 2026/2027';
    ws.getRow(3).values = ['Nº', 'Nome', 'Data de Nascimento', 'Alcunha', 'Idade', 'Nacionalidade', 'Posição', 'Outras Posições',
      'Móvel', 'Peso Inicial', 'Altura', 'IMC(%)', 'Clube Anterior', 'Dados Clinicos Cirugias', 'Lesões Anteriores', 'Alérgias', 'Restricões Alimentares'];
    ws.getRow(4).values = [99, 'Rui Fonseca', new Date(Date.UTC(2000, 2, 15)), null, 26, 'Portuguesa', 'Guarda-Redes', null, 99999999, '00', '00', 0, 'União Campestre'];
    ws.getRow(5).values = [8, 'Paulo Gomes', new Date(Date.UTC(2001, 4, 9)), null, 25, 'Portuguesa', 'Médio-Def', 'Médio-Centro', null, 74.5, 1.78, null, 'U.D.Ribeira', null, null, 'Pólen'];
    ws.getRow(6).values = [15, 'Tomás Ribeiro', '22/06/2007', null, 19, 'Portuguesa', 'Médio-Esq.', 'Extremo-Esq.'];
    ws.getRow(7).values = [15, 'Daniel Correia', null, null, null, 'França/Congo', 'Treinador'];
    ws.getRow(10).values = [null, null, 'Amarelo', 'Vermelho']; // legenda sem nome: ignorada
    return lerExcel(await paraBuffer(wb));
  }

  it('deteta o cabeçalho na linha 3 e mapeia as colunas', async () => {
    const [f] = await ficheiroClube();
    const cab = detetarCabecalho(f.linhas);
    expect(cab).toBe(2);
    const mapa = mapearColunas(f.linhas[cab]);
    expect(mapa).toEqual(['numero', 'nome', 'dataNascimento', 'alcunha', null, 'nacionalidade', 'posicao', 'outrasPosicoes',
      'telemovel', 'peso', 'altura', null, 'clubeAnterior', 'cirurgias', 'lesoesAnteriores', 'alergias', 'restricoesAlimentares']);
  });

  it('converte as linhas e assinala problemas', async () => {
    const [f] = await ficheiroClube();
    const cab = detetarCabecalho(f.linhas);
    const plano = planearImportacao(f.linhas, cab, mapearColunas(f.linhas[cab]), []);
    expect(plano.map((p) => p.jogador.nome)).toEqual(['Rui Fonseca', 'Paulo Gomes', 'Tomás Ribeiro', 'Daniel Correia']);
    const [gr, medio, esquerdo, semPosicao] = plano;
    expect(gr.jogador).toMatchObject({ numero: 99, dataNascimento: '2000-03-15', peso: null, altura: null, telemovel: '99999999' });
    expect(gr.avisos).toEqual([]);
    expect(medio.jogador).toMatchObject({ posicao: 'Médio-Defensivo', outrasPosicoes: ['Médio-Centro'], peso: 74.5, altura: 178 });
    expect(medio.jogador.clinico.alergias).toBe('Pólen');
    expect(esquerdo.jogador).toMatchObject({ dataNascimento: '2007-06-22', posicao: 'Médio-Esquerdo', outrasPosicoes: ['Extremo-Esquerdo'] });
    expect(esquerdo.avisos.join(' ')).toContain('Nº 15 repetido');
    expect(semPosicao.avisos.join(' ')).toContain('Posição não reconhecida');
  });
});

describe('ida e volta com o Excel exportado pela aplicação', () => {
  it('reimportar o export atualiza todos os jogadores sem alterações nem avisos', async () => {
    const db = dadosExemplo();
    const fs = await lerExcel(await paraBuffer(await construirExcel(db, true)));
    const f = fs.find((x) => x.nome === 'Registo Geral')!;
    const cab = detetarCabecalho(f.linhas);
    const plano = planearImportacao(f.linhas, cab, mapearColunas(f.linhas[cab]), db.jogadores);
    expect(plano).toHaveLength(db.jogadores.length);
    for (const p of plano) {
      expect(p.acao).toBe('atualizar');
      expect(p.avisos).toEqual([]);
      expect(p.jogador).toEqual(db.jogadores.find((j) => j.id === p.jogador.id));
    }
  });
});
