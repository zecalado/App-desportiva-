// Contrato do servidor (versão online). Implementações:
//  - servidorSupabase.ts — o servidor real
//  - servidorFalso.ts    — simulação em memória para testes da interface
import type { BaseDados, DadosClinicos, Definicoes } from './types';

export type Papel = 'admin' | 'tecnico' | 'medico';

export interface Perfil {
  userId: string;
  email: string;
  nome: string;
  papel: Papel | null;
  ativo: boolean;
}

export type TabelaDados = 'jogadores' | 'competicoes' | 'jogos' | 'treinos';

export interface Alteracoes {
  definicoes: Definicoes | null;
  gravar: { tabela: TabelaDados; id: string; dados: unknown }[];
  apagar: { tabela: TabelaDados; id: string }[];
  clinicos: { jogadorId: string; dados: DadosClinicos }[];
}

export interface EntradaRegisto {
  id: number;
  tabela: string;
  registoId: string;
  acao: string;
  userId: string | null;
  quando: string;
}

/** Como a aplicação foi aberta a partir de um link enviado por email. */
export type OrigemLink = 'convite' | 'recuperacao' | null;

export interface Servidor {
  /** Perfil do utilizador com sessão iniciada (null = sem sessão). */
  sessao(): Promise<Perfil | null>;
  entrar(email: string, password: string): Promise<void>;
  sair(): Promise<void>;
  pedirRecuperacao(email: string): Promise<void>;
  definirPassword(password: string): Promise<void>;
  atualizarNome(nome: string): Promise<void>;
  aoMudarSessao(cb: () => void): () => void;

  carregar(incluirClinicos: boolean): Promise<BaseDados>;
  guardar(a: Alteracoes): Promise<void>;

  perfis(): Promise<Perfil[]>;
  atualizarPerfil(userId: string, campos: Partial<Pick<Perfil, 'papel' | 'ativo' | 'nome'>>): Promise<void>;
  registo(limite: number): Promise<EntradaRegisto[]>;
}

export const NOMES_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  medico: 'Médico / Fisioterapia',
};

export const podeVerClinicos = (p: Papel | null | undefined) => p === 'admin' || p === 'medico';
