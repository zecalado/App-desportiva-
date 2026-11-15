import { describe, expect, it } from 'vitest';
import { dadosExemplo } from './seed';
import { calcularAlteracoes, estavel, semAlteracoes } from './sincronizacao';
import { jogadorVazio } from './types';

const base = dadosExemplo();
const copia = () => structuredClone(base);

describe('cálculo de alterações para o servidor', () => {
  it('sem alterações não envia nada', () => {
    expect(semAlteracoes(calcularAlteracoes(base, copia(), true))).toBe(true);
  });
  it('a ordem das chaves não conta como alteração', () => {
    const d = copia();
    d.jogadores[0] = Object.fromEntries(Object.entries(d.jogadores[0]).reverse()) as typeof d.jogadores[0];
    expect(estavel(d.jogadores[0])).toBe(estavel(base.jogadores[0]));
    expect(semAlteracoes(calcularAlteracoes(base, d, true))).toBe(true);
  });
  it('alterar um jogador envia só esse jogador, sem dados clínicos', () => {
    const d = copia();
    d.jogadores[3].alcunha = 'Teste';
    const a = calcularAlteracoes(base, d, true);
    expect(a.gravar).toHaveLength(1);
    expect(a.gravar[0]).toMatchObject({ tabela: 'jogadores', id: d.jogadores[3].id });
    expect(a.gravar[0].dados).not.toHaveProperty('clinico');
    expect(a.clinicos).toEqual([]);
  });
  it('dados clínicos vão para a tabela própria e só se o perfil os puder ver', () => {
    const d = copia();
    d.jogadores[0].clinico.alergias = 'Pólen';
    const comAcesso = calcularAlteracoes(base, d, true);
    expect(comAcesso.gravar).toEqual([]);
    expect(comAcesso.clinicos).toEqual([{ jogadorId: d.jogadores[0].id, dados: d.jogadores[0].clinico }]);
    expect(semAlteracoes(calcularAlteracoes(base, d, false))).toBe(true);
  });
  it('jogador novo: registo clínico só se tiver dados', () => {
    const d = copia();
    d.jogadores.push(jogadorVazio());
    expect(calcularAlteracoes(base, d, true).clinicos).toEqual([]);
    const n = jogadorVazio();
    n.clinico.alergias = 'Marisco';
    d.jogadores.push(n);
    expect(calcularAlteracoes(base, d, true).clinicos.map((c) => c.jogadorId)).toEqual([n.id]);
  });
  it('apagar e criar jogos e treinos; definições', () => {
    const d = copia();
    const apagado = d.jogos.pop()!;
    d.treinos[0].presencas[d.jogadores[0].id] = 'falta';
    d.definicoes.clube = 'Outro';
    const a = calcularAlteracoes(base, d, true);
    expect(a.apagar).toEqual([{ tabela: 'jogos', id: apagado.id }]);
    expect(a.gravar.map((g) => g.tabela)).toEqual(['treinos']);
    expect(a.definicoes?.clube).toBe('Outro');
  });
  it('restaurar uma base vazia apaga tudo', () => {
    const a = calcularAlteracoes(base, { ...copia(), jogadores: [], jogos: [], treinos: [], competicoes: [] }, true);
    expect(a.apagar).toHaveLength(base.jogadores.length + base.jogos.length + base.treinos.length + base.competicoes.length);
  });
});
