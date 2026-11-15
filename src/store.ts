// Camada de armazenamento. Nesta versão os dados ficam no browser
// (localStorage). Na versão com servidor, só este ficheiro é substituído
// por uma implementação que lê/escreve na base de dados (Supabase).
import type { BaseDados } from './types';
import { baseDadosVazia } from './types';

const CHAVE = 'gestao-plantel:v1';

export interface Repositorio {
  carregar(): BaseDados;
  guardar(db: BaseDados): void;
}

export const repositorioLocal: Repositorio = {
  carregar() {
    const txt = localStorage.getItem(CHAVE);
    if (!txt) return baseDadosVazia();
    try {
      return validarBaseDados(JSON.parse(txt));
    } catch {
      console.error('Dados guardados inválidos; a começar com base vazia.');
      return baseDadosVazia();
    }
  },
  guardar(db) {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  },
};

/** Verificação mínima de estrutura (usada também ao importar cópias de segurança). */
export function validarBaseDados(x: unknown): BaseDados {
  const o = x as Partial<BaseDados>;
  if (
    !o ||
    o.versao !== 1 ||
    !Array.isArray(o.jogadores) ||
    !Array.isArray(o.competicoes) ||
    !Array.isArray(o.jogos) ||
    !Array.isArray(o.treinos) ||
    typeof o.definicoes !== 'object'
  )
    throw new Error('Ficheiro não é uma cópia de segurança válida desta aplicação.');
  return o as BaseDados;
}
