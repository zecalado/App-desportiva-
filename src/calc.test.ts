import { describe, expect, it } from 'vitest';
import {
  alertaDisciplina,
  estadoNoJogo,
  golosSofridosEmCampo,
  idade,
  imc,
  minutosJogados,
  resultado,
  totaisJogador,
  validarJogo,
} from './calc';
import { dadosExemplo } from './seed';
import type { Jogo } from './types';

const completo = dadosExemplo();
const jogo = completo.jogos.find((j) => j.jornada === '1ª Jornada')!;
// Base só com a 1ª Jornada e sem treinos, para testes isolados.
const db = { ...completo, jogos: [jogo], treinos: [] };
const porNome = (n: string) => db.jogadores.find((j) => j.nome === n)!;

describe('jogador', () => {
  it('calcula a idade considerando o dia de aniversário', () => {
    expect(idade('1995-11-21', new Date(2026, 10, 20))).toBe(30);
    expect(idade('1995-11-21', new Date(2026, 10, 21))).toBe(31);
    expect(idade('')).toBeNull();
  });
  it('calcula o IMC em kg/m²', () => {
    expect(imc(75, 180)).toBe(23.1);
    expect(imc(null, 180)).toBeNull();
  });
});

describe('jogo de exemplo (1ª Jornada)', () => {
  it('resultado 1-2', () => {
    expect(resultado(jogo)).toEqual({ marcados: 1, sofridos: 2 });
  });
  it('minutos: titular completo, substituído, suplente utilizado e não utilizado', () => {
    expect(minutosJogados(jogo, porNome('Samuel Costa').id)).toBe(90);
    expect(minutosJogados(jogo, porNome('Marco Esteves').id)).toBe(59);
    expect(minutosJogados(jogo, porNome('Rafael Cunha').id)).toBe(31);
    expect(minutosJogados(jogo, porNome('Filipe Marques').id)).toBe(15);
    expect(minutosJogados(jogo, porNome('Tiago Lopes').id)).toBe(0);
  });
  it('estados', () => {
    expect(estadoNoJogo(jogo, porNome('Rui Fonseca').id)).toBe('titular');
    expect(estadoNoJogo(jogo, porNome('Filipe Marques').id)).toBe('suplente_utilizado');
    expect(estadoNoJogo(jogo, porNome('Gonçalo Reis').id)).toBe('suplente_nao_utilizado');
    expect(estadoNoJogo(jogo, porNome('Bruno Teixeira').id)).toBe('nao_convocado');
  });
  it('golos sofridos pelo guarda-redes em campo', () => {
    expect(golosSofridosEmCampo(jogo, porNome('Rui Fonseca').id)).toBe(2);
    expect(golosSofridosEmCampo(jogo, porNome('Tiago Lopes').id)).toBe(0);
  });
  it('não gera avisos', () => {
    expect(validarJogo(jogo, db.jogadores)).toEqual([]);
  });
  it('totais', () => {
    const t = totaisJogador(db, porNome('Paulo Gomes'), null);
    expect(t).toMatchObject({ convocado: 1, titular: 1, jogoCompleto: 1, minutos: 90, amarelos: 1 });
  });
});

describe('regras de jogo', () => {
  const base = (): Jogo => structuredClone(jogo);

  it('2º amarelo expulsa e reduz os minutos', () => {
    const j = base();
    const id = porNome('Paulo Gomes').id;
    j.eventos.push({ id: 'x', tipo: 'amarelo', minuto: 70, jogadorId: id });
    expect(minutosJogados(j, id)).toBe(70);
  });
  it('troca de guarda-redes ao intervalo divide os golos sofridos', () => {
    const j = base();
    const gr1 = porNome('Rui Fonseca').id;
    const gr2 = porNome('Tiago Lopes').id;
    j.eventos.push({ id: 's', tipo: 'substituicao', minuto: 45, saiId: gr1, entraId: gr2 });
    expect(golosSofridosEmCampo(j, gr1)).toBe(1); // 40'
    expect(golosSofridosEmCampo(j, gr2)).toBe(1); // 68'
  });
  it('avisa sobre substituição incoerente e marcador fora de campo', () => {
    const j = base();
    j.eventos.push({
      id: 'g',
      tipo: 'golo',
      minuto: 80,
      jogadorId: porNome('Marco Esteves').id, // saiu aos 59'
      assistenciaId: null,
      penalti: false,
    });
    j.eventos.push({ id: 's', tipo: 'substituicao', minuto: 85, saiId: porNome('Gonçalo Reis').id, entraId: porNome('Tiago Lopes').id });
    const avisos = validarJogo(j, db.jogadores);
    expect(avisos.some((a) => a.includes('Marco Esteves não estava em campo'))).toBe(true);
    expect(avisos.some((a) => a.includes('Gonçalo Reis sai mas não estava em campo'))).toBe(true);
  });
});

describe('disciplina', () => {
  it('alerta quando atinge o limite configurado', () => {
    const d = structuredClone(db);
    const comp = { ...d.competicoes[0], amarelosParaCastigo: 2 };
    const id = porNome('Paulo Gomes').id;
    expect(alertaDisciplina(d, id, comp)).toMatchObject({ amarelos: 1, faltam: 1, atingiuLimite: false });
    d.jogos.push({ ...structuredClone(jogo), id: 'j2' });
    expect(alertaDisciplina(d, id, comp)).toMatchObject({ amarelos: 2, atingiuLimite: true });
  });
});

describe('dados de exemplo completos', () => {
  it('nenhum jogo gera avisos', () => {
    for (const j of completo.jogos) expect([j.jornada, validarJogo(j, completo.jogadores)]).toEqual([j.jornada, []]);
  });
  it('Paulo Gomes atinge 5 amarelos no campeonato', () => {
    const camp = completo.competicoes.find((c) => c.tipo === 'campeonato')!;
    expect(alertaDisciplina(completo, porNome('Paulo Gomes').id, camp)).toMatchObject({ amarelos: 5, atingiuLimite: true });
  });
  it('treinos: 3 por semana e lesão do Dário registada', () => {
    expect(completo.treinos.length).toBeGreaterThan(25);
    const t = totaisJogador(completo, porNome('Sérgio Faria'), null);
    expect(t.treinosLesionado).toBeGreaterThan(5);
  });
  it('troca de guarda-redes na Taça: 45 minutos cada', () => {
    const t = completo.competicoes.find((c) => c.tipo === 'taca')!;
    const g = completo.jogos.find((j) => j.competicaoId === t.id && j.jornada === '1ª Eliminatória')!;
    expect(minutosJogados(g, porNome('Rui Fonseca').id)).toBe(45);
    expect(minutosJogados(g, porNome('Tiago Lopes').id)).toBe(45);
  });
});
