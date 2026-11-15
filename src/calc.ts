// Regras de cálculo. Funções puras, sem dependências da interface,
// para poderem ser testadas (calc.test.ts) e reutilizadas no servidor.
import type { BaseDados, Competicao, Jogador, Jogo, Presenca } from './types';

// ---------- Jogador ----------

export function idade(dataNascimento: string, referencia: Date = new Date()): number | null {
  if (!dataNascimento) return null;
  const [a, m, d] = dataNascimento.split('-').map(Number);
  if (!a || !m || !d) return null;
  let anos = referencia.getFullYear() - a;
  const mesRef = referencia.getMonth() + 1;
  if (mesRef < m || (mesRef === m && referencia.getDate() < d)) anos--;
  return anos;
}

/** IMC em kg/m² (altura em cm). */
export function imc(peso: number | null, alturaCm: number | null): number | null {
  if (!peso || !alturaCm) return null;
  const m = alturaCm / 100;
  return Math.round((peso / (m * m)) * 10) / 10;
}

/** Jogadores ativos com número repetido. Devolve mapa número -> nomes. */
export function numerosRepetidos(jogadores: Jogador[]): Map<number, string[]> {
  const mapa = new Map<number, string[]>();
  for (const j of jogadores) {
    if (!j.ativo || j.numero == null) continue;
    mapa.set(j.numero, [...(mapa.get(j.numero) ?? []), j.nome]);
  }
  for (const [n, nomes] of mapa) if (nomes.length < 2) mapa.delete(n);
  return mapa;
}

// ---------- Jogo ----------

export interface Intervalo {
  entrada: number;
  saida: number | null; // null = ficou em campo até ao fim
  motivoSaida: 'substituicao' | 'vermelho' | 'segundo_amarelo' | null;
}

/** Minuto em que o jogador foi expulso por 2º amarelo, se aplicável. */
export function minutoSegundoAmarelo(jogo: Jogo, jogadorId: string): number | null {
  const amarelos = jogo.eventos
    .filter((e) => e.tipo === 'amarelo' && e.jogadorId === jogadorId)
    .map((e) => e.minuto)
    .sort((a, b) => a - b);
  return amarelos.length >= 2 ? amarelos[1] : null;
}

/** Período em que o jogador esteve em campo; null se não jogou. */
export function intervaloEmCampo(jogo: Jogo, jogadorId: string): Intervalo | null {
  const conv = jogo.convocados.find((c) => c.jogadorId === jogadorId);
  if (!conv) return null;

  let entrada: number | null = conv.titular ? 0 : null;
  if (!conv.titular) {
    const entradas = jogo.eventos
      .filter((e) => e.tipo === 'substituicao' && e.entraId === jogadorId)
      .map((e) => e.minuto);
    if (entradas.length) entrada = Math.min(...entradas);
  }
  if (entrada === null) return null;

  const saidas: { minuto: number; motivo: Intervalo['motivoSaida'] }[] = [];
  for (const e of jogo.eventos) {
    if (e.tipo === 'substituicao' && e.saiId === jogadorId && e.minuto >= entrada)
      saidas.push({ minuto: e.minuto, motivo: 'substituicao' });
    if (e.tipo === 'vermelho' && e.jogadorId === jogadorId && e.minuto >= entrada)
      saidas.push({ minuto: e.minuto, motivo: 'vermelho' });
  }
  const seg = minutoSegundoAmarelo(jogo, jogadorId);
  if (seg !== null && seg >= entrada) saidas.push({ minuto: seg, motivo: 'segundo_amarelo' });

  saidas.sort((a, b) => a.minuto - b.minuto);
  const primeira = saidas[0];
  return {
    entrada,
    saida: primeira ? primeira.minuto : null,
    motivoSaida: primeira ? primeira.motivo : null,
  };
}

export function minutosJogados(jogo: Jogo, jogadorId: string): number {
  const iv = intervaloEmCampo(jogo, jogadorId);
  if (!iv) return 0;
  const fim = Math.min(iv.saida ?? jogo.duracao, jogo.duracao);
  return Math.max(0, fim - Math.min(iv.entrada, jogo.duracao));
}

/**
 * Indica se o jogador estava em campo num dado minuto. Num minuto de
 * substituição conta quem sai (evita contar dois jogadores no mesmo lugar).
 */
export function emCampoNoMinuto(iv: Intervalo | null, minuto: number): boolean {
  if (!iv) return false;
  const depoisDaEntrada = iv.entrada === 0 ? minuto >= 0 : minuto > iv.entrada;
  const antesDaSaida = iv.saida === null || minuto <= iv.saida;
  return depoisDaEntrada && antesDaSaida;
}

