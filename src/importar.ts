// Importação do plantel a partir de Excel (.xlsx).
// Lógica pura (sem interface) para poder ser testada.
import type ExcelJS from 'exceljs';
import type { Jogador, Posicao } from './types';
import { POSICOES, jogadorVazio } from './types';

export type Valor = string | number | Date | null;

export type Campo =
  | 'numero'
  | 'nome'
  | 'alcunha'
  | 'dataNascimento'
  | 'nacionalidade'
  | 'posicao'
  | 'outrasPosicoes'
  | 'telemovel'
  | 'peso'
  | 'altura'
  | 'clubeAnterior'
  | 'cirurgias'
  | 'lesoesAnteriores'
  | 'alergias'
  | 'restricoesAlimentares';

export const NOMES_CAMPO: Record<Campo, string> = {
  numero: 'Nº',
  nome: 'Nome',
  alcunha: 'Alcunha',
  dataNascimento: 'Data de nascimento',
  nacionalidade: 'Nacionalidade',
  posicao: 'Posição',
  outrasPosicoes: 'Outras posições',
  telemovel: 'Telemóvel',
  peso: 'Peso (kg)',
  altura: 'Altura (cm)',
  clubeAnterior: 'Clube anterior',
  cirurgias: 'Cirurgias / dados clínicos',
  lesoesAnteriores: 'Lesões anteriores',
  alergias: 'Alergias',
  restricoesAlimentares: 'Restrições alimentares',
};

/** minúsculas, sem acentos, sem pontuação, espaços simples */
export function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Cabeçalhos reconhecidos (já normalizados). Inclui os das folhas do clube
// e os do Excel exportado pela aplicação.
const SINONIMOS: Record<Campo, string[]> = {
  numero: ['n', 'no', 'nº', 'n o', 'numero', 'num', 'camisola'],
  nome: ['nome', 'jogador', 'nome completo'],
  alcunha: ['alcunha', 'nome desportivo'],
  dataNascimento: ['data de nascimento', 'data nascimento', 'nascimento', 'dn', 'data nasc'],
  nacionalidade: ['nacionalidade'],
  posicao: ['posicao', 'posicao principal'],
  outrasPosicoes: ['outras posicoes', 'posicoes secundarias'],
  telemovel: ['movel', 'telemovel', 'telefone', 'contacto', 'tlm'],
  peso: ['peso', 'peso inicial', 'peso kg'],
  altura: ['altura', 'altura cm', 'altura m'],
  clubeAnterior: ['clube anterior', 'clube'],
  cirurgias: ['dados clinicos cirurgias', 'cirurgias dados clinicos', 'cirurgias', 'dados clinicos', 'dados clinicos cirugias'],
  lesoesAnteriores: ['lesoes anteriores', 'lesoes'],
  alergias: ['alergias'],
  restricoesAlimentares: ['restricoes alimentares'],
};

export function campoDoCabecalho(cab: string): Campo | null {
  const n = normalizar(cab);
  if (!n) return null;
  for (const [campo, sin] of Object.entries(SINONIMOS) as [Campo, string[]][])
    if (sin.includes(n)) return campo;
  return null;
}

// ---------- Leitura do ficheiro ----------

function textoCelula(v: ExcelJS.CellValue): Valor {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' || v instanceof Date) return v;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('').trim() || null;
    if ('text' in v && typeof v.text === 'string') return v.text.trim() || null;
    if ('result' in v) return textoCelula(v.result as ExcelJS.CellValue);
    if ('error' in v) return null;
  }
  return String(v);
}

export interface Folha {
  nome: string;
  linhas: Valor[][];
}

export async function lerExcel(dados: ArrayBuffer): Promise<Folha[]> {
  const { default: Excel } = await import('exceljs');
  const wb = new Excel.Workbook();
  await wb.xlsx.load(dados);
  return wb.worksheets.map((ws) => {
    const linhas: Valor[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const valores: Valor[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        valores[c - 1] = textoCelula(cell.value);
      });
      linhas[n - 1] = Array.from(valores, (v) => v ?? null);
    });
    return { nome: ws.name, linhas: Array.from(linhas, (l) => l ?? []) };
  });
}

