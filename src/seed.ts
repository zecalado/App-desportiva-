// Dados de exemplo FICTÍCIOS (jogadores, clubes, jogos e treinos inventados).
// Servem apenas para experimentar a aplicação.
import type { BaseDados, Evento, Jogador, Jogo, MotivoIndisponivel, Posicao, Presenca, Treino } from './types';
import { jogadorVazio, novoId } from './types';

type Linha = [number, string, string, string, Posicao, Posicao[], string];

// Correções face às folhas originais: posições normalizadas; Daniel Correia
// com o nº 25 (o 15 estava repetido com o Tomás Ribeiro).
const PLANTEL: Linha[] = [
  [99, 'Rui Fonseca', '2000-11-06', 'Portuguesa', 'Guarda-Redes', [], 'União Campestre'],
  [1, 'Tiago Lopes', '2003-12-07', 'Portuguesa', 'Guarda-Redes', [], 'U.D. Ribeira'],
  [23, 'André Matos', '2001-03-04', 'Portuguesa', 'Defesa-Central', [], 'S.C. Planície'],
  [3, 'Bruno Teixeira', '2000-10-30', 'Brasileira', 'Defesa-Central', ['Médio-Defensivo'], 'C.F. Vale Verde'],
  [4, 'Hugo Carvalho', '1993-08-18', 'Portuguesa', 'Defesa-Central', ['Médio-Defensivo'], 'C.F. Vale Verde'],
  [16, 'Nuno Pires', '2007-05-14', 'Portuguesa', 'Defesa-Central', ['Médio-Defensivo'], 'A.D. Serra Alta'],
  [2, 'Ricardo Sousa', '2002-01-01', 'Portuguesa', 'Defesa-Direito', [], 'C.F. Vale Verde'],
  [22, 'Gonçalo Reis', '2007-09-01', 'Portuguesa', 'Defesa-Direito', ['Defesa-Esquerdo'], 'Juventude Serrana'],
  [20, 'Diogo Antunes', '2001-12-14', 'Cabo-Verdiana', 'Defesa-Direito', ['Extremo-Direito'], 'U.D. Ribeira'],
  [14, 'Marco Esteves', '2002-02-12', 'Colombiana', 'Defesa-Esquerdo', ['Defesa-Central'], 'U.D. Ribeira'],
  [8, 'Paulo Gomes', '2001-11-30', 'Portuguesa', 'Médio-Defensivo', ['Médio-Centro'], 'U.D. Ribeira'],
  [28, 'Sérgio Faria', '1996-04-12', 'Portuguesa', 'Médio-Direito', ['Médio-Esquerdo'], 'C.F. Vale Verde'],
  [5, 'Vasco Nunes', '1999-06-12', 'Angolana', 'Médio-Centro', ['Médio-Defensivo'], 'L.C. Costa Sul'],
  [88, 'Rafael Cunha', '2006-12-25', 'Portuguesa', 'Médio-Centro', [], 'Lusitânia FC'],
  [10, 'Luís Moreira', '1996-08-30', 'Portuguesa', 'Médio-Ofensivo', ['Médio-Centro'], 'C.F. Vale Verde'],
  [15, 'Tomás Ribeiro', '2008-02-25', 'Portuguesa', 'Médio-Esquerdo', ['Extremo-Esquerdo'], 'A.D. Serra Alta'],
  [13, 'Carlos Mendes', '2001-10-07', 'Brasileira', 'Extremo-Direito', ['Extremo-Esquerdo'], 'FK Exemplo'],
  [25, 'Daniel Correia', '2004-02-21', 'França/Congo', 'Médio-Ofensivo', ['Médio-Centro'], 'AS Exemple B'],
  [7, 'Fábio Rocha', '2006-07-29', 'Guineense', 'Extremo-Esquerdo', ['Extremo-Direito'], 'Atlético da Vila'],
  [17, 'Pedro Vieira', '2006-12-02', 'Guineense', 'Médio-Ofensivo', ['Médio-Centro'], 'Atlético da Vila'],
  [11, 'Filipe Marques', '2003-01-26', 'Guineense', 'Avançado', ['Extremo-Direito'], 'Renascente do Campo'],
  [21, 'Jorge Pinto', '1996-03-11', 'Portuguesa', 'Avançado', ['Ponta-de-Lança'], 'C.F. Vale Verde'],
  [9, 'Samuel Costa', '2002-09-12', 'Nigeriana', 'Avançado', [], 'C.F. Vale Verde'],
];