export function resultado(jogo: Jogo): { marcados: number; sofridos: number } {
  return {
    marcados: jogo.eventos.filter((e) => e.tipo === 'golo').length,
    sofridos: jogo.eventos.filter((e) => e.tipo === 'golo_adversario').length,
  };
}

export type EstadoJogo =
  | 'titular'
  | 'suplente_utilizado'
  | 'suplente_nao_utilizado'
  | 'nao_convocado'
  | 'lesionado'
  | 'doente'
  | 'castigado'
  | 'outro';

export function estadoNoJogo(jogo: Jogo, jogadorId: string): EstadoJogo {
  const ind = jogo.indisponiveis.find((i) => i.jogadorId === jogadorId);
  if (ind) return ind.motivo;
  const conv = jogo.convocados.find((c) => c.jogadorId === jogadorId);
  if (!conv) return 'nao_convocado';
  if (conv.titular) return 'titular';
  return intervaloEmCampo(jogo, jogadorId) ? 'suplente_utilizado' : 'suplente_nao_utilizado';
}

/** Golos sofridos com o jogador em campo (relevante para guarda-redes). */
export function golosSofridosEmCampo(jogo: Jogo, jogadorId: string): number {
  const iv = intervaloEmCampo(jogo, jogadorId);
  return jogo.eventos.filter((e) => e.tipo === 'golo_adversario' && emCampoNoMinuto(iv, e.minuto))
    .length;
}

/** Avisos de coerência de um jogo (não bloqueiam a gravação). */
export function validarJogo(jogo: Jogo, jogadores: Jogador[]): string[] {
  const avisos: string[] = [];
  const nome = (id: string) => jogadores.find((j) => j.id === id)?.nome ?? 'jogador desconhecido';
  const convocado = (id: string) => jogo.convocados.find((c) => c.jogadorId === id);

  if (jogo.convocados.length) {
    const titulares = jogo.convocados.filter((c) => c.titular).length;
    if (titulares !== 11) avisos.push(`Há ${titulares} titulares (esperado: 11).`);
  }

  const porNumero = new Map<number, string[]>();
  for (const c of jogo.convocados) {
    if (c.numero == null) {
      avisos.push(`${nome(c.jogadorId)} não tem número neste jogo.`);
      continue;
    }
    porNumero.set(c.numero, [...(porNumero.get(c.numero) ?? []), nome(c.jogadorId)]);
  }
  for (const [n, nomes] of porNumero)
    if (nomes.length > 1) avisos.push(`Número ${n} repetido: ${nomes.join(', ')}.`);

  const entradas = new Map<string, number>();
  const ordenados = [...jogo.eventos].sort((a, b) => a.minuto - b.minuto);
  for (const e of ordenados) {
    const m = `${e.minuto}'`;
    if (e.minuto < 0 || e.minuto > jogo.duracao + 20)
      avisos.push(`Evento com minuto improvável (${m}).`);

    const envolvidos: string[] =
      e.tipo === 'golo'
        ? [e.jogadorId, ...(e.assistenciaId ? [e.assistenciaId] : [])]
        : e.tipo === 'substituicao'
          ? [e.saiId, e.entraId]
          : e.tipo === 'golo_adversario'
            ? []
            : [e.jogadorId];
    for (const id of envolvidos)
      if (!convocado(id)) avisos.push(`${m}: ${nome(id)} não está na convocatória.`);

    if (e.tipo === 'golo') {
      if (e.assistenciaId && e.assistenciaId === e.jogadorId)
        avisos.push(`${m}: o marcador não pode ser também o autor da assistência.`);
      for (const id of envolvidos) {
        if (convocado(id) && !emCampoNoMinuto(intervaloEmCampo(jogo, id), e.minuto))
          avisos.push(`${m}: ${nome(id)} não estava em campo nesse minuto.`);
      }
    }
    if (e.tipo === 'substituicao') {
      const ivSai = intervaloEmCampo(jogo, e.saiId);
      if (convocado(e.saiId) && (!ivSai || e.minuto < ivSai.entrada || (ivSai.saida !== null && ivSai.saida < e.minuto)))
        avisos.push(`${m}: ${nome(e.saiId)} sai mas não estava em campo.`);
      const cEntra = convocado(e.entraId);
      if (cEntra?.titular) avisos.push(`${m}: ${nome(e.entraId)} entra mas já era titular.`);
      if (entradas.has(e.entraId)) avisos.push(`${m}: ${nome(e.entraId)} entra mais do que uma vez.`);
      entradas.set(e.entraId, e.minuto);
    }
  }

  for (const c of jogo.convocados) {
    const amarelos = jogo.eventos.filter((e) => e.tipo === 'amarelo' && e.jogadorId === c.jogadorId);
    if (amarelos.length > 2) avisos.push(`${nome(c.jogadorId)} tem mais de 2 amarelos.`);
  }
  return avisos;
}

