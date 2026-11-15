// Exportação para Excel: reproduz os registos que o clube usava, agora gerados
// automaticamente a partir dos dados. A folha "Registo Geral" usa os mesmos
// cabeçalhos que o importador reconhece (pode ser editada e importada de volta).
import type ExcelJS from 'exceljs';
import { estadoNoJogo, idade, imc, jogosFiltrados, resultado, totaisJogador } from './calc';
import type { EstadoJogo } from './calc';
import type { BaseDados, Jogador, Jogo } from './types';

export const SIGLA_ESTADO: Record<EstadoJogo, string> = {
  titular: 'T',
  suplente_utilizado: 'SU',
  suplente_nao_utilizado: 'SNU',
  nao_convocado: 'NC',
  lesionado: 'L',
  doente: 'D',
  castigado: 'C',
  outro: 'O',
};

export function rotuloJogo(db: BaseDados, j: Jogo): string {
  const comp = db.competicoes.find((c) => c.id === j.competicaoId)?.nome ?? '';
  const [a, m, d] = j.data.split('-');
  return `${comp} ${j.jornada} ${d}/${m}/${a?.slice(2)} ${j.adversario} (${j.local === 'casa' ? 'C' : 'F'})`;
}

function ordenarPlantel(db: BaseDados) {
  return [...db.jogadores].filter((j) => j.ativo).sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));
}

type Celula = string | number | Date | null | undefined;
type Linha = Record<string, Celula>;

/** Data AAAA-MM-DD → Date (UTC) para o Excel a reconhecer como data. */
const dataExcel = (iso: string): Date | null => {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

function adicionarFolha(wb: ExcelJS.Workbook, nome: string, cabecalhos: string[], linhas: Linha[]) {
  const ws = wb.addWorksheet(nome.replace(/[\\/?*[\]:]/g, '-').slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1, xSplit: Math.min(2, cabecalhos.length) }],
  });
  ws.columns = cabecalhos.map((h) => ({
    header: h,
    key: h,
    width: Math.max(8, Math.min(40, Math.max(h.length, ...linhas.map((l) => String(l[h] ?? '').length)) + 2)),
  }));
  ws.addRows(linhas.map((l) => Object.fromEntries(cabecalhos.map((h) => [h, l[h] ?? null]))));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EFE9' } };
  ws.eachRow((row) =>
    row.eachCell((c) => {
      if (c.value instanceof Date) c.numFmt = 'dd/mm/yyyy';
    }),
  );
  return ws;
}

export const CABECALHOS_PLANTEL = [
  'Nº',
  'Nome',
  'Alcunha',
  'Data de Nascimento',
  'Idade',
  'Nacionalidade',
  'Posição',
  'Outras Posições',
  'Telemóvel',
  'Peso (kg)',
  'Altura (cm)',
  'IMC (kg/m²)',
  'Clube Anterior',
];
export const CABECALHOS_JOGOS = ['Data', 'Competição', 'Jornada', 'Adversário', 'Local', 'Duração', 'Notas'];
export const CABECALHOS_CONVOCATORIAS = ['Data', 'Adversário', 'Jogador', 'Nº', 'Situação'];
export const CABECALHOS_EVENTOS = ['Data', 'Adversário', 'Minuto', 'Tipo', 'Jogador', 'Assistência / Entra', 'Penálti', 'Descrição'];
export const CABECALHOS_CLINICOS = ['Cirurgias / Dados clínicos', 'Lesões Anteriores', 'Alergias', 'Restrições Alimentares'];

function linhaPlantel(j: Jogador): Linha {
  return {
    Nº: j.numero,
    Nome: j.nome,
    Alcunha: j.alcunha,
    'Data de Nascimento': dataExcel(j.dataNascimento),
    Idade: idade(j.dataNascimento),
    Nacionalidade: j.nacionalidade,
    Posição: j.posicao,
    'Outras Posições': j.outrasPosicoes.join(', '),
    Telemóvel: j.telemovel,
    'Peso (kg)': j.peso,
    'Altura (cm)': j.altura,
    'IMC (kg/m²)': imc(j.peso, j.altura),
    'Clube Anterior': j.clubeAnterior,
    'Cirurgias / Dados clínicos': j.clinico.cirurgias,
    'Lesões Anteriores': j.clinico.lesoesAnteriores,
    Alergias: j.clinico.alergias,
    'Restrições Alimentares': j.clinico.restricoesAlimentares,
  };
}