export function dadosExemplo(): BaseDados {
  const jogadores: Jogador[] = PLANTEL.map(([numero, nome, dn, nac, pos, outras, clube]) => ({
    ...jogadorVazio(),
    numero,
    nome,
    dataNascimento: dn,
    nacionalidade: nac,
    posicao: pos,
    outrasPosicoes: outras,
    clubeAnterior: clube,
  }));
  const id = (n: number) => {
    const j = jogadores.find((x) => x.numero === n);
    if (!j) throw new Error(`Número ${n} inexistente nos dados de exemplo`);
    return j.id;
  };

  // Valor de exemplo — confirmar no regulamento da associação.
  const campeonato = { id: novoId(), nome: 'Campeonato', tipo: 'campeonato' as const, amarelosParaCastigo: 5 };
  const taca = { id: novoId(), nome: 'Taça', tipo: 'taca' as const, amarelosParaCastigo: null };

  type SemId<T> = T extends Evento ? Omit<T, 'id'> : never;
  const ev = (e: SemId<Evento>) => ({ ...e, id: novoId() }) as Evento;

  // Atalhos para descrever eventos com números de camisola.
  type Ev = SemId<Evento>;
  const G = (minuto: number, n: number, assist?: number, penalti = false): Ev => ({
    tipo: 'golo', minuto, jogadorId: id(n), assistenciaId: assist ? id(assist) : null, penalti,
  });
  const GA = (minuto: number, descricao = ''): Ev => ({ tipo: 'golo_adversario', minuto, descricao });
  const Y = (minuto: number, n: number): Ev => ({ tipo: 'amarelo', minuto, jogadorId: id(n) });
  const R = (minuto: number, n: number): Ev => ({ tipo: 'vermelho', minuto, jogadorId: id(n) });
  const S = (minuto: number, sai: number, entra: number): Ev => ({ tipo: 'substituicao', minuto, saiId: id(sai), entraId: id(entra) });

  const FICTICIO = 'Exemplo fictício: resultado e eventos inventados para testar a aplicação.';
  const jogo = (o: {
    comp: typeof campeonato | typeof taca;
    jornada: string;
    data: string;
    adversario: string;
    local: 'casa' | 'fora';
    t: number[];
    s: number[];
    ind?: [number, MotivoIndisponivel][];
    ev: Ev[];
    notas?: string;
  }): Jogo => ({
    id: novoId(),
    competicaoId: o.comp.id,
    jornada: o.jornada,
    data: o.data,
    adversario: o.adversario,
    local: o.local,
    duracao: 90,
    convocados: [
      ...o.t.map((n) => ({ jogadorId: id(n), numero: n, titular: true })),
      ...o.s.map((n) => ({ jogadorId: id(n), numero: n, titular: false })),
    ],
    indisponiveis: (o.ind ?? []).map(([n, motivo]) => ({ jogadorId: id(n), motivo })),
    eventos: o.ev.map(ev),
    notas: o.notas ?? FICTICIO,
  });

  const jogos: Jogo[] = [
    jogo({
      comp: taca, jornada: '1ª Eliminatória', data: '2026-09-20', adversario: 'A.D. Ribeirinha', local: 'casa',
      t: [99, 20, 2, 4, 22, 8, 5, 10, 17, 11, 21], s: [1, 16, 88, 9, 14, 25],
      ev: [G(23, 11, 10), S(45, 99, 1), G(52, 21, 20), S(60, 21, 9), Y(64, 2), S(70, 17, 25), G(77, 9, 25), S(80, 22, 14)],
      notas: 'Exemplo fictício: inclui troca de guarda-redes ao intervalo.',
    }),
    jogo({
      comp: campeonato, jornada: '1ª Jornada', data: '2026-09-27', adversario: 'Estrela da Planície', local: 'casa',
      t: [99, 2, 4, 14, 20, 8, 5, 17, 10, 21, 9], s: [1, 11, 28, 88, 22, 16, 25],
      ev: [G(14, 9), Y(39, 14), GA(40, ''), Y(55, 8), S(59, 14, 88), S(59, 17, 25), GA(68, ''), S(75, 2, 11), Y(85, 99)],
      notas: FICTICIO,
    }),
    jogo({
      comp: campeonato, jornada: '2ª Jornada', data: '2026-10-04', adversario: 'Juventude Serrana B', local: 'fora',
      t: [99, 20, 23, 4, 14, 8, 5, 10, 13, 21, 9], s: [1, 22, 88, 25, 11, 7, 15], ind: [[28, 'lesionado']],
      ev: [G(18, 9, 13), Y(27, 23), GA(33), Y(49, 20), S(55, 13, 7), G(61, 7, 10), S(70, 21, 11), Y(73, 8), S(80, 5, 88), GA(84)],
      notas: FICTICIO,
    }),
    jogo({
      comp: campeonato, jornada: '3ª Jornada', data: '2026-10-11', adversario: 'S.C. Vila Nova', local: 'casa',
      t: [99, 2, 23, 4, 14, 8, 5, 10, 17, 11, 9], s: [1, 20, 22, 88, 25, 21, 13], ind: [[28, 'lesionado']],
      ev: [G(12, 11, 17), GA(40), Y(58, 8), S(60, 11, 21), Y(66, 14), S(68, 17, 25), G(71, 21, 9), S(82, 2, 20), Y(89, 4)],
    }),
    jogo({
      comp: taca, jornada: '2ª Eliminatória', data: '2026-10-18', adversario: 'Atlético Alvorada', local: 'fora',
      t: [1, 20, 16, 4, 22, 88, 5, 15, 7, 13, 21], s: [99, 2, 8, 10, 9, 11, 17], ind: [[28, 'lesionado']],
      ev: [GA(25), Y(44, 16), S(60, 21, 9), G(66, 9, 15), S(70, 15, 10), S(75, 7, 11), R(80, 4), GA(88)],
    }),
    jogo({
      comp: campeonato, jornada: '4ª Jornada', data: '2026-10-25', adversario: 'União Campestre', local: 'fora',
      t: [99, 2, 23, 3, 14, 8, 5, 10, 17, 11, 9], s: [1, 20, 16, 28, 25, 21, 13], ind: [[4, 'castigado']],
      ev: [Y(35, 3), S(46, 2, 20), S(65, 17, 28), S(72, 11, 21), G(77, 9, undefined, true), Y(81, 8)],
    }),
    jogo({
      comp: campeonato, jornada: '5ª Jornada', data: '2026-11-01', adversario: 'Adversário Exemplo A', local: 'casa',
      t: [99, 20, 23, 4, 14, 8, 5, 10, 13, 21, 9], s: [1, 2, 22, 88, 17, 11, 7],
      ev: [Y(30, 14), Y(62, 14), S(64, 13, 22), S(75, 21, 11), S(85, 10, 88)],
    }),
    jogo({
      comp: campeonato, jornada: '6ª Jornada', data: '2026-11-08', adversario: 'Adversário Exemplo B', local: 'fora',
      t: [99, 2, 23, 4, 22, 8, 5, 10, 17, 11, 9], s: [1, 20, 16, 28, 25, 21, 7],
      ind: [[14, 'castigado'], [13, 'lesionado']],
      ev: [G(8, 9, 11), GA(30), Y(40, 5), Y(52, 8), G(55, 11, 17), S(60, 17, 25), S(70, 9, 21), S(80, 2, 20), G(88, 21, 25)],
    }),
  ];

  return {
    versao: 1,
    definicoes: { clube: 'G.D. Exemplo', epoca: '2026/2027' },
    jogadores,
    competicoes: [campeonato, taca],
    jogos,
    treinos: treinosExemplo(jogadores, id),
  };
}