// ---------- Totais por jogador ----------

export interface Totais {
  treinosRegistados: number;
  treinosRealizados: number;
  pctTreinos: number | null;
  faltasTreino: number;
  treinosLesionado: number;
  treinosDoente: number;
  convocado: number;
  minutos: number;
  titular: number;
  jogoCompleto: number;
  suplenteUtilizado: number;
  suplenteNaoUtilizado: number;
  golos: number;
  assistencias: number;
  golosSofridos: number;
  amarelos: number;
  vermelhos: number; // vermelhos diretos
  expulsoesSegundoAmarelo: number;
}

export function jogosFiltrados(db: BaseDados, competicaoId: string | null): Jogo[] {
  return db.jogos
    .filter((j) => !competicaoId || j.competicaoId === competicaoId)
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function totaisJogador(db: BaseDados, jogador: Jogador, competicaoId: string | null): Totais {
  const contar = (p: Presenca) =>
    db.treinos.filter((t) => t.presencas[jogador.id] === p).length;
  const treinosRegistados = db.treinos.filter((t) => t.presencas[jogador.id]).length;
  const treinosRealizados = contar('presente');

  const t: Totais = {
    treinosRegistados,
    treinosRealizados,
    pctTreinos: treinosRegistados ? Math.round((treinosRealizados / treinosRegistados) * 100) : null,
    faltasTreino: contar('falta'),
    treinosLesionado: contar('lesionado'),
    treinosDoente: contar('doente'),
    convocado: 0,
    minutos: 0,
    titular: 0,
    jogoCompleto: 0,
    suplenteUtilizado: 0,
    suplenteNaoUtilizado: 0,
    golos: 0,
    assistencias: 0,
    golosSofridos: 0,
    amarelos: 0,
    vermelhos: 0,
    expulsoesSegundoAmarelo: 0,
  };

  for (const jogo of jogosFiltrados(db, competicaoId)) {
    const estado = estadoNoJogo(jogo, jogador.id);
    if (estado === 'titular' || estado === 'suplente_utilizado' || estado === 'suplente_nao_utilizado')
      t.convocado++;
    if (estado === 'titular') t.titular++;
    if (estado === 'suplente_utilizado') t.suplenteUtilizado++;
    if (estado === 'suplente_nao_utilizado') t.suplenteNaoUtilizado++;
    const min = minutosJogados(jogo, jogador.id);
    t.minutos += min;
    if (estado === 'titular' && min >= jogo.duracao) t.jogoCompleto++;
    for (const e of jogo.eventos) {
      if (e.tipo === 'golo' && e.jogadorId === jogador.id) t.golos++;
      if (e.tipo === 'golo' && e.assistenciaId === jogador.id) t.assistencias++;
      if (e.tipo === 'amarelo' && e.jogadorId === jogador.id) t.amarelos++;
      if (e.tipo === 'vermelho' && e.jogadorId === jogador.id) t.vermelhos++;
    }
    if (minutoSegundoAmarelo(jogo, jogador.id) !== null) t.expulsoesSegundoAmarelo++;
    if (jogador.posicao === 'Guarda-Redes') t.golosSofridos += golosSofridosEmCampo(jogo, jogador.id);
  }
  return t;
}

// ---------- Disciplina ----------

export interface AlertaDisciplina {
  amarelos: number;
  limite: number | null;
  faltam: number | null; // amarelos até atingir o próximo múltiplo do limite
  atingiuLimite: boolean; // o total é múltiplo exato do limite
}

export function alertaDisciplina(db: BaseDados, jogadorId: string, comp: Competicao): AlertaDisciplina {
  const amarelos = db.jogos
    .filter((j) => j.competicaoId === comp.id)
    .flatMap((j) => j.eventos)
    .filter((e) => e.tipo === 'amarelo' && e.jogadorId === jogadorId).length;
  const limite = comp.amarelosParaCastigo && comp.amarelosParaCastigo > 0 ? comp.amarelosParaCastigo : null;
  if (!limite) return { amarelos, limite: null, faltam: null, atingiuLimite: false };
  const resto = amarelos % limite;
  return {
    amarelos,
    limite,
    faltam: limite - resto,
    atingiuLimite: amarelos > 0 && resto === 0,
  };
}
