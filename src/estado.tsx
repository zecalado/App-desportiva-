import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { repositorioLocal } from './store';
import type { BaseDados } from './types';

interface Ctx {
  db: BaseDados;
  alterar: (f: (db: BaseDados) => BaseDados) => void;
  substituir: (db: BaseDados) => void;
}

const Contexto = createContext<Ctx | null>(null);

export function FornecedorDados({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BaseDados>(() => repositorioLocal.carregar());
  useEffect(() => {
    repositorioLocal.guardar(db);
  }, [db]);
  return (
    <Contexto.Provider value={{ db, alterar: (f) => setDb((d) => f(structuredClone(d))), substituir: setDb }}>
      {children}
    </Contexto.Provider>
  );
}

export function useDados(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useDados fora do FornecedorDados');
  return c;
}

export const formatarData = (iso: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const numOuNull = (v: string): number | null => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v));