// Gerador pseudoaleatório com semente fixa: o exemplo é sempre igual.
function mulberry32(semente: number) {
  return () => {
    semente |= 0;
    semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Treinos fictícios: 3 por semana (terça, quarta e sexta) de 1/9 a 13/11. */
function treinosExemplo(jogadores: Jogador[], id: (n: number) => string): Treino[] {
  const rnd = mulberry32(2026);
  // Períodos de lesão coerentes com os jogos de exemplo.
  const lesoes: [number, string, string][] = [
    [28, '2026-09-29', '2026-10-20'], // Sérgio Faria
    [13, '2026-11-03', '2026-11-13'], // Carlos Mendes
  ];
  const treinos: Treino[] = [];
  const d = new Date(2026, 8, 1);
  const fim = new Date(2026, 10, 13);
  while (d <= fim) {
    if ([2, 3, 5].includes(d.getDay())) {
      const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const presencas: Record<string, Presenca> = {};
      for (const j of jogadores) {
        const lesionado = lesoes.some(([n, ini, f]) => id(n) === j.id && data >= ini && data <= f);
        const r = rnd();
        presencas[j.id] = lesionado ? 'lesionado' : r < 0.06 ? 'falta' : r < 0.08 ? 'doente' : 'presente';
      }
      treinos.push({ id: novoId(), data, notas: '', presencas });
    }
    d.setDate(d.getDate() + 1);
  }
  return treinos;
}