async function novoLivro(): Promise<ExcelJS.Workbook> {
  const { default: Excel } = await import('exceljs');
  const wb = new Excel.Workbook();
  wb.creator = 'Gestão de Plantel';
  return wb;
}

async function descarregar(wb: ExcelJS.Workbook, nome: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function construirExcel(db: BaseDados, incluirClinicos: boolean): Promise<ExcelJS.Workbook> {
  const wb = await novoLivro();
  const plantel = ordenarPlantel(db);

  adicionarFolha(
    wb,
    'Registo Geral',
    incluirClinicos ? [...CABECALHOS_PLANTEL, ...CABECALHOS_CLINICOS] : CABECALHOS_PLANTEL,
    plantel.map(linhaPlantel),
  );

  const cabTotais = [
    'Nº', 'Nome', 'Treinos Realizados', '% Treinos', 'Faltas Treino', 'Treinos Lesionado', 'Treinos Doente',
    'Convocado', 'Minutos', 'Titular', 'Jogo Completo', 'Suplente Utilizado', 'Suplente Não Utilizado', 'Golos',
    'Assistências', 'Golos Sofridos (GR)', 'Amarelos', 'Vermelhos diretos', 'Expulsões 2º amarelo',
  ];
  const blocos: { nome: string; compId: string | null }[] = [
    { nome: 'Jogos - Total', compId: null },
    ...db.competicoes.map((c) => ({ nome: `Jogos - ${c.nome}`, compId: c.id })),
  ];
  for (const b of blocos) {
    adicionarFolha(
      wb,
      b.nome,
      cabTotais,
      plantel.map((j) => {
        const t = totaisJogador(db, j, b.compId);
        return {
          Nº: j.numero,
          Nome: j.nome,
          'Treinos Realizados': t.treinosRealizados,
          '% Treinos': t.pctTreinos,
          'Faltas Treino': t.faltasTreino,
          'Treinos Lesionado': t.treinosLesionado,
          'Treinos Doente': t.treinosDoente,
          Convocado: t.convocado,
          Minutos: t.minutos,
          Titular: t.titular,
          'Jogo Completo': t.jogoCompleto,
          'Suplente Utilizado': t.suplenteUtilizado,
          'Suplente Não Utilizado': t.suplenteNaoUtilizado,
          Golos: t.golos,
          Assistências: t.assistencias,
          'Golos Sofridos (GR)': j.posicao === 'Guarda-Redes' ? t.golosSofridos : null,
          Amarelos: t.amarelos,
          'Vermelhos diretos': t.vermelhos,
          'Expulsões 2º amarelo': t.expulsoesSegundoAmarelo,
        };
      }),
    );
  }

  const jogos = jogosFiltrados(db, null);
  const rotulos = jogos.map((g) => rotuloJogo(db, g));
  adicionarFolha(
    wb,
    'Disciplina',
    ['Nº', 'Nome', ...rotulos],
    plantel.map((j) => {
      const linha: Linha = { Nº: j.numero, Nome: j.nome };
      jogos.forEach((jogo, i) => {
        const am = jogo.eventos.filter((e) => e.tipo === 'amarelo' && e.jogadorId === j.id).length;
        const vm = jogo.eventos.some((e) => e.tipo === 'vermelho' && e.jogadorId === j.id);
        const marcas = [am ? 'A'.repeat(am) : '', vm ? 'V' : ''].filter(Boolean).join(' ');
        linha[rotulos[i]] = [SIGLA_ESTADO[estadoNoJogo(jogo, j.id)], marcas].filter(Boolean).join(' · ');
      });
      return linha;
    }),
  );

  adicionarFolha(
    wb,
    'Jogos',
    ['Data', 'Competição', 'Jornada', 'Adversário', 'Local', 'Duração', 'Golos Marcados', 'Golos Sofridos', 'Notas'],
    jogos.map((jogo) => {
      const r = resultado(jogo);
      return {
        Data: dataExcel(jogo.data),
        Competição: db.competicoes.find((c) => c.id === jogo.competicaoId)?.nome,
        Jornada: jogo.jornada,
        Adversário: jogo.adversario,
        Local: jogo.local === 'casa' ? 'Casa' : 'Fora',
        Duração: jogo.duracao,
        'Golos Marcados': r.marcados,
        'Golos Sofridos': r.sofridos,
        Notas: jogo.notas,
      };
    }),
  );

  const nome = (id: string | null) => (id ? (db.jogadores.find((j) => j.id === id)?.nome ?? '') : '');
  const SITUACAO: Record<string, string> = {
    lesionado: 'Lesionado', doente: 'Doente', castigado: 'Castigado', outro: 'Outro',
  };
  adicionarFolha(
    wb,
    'Convocatórias',
    CABECALHOS_CONVOCATORIAS,
    jogos.flatMap((jogo) => [
      ...[...jogo.convocados]
        .sort((a, b) => Number(b.titular) - Number(a.titular) || (a.numero ?? 999) - (b.numero ?? 999))
        .map((c) => ({
          Data: dataExcel(jogo.data),
          Adversário: jogo.adversario,
          Jogador: nome(c.jogadorId),
          Nº: c.numero,
          Situação: c.titular ? 'Titular' : 'Suplente',
        })),
      ...jogo.indisponiveis.map((i) => ({
        Data: dataExcel(jogo.data),
        Adversário: jogo.adversario,
        Jogador: nome(i.jogadorId),
        Nº: null,
        Situação: SITUACAO[i.motivo],
      })),
    ]),
  );

  const TIPO: Record<string, string> = {
    golo: 'Golo', golo_adversario: 'Golo adversário', amarelo: 'Amarelo', vermelho: 'Vermelho', substituicao: 'Substituição',
  };
  adicionarFolha(
    wb,
    'Eventos',
    CABECALHOS_EVENTOS,
    jogos.flatMap((jogo) =>
      [...jogo.eventos]
        .sort((a, b) => a.minuto - b.minuto)
        .map((e) => ({
          Data: dataExcel(jogo.data),
          Adversário: jogo.adversario,
          Minuto: e.minuto,
          Tipo: TIPO[e.tipo],
          Jogador: e.tipo === 'golo_adversario' ? '' : e.tipo === 'substituicao' ? nome(e.saiId) : nome(e.jogadorId),
          'Assistência / Entra': e.tipo === 'golo' ? nome(e.assistenciaId) : e.tipo === 'substituicao' ? nome(e.entraId) : '',
          Penálti: e.tipo === 'golo' && e.penalti ? 'Sim' : '',
          Descrição: e.tipo === 'golo_adversario' ? e.descricao : '',
        })),
    ),
  );

  // Treinos em grelha: jogador × data (P/F/L/D)
  const treinos = [...db.treinos].sort((a, b) => a.data.localeCompare(b.data));
  const SIGLA_PRESENCA: Record<string, string> = { presente: 'P', falta: 'F', lesionado: 'L', doente: 'D' };
  const colunasTreino = treinos.map((t, i) => {
    const [a, m, d] = t.data.split('-');
    const repetida = treinos.findIndex((x) => x.data === t.data) !== i;
    return `${d}/${m}/${a}${repetida ? ` (${i + 1})` : ''}`;
  });
  const wsT = adicionarFolha(
    wb,
    'Treinos',
    ['Nº', 'Nome', ...colunasTreino],
    plantel.map((j) => {
      const l: Linha = { Nº: j.numero, Nome: j.nome };
      treinos.forEach((t, i) => (l[colunasTreino[i]] = SIGLA_PRESENCA[t.presencas[j.id]] ?? ''));
      return l;
    }),
  );
  colunasTreino.forEach((_, i) => (wsT.getColumn(i + 3).width = 11));

  adicionarFolha(wb, 'Legenda', ['Sigla', 'Significado (folha Disciplina)'], [
    ['T', 'Titular'],
    ['SU', 'Suplente utilizado'],
    ['SNU', 'Suplente não utilizado'],
    ['NC', 'Não convocado'],
    ['L / D / C / O', 'Lesionado / Doente / Castigado / Outro motivo'],
    ['A', 'Cartão amarelo (AA = dois amarelos)'],
    ['V', 'Cartão vermelho direto'],
  ].map(([a, b]) => ({ Sigla: a, 'Significado (folha Disciplina)': b })));

  return wb;
}

export async function exportarExcel(db: BaseDados, incluirClinicos: boolean) {
  const wb = await construirExcel(db, incluirClinicos);
  await descarregar(wb, `Registos_${(db.definicoes.epoca || 'epoca').replace(/\//g, '-')}.xlsx`);
}

/** Modelo vazio para preencher o plantel e importar. */
export async function descarregarModelo() {
  const wb = await novoLivro();
  const ws = adicionarFolha(
    wb,
    'Plantel',
    [...CABECALHOS_PLANTEL.filter((h) => h !== 'Idade' && !h.startsWith('IMC')), ...CABECALHOS_CLINICOS],
    [],
  );
  ws.getColumn('Data de Nascimento').numFmt = 'dd/mm/yyyy';
  ws.getCell('B2').note = 'Uma linha por jogador. Só o Nome é obrigatório. Posições: ex. Guarda-Redes, Defesa-Central, Médio-Centro, Extremo-Direito, Avançado.';
  await descarregar(wb, 'Modelo_Plantel.xlsx');
}

function folhaInstrucoes(wb: ExcelJS.Workbook, linhas: string[]) {
  const ws = wb.addWorksheet('Instruções');
  ws.getColumn(1).width = 120;
  linhas.forEach((t, i) => {
    const c = ws.getCell(i + 1, 1);
    c.value = t;
    c.alignment = { wrapText: true, vertical: 'top' };
    if (i === 0) c.font = { bold: true, size: 13 };
  });
}

/** Modelo para importar jogos: folhas Jogos, Convocatórias e Eventos. */
export async function descarregarModeloJogos() {
  const wb = await novoLivro();
  for (const [nome, cab] of [
    ['Jogos', CABECALHOS_JOGOS],
    ['Convocatórias', CABECALHOS_CONVOCATORIAS],
    ['Eventos', CABECALHOS_EVENTOS],
  ] as const) {
    const ws = adicionarFolha(wb, nome, [...cab], []);
    ws.getColumn('Data').numFmt = 'dd/mm/yyyy';
  }
  folhaInstrucoes(wb, [
    'Como preencher',
    'As três folhas ligam-se pela DATA do jogo (um jogo por dia). A coluna Adversário nas folhas Convocatórias e Eventos é só para facilitar a leitura.',
    'Jogos: uma linha por jogo. Competição = nome tal como está na aplicação (ex.: Campeonato, Taça); se não existir, é criada. Local = Casa ou Fora. Duração vazia = 90.',
    'Convocatórias: uma linha por jogador e por jogo. Jogador = nome (ou nº do plantel). Situação = Titular, Suplente, Lesionado, Doente, Castigado ou Outro. Nº = número usado nesse jogo (vazio = número do plantel). Quem não aparece conta como não convocado.',
    'Eventos: uma linha por evento. Minuto = 40, 40\' ou 90+3. Tipo = Golo, Golo adversário, Amarelo, Vermelho ou Substituição.',
    '   • Golo: Jogador = marcador; Assistência / Entra = autor da assistência (opcional); Penálti = Sim (opcional).',
    '   • Substituição: Jogador = quem SAI; Assistência / Entra = quem ENTRA.',
    '   • Golo adversário: Descrição = marcador (opcional).',
    '   • Um 2º amarelo no mesmo jogo é tratado como expulsão; não é preciso registar o vermelho.',
    'Nos eventos, o jogador pode ser indicado pelo nome ou pelo número usado nesse jogo.',
  ]);
  await descarregar(wb, 'Modelo_Jogos.xlsx');
}

/** Modelo para importar presenças em treinos (plantel já preenchido). */
export async function descarregarModeloTreinos(db: BaseDados) {
  const wb = await novoLivro();
  const ws = adicionarFolha(
    wb,
    'Treinos',
    ['Nº', 'Nome'],
    ordenarPlantel(db).map((j) => ({ Nº: j.numero, Nome: j.nome })),
  );
  ws.getRow(1).getCell(3).value = 'dd/mm/aaaa';
  ws.getRow(1).getCell(3).font = { bold: true, color: { argb: 'FF98A2B3' } };
  folhaInstrucoes(wb, [
    'Como preencher',
    'Na linha 1, a partir da coluna C, escreva a data de cada treino (uma coluna por treino; substitua “dd/mm/aaaa”).',
    'Em cada célula: P = presente, F = falta, L = lesionado, D = doente. Célula vazia = sem registo (não conta para a percentagem).',
    'Os jogadores são reconhecidos pelo nome (ou pelo nº, se o nome estiver vazio). Linhas de jogadores que não existam no plantel são ignoradas e assinaladas.',
    'Se já existir um treino nessa data, as presenças do ficheiro são juntas às existentes (substituindo as dos jogadores indicados).',
  ]);
  await descarregar(wb, 'Modelo_Treinos.xlsx');
}