/** Procura, nas primeiras 15 linhas, a que tem mais cabeçalhos reconhecidos (e inclui "Nome"). */
export function detetarCabecalho(linhas: Valor[][]): number {
  let melhor = -1;
  let pontos = 0;
  linhas.slice(0, 15).forEach((l, i) => {
    const campos = l.map((v) => (typeof v === 'string' ? campoDoCabecalho(v) : null));
    const p = campos.filter(Boolean).length;
    if (campos.includes('nome') && p > pontos) {
      melhor = i;
      pontos = p;
    }
  });
  return melhor;
}

export function mapearColunas(cabecalho: Valor[]): (Campo | null)[] {
  const usados = new Set<Campo>();
  return cabecalho.map((v) => {
    const c = typeof v === 'string' ? campoDoCabecalho(v) : null;
    if (!c || usados.has(c)) return null;
    usados.add(c);
    return c;
  });
}

// ---------- Conversão de valores ----------

const pad = (n: number) => String(n).padStart(2, '0');

export function converterData(v: Valor): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    // O ExcelJS devolve datas em UTC à meia-noite.
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return converterData(d);
  }
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validarData(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let a = +m[3];
    if (a < 100) a += a > 30 ? 1900 : 2000;
    return validarData(a, +m[2], +m[1]);
  }
  return null;
}

function validarData(a: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (a < 1940 || a > new Date().getFullYear() + 1) return null;
  return `${a}-${pad(m)}-${pad(d)}`;
}

