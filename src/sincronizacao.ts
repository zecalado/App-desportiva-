// Calcula o que mudou entre duas versões dos dados, registo a registo,
// para enviar ao servidor apenas o necessário.
import type { Alteracoes, TabelaDados } from './servidor';
import type { BaseDados, Jogador } from './types';

/** JSON com chaves ordenadas: comparação independente da ordem das chaves. */
export function estavel(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
  const o = v as Record<string, unknown>;
  return (
    '{' +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + estavel(o[k]))
      .join(',') +
    '}'
  );
}

/** Jogador sem os dados clínicos (estes vão para uma tabela à parte). */
export function semClinicos(j: Jogador): Omit<Jogador, 'clinico'> {
  const { clinico: _c, ...resto } = j;
  return resto;
}

export function calcularAlteracoes(antes: BaseDados, depois: BaseDados, incluirClinicos: boolean): Alteracoes {
  const a: Alteracoes = { definicoes: null, gravar: [], apagar: [], clinicos: [] };
  if (estavel(antes.definicoes) !== estavel(depois.definicoes)) a.definicoes = depois.definicoes;

  const comparar = <T extends { id: string }>(tabela: TabelaDados, x: T[], y: T[], forma: (v: T) => unknown) => {
    const anteriores = new Map(x.map((v) => [v.id, estavel(forma(v))]));
    const atuais = new Set<string>();
    for (const v of y) {
      atuais.add(v.id);
      const f = forma(v);
      if (anteriores.get(v.id) !== estavel(f)) a.gravar.push({ tabela, id: v.id, dados: f });
    }
    for (const id of anteriores.keys()) if (!atuais.has(id)) a.apagar.push({ tabela, id });
  };

  comparar('competicoes', antes.competicoes, depois.competicoes, (v) => v);
  comparar('jogadores', antes.jogadores, depois.jogadores, semClinicos);
  comparar('jogos', antes.jogos, depois.jogos, (v) => v);
  comparar('treinos', antes.treinos, depois.treinos, (v) => v);

  if (incluirClinicos) {
    const anteriores = new Map(antes.jogadores.map((j) => [j.id, estavel(j.clinico)]));
    for (const j of depois.jogadores)
      if (anteriores.get(j.id) !== estavel(j.clinico)) {
        // Um jogador novo sem dados clínicos não precisa de registo clínico
        const vazio = Object.values(j.clinico).every((t) => !t);
        if (anteriores.has(j.id) || !vazio) a.clinicos.push({ jogadorId: j.id, dados: j.clinico });
      }
  }
  return a;
}

export const semAlteracoes = (a: Alteracoes) =>
  !a.definicoes && !a.gravar.length && !a.apagar.length && !a.clinicos.length;

export const contarAlteracoes = (a: Alteracoes) =>
  (a.definicoes ? 1 : 0) + a.gravar.length + a.apagar.length + a.clinicos.length;
