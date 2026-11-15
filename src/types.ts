// Modelo de dados. Cada facto é guardado uma só vez; totais, idades, minutos
// e acumulações de cartões são sempre calculados (ver calc.ts).
// Estas estruturas correspondem às tabelas previstas para a versão com servidor
// (ver docs/schema.sql).

export const POSICOES = [
  'Guarda-Redes',
  'Defesa-Central',
  'Defesa-Direito',
  'Defesa-Esquerdo',
  'Médio-Defensivo',
  'Médio-Centro',
  'Médio-Ofensivo',
  'Médio-Direito',
  'Médio-Esquerdo',
  'Extremo-Direito',
  'Extremo-Esquerdo',
  'Avançado',
  'Ponta-de-Lança',
] as const;
export type Posicao = (typeof POSICOES)[number];

export interface DadosClinicos {
  cirurgias: string;
  lesoesAnteriores: string;
  alergias: string;
  restricoesAlimentares: string;
}

export interface Jogador {
  id: string;
  numero: number | null;
  nome: string;
  alcunha: string;
  dataNascimento: string; // AAAA-MM-DD
  nacionalidade: string;
  posicao: Posicao;
  outrasPosicoes: Posicao[];
  telemovel: string;
  peso: number | null; // kg
  altura: number | null; // cm
  clubeAnterior: string;
  ativo: boolean;
  clinico: DadosClinicos;
}

export type TipoCompeticao = 'campeonato' | 'taca' | 'amigavel';

export interface Competicao {
  id: string;
  nome: string;
  tipo: TipoCompeticao;
  // Nº de amarelos que dá origem a castigo (alerta). Depende do regulamento
  // da associação — é configurável e pode ficar vazio.
  amarelosParaCastigo: number | null;
}

export interface Convocado {
  jogadorId: string;
  numero: number | null; // número usado neste jogo
  titular: boolean;
}

export type MotivoIndisponivel = 'lesionado' | 'doente' | 'castigado' | 'outro';

export interface Indisponivel {
  jogadorId: string;
  motivo: MotivoIndisponivel;
}

interface EventoBase {
  id: string;
  minuto: number;
}
export interface EventoGolo extends EventoBase {
  tipo: 'golo';
  jogadorId: string;
  assistenciaId: string | null;
  penalti: boolean;
}
export interface EventoGoloAdversario extends EventoBase {
  tipo: 'golo_adversario';
  descricao: string; // ex.: "Marcador X"
}
export interface EventoAmarelo extends EventoBase {
  tipo: 'amarelo';
  jogadorId: string;
}
export interface EventoVermelho extends EventoBase {
  tipo: 'vermelho';
  jogadorId: string;
}
export interface EventoSubstituicao extends EventoBase {
  tipo: 'substituicao';
  saiId: string;
  entraId: string;
}
export type Evento =
  | EventoGolo
  | EventoGoloAdversario
  | EventoAmarelo
  | EventoVermelho
  | EventoSubstituicao;
export type TipoEvento = Evento['tipo'];

export interface Jogo {
  id: string;
  competicaoId: string;
  jornada: string; // ex.: "1ª Jornada", "1ª Eliminatória"
  data: string; // AAAA-MM-DD
  adversario: string;
  local: 'casa' | 'fora';
  duracao: number; // minutos regulamentares (90)
  convocados: Convocado[];
  indisponiveis: Indisponivel[];
  eventos: Evento[];
  notas: string;
}

export type Presenca = 'presente' | 'falta' | 'lesionado' | 'doente';

export interface Treino {
  id: string;
  data: string;
  notas: string;
  presencas: Record<string, Presenca>; // jogadorId -> presença
}

export interface Definicoes {
  clube: string;
  epoca: string;
}

export interface BaseDados {
  versao: 1;
  definicoes: Definicoes;
  jogadores: Jogador[];
  competicoes: Competicao[];
  jogos: Jogo[];
  treinos: Treino[];
}

export function novoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* contexto não seguro: usa alternativa */
    }
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function baseDadosVazia(): BaseDados {
  return {
    versao: 1,
    definicoes: { clube: '', epoca: '' },
    jogadores: [],
    competicoes: [
      { id: novoId(), nome: 'Campeonato', tipo: 'campeonato', amarelosParaCastigo: null },
      { id: novoId(), nome: 'Taça', tipo: 'taca', amarelosParaCastigo: null },
    ],
    jogos: [],
    treinos: [],
  };
}

export function jogadorVazio(): Jogador {
  return {
    id: novoId(),
    numero: null,
    nome: '',
    alcunha: '',
    dataNascimento: '',
    nacionalidade: 'Portuguesa',
    posicao: 'Médio-Centro',
    outrasPosicoes: [],
    telemovel: '',
    peso: null,
    altura: null,
    clubeAnterior: '',
    ativo: true,
    clinico: { cirurgias: '', lesoesAnteriores: '', alergias: '', restricoesAlimentares: '' },
  };
}