export function converterNumero(v: Valor): number | null {
  if (v == null || v instanceof Date) return null;
  const n = typeof v === 'number' ? v : Number(v.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Converte texto livre ("Médio-Def.", "Extremo-Direit", "Ponta-Lança"…) numa posição da lista. */
export function converterPosicao(texto: string): Posicao | null {
  const n = normalizar(texto);
  if (!n) return null;
  const exata = POSICOES.find((p) => normalizar(p) === n);
  if (exata) return exata;
  const [a = '', b = ''] = n.split(' ');
  const lado = (s: string) =>
    s.startsWith('dir') || s === 'd' ? 'D' : s.startsWith('esq') || s === 'e' ? 'E' : s.startsWith('cent') || s === 'c' ? 'C' : s.startsWith('def') ? 'DEF' : s.startsWith('of') ? 'OF' : '';
  if (a.startsWith('guarda') || n === 'gr') return 'Guarda-Redes';
  if (a.startsWith('ponta') || n === 'pl') return 'Ponta-de-Lança';
  if (a.startsWith('avanc') || a.startsWith('ponta')) return 'Avançado';
  if (a.startsWith('def') || a === 'lateral') {
    const l = lado(b);
    return l === 'D' ? 'Defesa-Direito' : l === 'E' ? 'Defesa-Esquerdo' : l === 'C' ? 'Defesa-Central' : null;
  }
  if (a.startsWith('med')) {
    const l = lado(b);
    return l === 'D'
      ? 'Médio-Direito'
      : l === 'E'
        ? 'Médio-Esquerdo'
        : l === 'C'
          ? 'Médio-Centro'
          : l === 'DEF'
            ? 'Médio-Defensivo'
            : l === 'OF'
              ? 'Médio-Ofensivo'
              : null;
  }
  if (a.startsWith('ext')) {
    const l = lado(b);
    return l === 'D' ? 'Extremo-Direito' : l === 'E' ? 'Extremo-Esquerdo' : null;
  }
  return null;
}

// ---------- Plano de importação ----------

export interface LinhaPlano {
  linhaExcel: number; // 1-based, como no Excel
  acao: 'novo' | 'atualizar';
  jogador: Jogador;
  avisos: string[];
}

export function planearImportacao(
  linhas: Valor[][],
  idxCabecalho: number,
  mapa: (Campo | null)[],
  existentes: Jogador[],
): LinhaPlano[] {
  const plano: LinhaPlano[] = [];
  const vistos = new Set<string>();

  for (let i = idxCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i] ?? [];
    const val = (c: Campo): Valor => {
      const k = mapa.indexOf(c);
      return k >= 0 ? (linha[k] ?? null) : null;
    };
    const txt = (c: Campo): string | null => {
      const v = val(c);
      if (v == null) return null;
      return v instanceof Date ? converterData(v) : String(v).trim();
    };

    const nome = txt('nome');
    if (!nome) continue; // linhas vazias, legendas, totais
    const chave = normalizar(nome);
    const avisos: string[] = [];
    if (vistos.has(chave)) avisos.push('Nome repetido no ficheiro; esta linha substitui a anterior.');
    vistos.add(chave);

    const existente = existentes.find((j) => normalizar(j.nome) === chave);
    const j: Jogador = existente ? structuredClone(existente) : jogadorVazio();
    j.nome = nome;

    const num = converterNumero(val('numero'));
    if (val('numero') != null) {
      if (num != null && Number.isInteger(num) && num >= 0 && num < 1000) j.numero = num;
      else avisos.push(`Nº inválido: "${val('numero')}".`);
    }

    const dn = val('dataNascimento');
    if (dn != null) {
      const d = converterData(dn);
      if (d) j.dataNascimento = d;
      else avisos.push(`Data de nascimento não reconhecida: "${dn}".`);
    }

    const pos = txt('posicao');
    if (pos) {
      const p = converterPosicao(pos);
      if (p) j.posicao = p;
      else avisos.push(`Posição não reconhecida: "${pos}" (ficou ${j.posicao}).`);
    }
    const outras = txt('outrasPosicoes');
    if (outras) {
      const lista: Posicao[] = [];
      for (const parte of outras.split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean)) {
        const p = converterPosicao(parte);
        if (p) {
          if (p !== j.posicao && !lista.includes(p)) lista.push(p);
        } else avisos.push(`Outra posição não reconhecida: "${parte}".`);
      }
      j.outrasPosicoes = lista;
    }

    const peso = converterNumero(val('peso'));
    if (val('peso') != null) j.peso = peso && peso > 30 && peso < 200 ? peso : null;
    if (val('peso') != null && j.peso == null && peso !== 0) avisos.push(`Peso ignorado: "${val('peso')}".`);
    let alt = converterNumero(val('altura'));
    if (alt != null && alt > 1 && alt < 2.5) alt = Math.round(alt * 100); // metros → cm
    if (val('altura') != null) j.altura = alt && alt > 120 && alt < 230 ? alt : null;
    if (val('altura') != null && j.altura == null && alt !== 0) avisos.push(`Altura ignorada: "${val('altura')}".`);

    const textos: [Campo, (s: string) => void][] = [
      ['alcunha', (s) => (j.alcunha = s)],
      ['nacionalidade', (s) => (j.nacionalidade = s)],
      ['telemovel', (s) => (j.telemovel = s)],
      ['clubeAnterior', (s) => (j.clubeAnterior = s)],
      ['cirurgias', (s) => (j.clinico.cirurgias = s)],
      ['lesoesAnteriores', (s) => (j.clinico.lesoesAnteriores = s)],
      ['alergias', (s) => (j.clinico.alergias = s)],
      ['restricoesAlimentares', (s) => (j.clinico.restricoesAlimentares = s)],
    ];
    for (const [c, set] of textos) {
      const v = txt(c);
      if (v) set(c === 'telemovel' ? v.replace(/\.0$/, '') : v);
    }

    if (j.numero != null) {
      const outro = existentes.find((x) => x.ativo && x.numero === j.numero && normalizar(x.nome) !== chave);
      if (outro) avisos.push(`O nº ${j.numero} já pertence a ${outro.nome} no plantel.`);
    }

    // Se o nome se repete, a última linha prevalece
    const anterior = plano.findIndex((p) => normalizar(p.jogador.nome) === chave);
    const entrada: LinhaPlano = { linhaExcel: i + 1, acao: existente ? 'atualizar' : 'novo', jogador: j, avisos };
    if (anterior >= 0) plano[anterior] = entrada;
    else plano.push(entrada);
  }

  // Números repetidos dentro do próprio ficheiro
  const porNumero = new Map<number, string[]>();
  for (const p of plano)
    if (p.jogador.numero != null)
      porNumero.set(p.jogador.numero, [...(porNumero.get(p.jogador.numero) ?? []), p.jogador.nome]);
  for (const p of plano) {
    const nomes = p.jogador.numero != null ? porNumero.get(p.jogador.numero) : undefined;
    if (nomes && nomes.length > 1)
      p.avisos.push(`Nº ${p.jogador.numero} repetido no ficheiro (${nomes.filter((n) => n !== p.jogador.nome).join(', ')}).`);
  }
  return plano;
}

export function aplicarImportacao(jogadores: Jogador[], plano: LinhaPlano[]): Jogador[] {
  const resultado = [...jogadores];
  for (const p of plano) {
    const i = resultado.findIndex((j) => j.id === p.jogador.id);
    if (i >= 0) resultado[i] = p.jogador;
    else resultado.push(p.jogador);
  }
  return resultado;
}
