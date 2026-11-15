import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ERRO_LINK, MODO, ORIGEM_LINK, obterServidor } from './config';
import type { Modo } from './config';
import { DefinirPassword, Entrar, SemAcesso } from './paginas/Entrar';
import type { Perfil, Servidor } from './servidor';
import { podeVerClinicos } from './servidor';
import { calcularAlteracoes, contarAlteracoes, semAlteracoes } from './sincronizacao';
import { repositorioLocal } from './store';
import type { BaseDados } from './types';
import { baseDadosVazia } from './types';

export type EstadoSync = 'guardado' | 'pendente' | 'a_guardar' | 'erro';

interface Ctx {
  db: BaseDados;
  alterar: (f: (db: BaseDados) => BaseDados) => void;
  substituir: (db: BaseDados) => void;
  modo: Modo;
  perfil: Perfil | null; // null no modo local
  verClinicos: boolean;
  eAdmin: boolean;
  estadoSync: EstadoSync;
  erroSync: string;
  pendentes: number;
  servidor: Servidor | null;
  sair: () => void;
  recarregar: () => Promise<void>;
}

const Contexto = createContext<Ctx | null>(null);

export function useDados(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useDados fora do FornecedorDados');
  return c;
}

export function FornecedorDados({ children }: { children: ReactNode }) {
  return MODO === 'local' ? <FornecedorLocal>{children}</FornecedorLocal> : <FornecedorOnline>{children}</FornecedorOnline>;
}

// ---------------- Modo local (protótipo) ----------------

function FornecedorLocal({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BaseDados>(() => repositorioLocal.carregar());
  useEffect(() => {
    repositorioLocal.guardar(db);
  }, [db]);
  return (
    <Contexto.Provider
      value={{
        db,
        alterar: (f) => setDb((d) => f(structuredClone(d))),
        substituir: setDb,
        modo: 'local',
        perfil: null,
        verClinicos: true,
        eAdmin: true,
        estadoSync: 'guardado',
        erroSync: '',
        pendentes: 0,
        servidor: null,
        sair: () => {},
        recarregar: async () => {},
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

// ---------------- Modo online ----------------

function Ecra({ children }: { children: ReactNode }) {
  return (
    <div className="ecra-entrada">
      <div className="cartao-entrada">{children}</div>
    </div>
  );
}

function FornecedorOnline({ children }: { children: ReactNode }) {
  const [servidor, setServidor] = useState<Servidor | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [erroLigacao, setErroLigacao] = useState('');
  const [precisaPassword, setPrecisaPassword] = useState(ORIGEM_LINK !== null);

  const verificar = useCallback(async (s: Servidor) => {
    try {
      setPerfil(await s.sessao());
      setErroLigacao('');
    } catch (e) {
      setErroLigacao((e as Error).message);
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    let parar = () => {};
    obterServidor().then((s) => {
      setServidor(s);
      verificar(s);
      parar = s.aoMudarSessao(() => verificar(s));
    });
    return () => parar();
  }, [verificar]);

  if (!servidor || perfil === undefined)
    return (
      <Ecra>
        <p className="sub">A ligar ao servidor…</p>
      </Ecra>
    );
  if (!perfil)
    return (
      <Ecra>
        <Entrar servidor={servidor} erroInicial={ERRO_LINK ?? erroLigacao} />
      </Ecra>
    );
  if (precisaPassword)
    return (
      <Ecra>
        <DefinirPassword
          servidor={servidor}
          perfil={perfil}
          origem={ORIGEM_LINK}
          concluir={() => {
            history.replaceState(null, '', window.location.pathname);
            setPrecisaPassword(false);
            verificar(servidor);
          }}
        />
      </Ecra>
    );
  if (!perfil.papel || !perfil.ativo)
    return (
      <Ecra>
        <SemAcesso perfil={perfil} sair={() => servidor.sair()} atualizar={() => verificar(servidor)} />
      </Ecra>
    );
  return (
    <SessaoDados key={perfil.userId + perfil.papel} servidor={servidor} perfil={perfil}>
      {children}
    </SessaoDados>
  );
}

function SessaoDados({ servidor, perfil, children }: { servidor: Servidor; perfil: Perfil; children: ReactNode }) {
  const verClinicos = podeVerClinicos(perfil.papel);
  const [db, setDb] = useState<BaseDados | null>(null);
  const [erroCarregar, setErroCarregar] = useState('');
  const [estadoSync, setEstadoSync] = useState<EstadoSync>('guardado');
  const [erroSync, setErroSync] = useState('');
  const [pendentes, setPendentes] = useState(0);

  // guardado = última versão confirmada pelo servidor; atual = versão no ecrã
  const guardado = useRef<BaseDados | null>(null);
  const atual = useRef<BaseDados | null>(null);
  const aEnviar = useRef(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tentativas = useRef(0);

  const haPendentes = () => atual.current !== guardado.current;

  const enviar = useCallback(async () => {
    if (aEnviar.current || !guardado.current || !atual.current) return;
    const alvo = atual.current;
    const alt = calcularAlteracoes(guardado.current, alvo, verClinicos);
    if (semAlteracoes(alt)) {
      guardado.current = alvo;
      setEstadoSync('guardado');
      setPendentes(0);
      return;
    }
    aEnviar.current = true;
    setEstadoSync('a_guardar');
    setPendentes(contarAlteracoes(alt));
    try {
      await servidor.guardar(alt);
      guardado.current = alvo;
      tentativas.current = 0;
      setErroSync('');
      if (atual.current !== alvo) temporizador.current = setTimeout(enviar, 300);
      else {
        setEstadoSync('guardado');
        setPendentes(0);
      }
    } catch (e) {
      tentativas.current++;
      setErroSync((e as Error).message);
      setEstadoSync('erro');
      const espera = Math.min(60_000, 2000 * 2 ** (tentativas.current - 1));
      temporizador.current = setTimeout(enviar, espera);
    } finally {
      aEnviar.current = false;
    }
  }, [servidor, verClinicos]);

  const agendar = useCallback(
    (ms = 800) => {
      clearTimeout(temporizador.current);
      setEstadoSync((s) => (s === 'erro' ? s : 'pendente'));
      temporizador.current = setTimeout(enviar, ms);
    },
    [enviar],
  );

  const carregar = useCallback(async () => {
    try {
      const d = await servidor.carregar(verClinicos);
      guardado.current = d;
      // Primeira utilização: cria as competições por defeito
      const inicial = d.competicoes.length ? d : { ...d, competicoes: baseDadosVazia().competicoes };
      atual.current = inicial;
      setDb(inicial);
      setErroCarregar('');
      if (inicial !== d) agendar();
    } catch (e) {
      setErroCarregar((e as Error).message);
    }
  }, [servidor, verClinicos, agendar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Atualiza com o que os colegas alteraram, se não houver nada por enviar. */
  const recarregar = useCallback(async () => {
    if (haPendentes() || aEnviar.current) return;
    try {
      const d = await servidor.carregar(verClinicos);
      if (haPendentes() || aEnviar.current) return;
      guardado.current = d;
      atual.current = d;
      setDb(d);
    } catch {
      /* tenta na próxima vez */
    }
  }, [servidor, verClinicos]);

  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && recarregar();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    const intervalo = setInterval(() => document.visibilityState === 'visible' && recarregar(), 60_000);
    const antesDeSair = (e: BeforeUnloadEvent) => {
      if (haPendentes()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', antesDeSair);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
      clearInterval(intervalo);
      window.removeEventListener('beforeunload', antesDeSair);
      clearTimeout(temporizador.current);
    };
  }, [recarregar]);

  const alterar = useCallback(
    (f: (db: BaseDados) => BaseDados) => {
      if (!atual.current) return;
      const novo = f(structuredClone(atual.current));
      atual.current = novo;
      setDb(novo);
      agendar();
    },
    [agendar],
  );

  if (erroCarregar && !db)
    return (
      <Ecra>
        <h2>Não foi possível carregar os dados</h2>
        <div className="erro">{erroCarregar}</div>
        <p>
          <button className="primario" onClick={carregar}>
            Tentar de novo
          </button>{' '}
          <button onClick={() => servidor.sair()}>Sair</button>
        </p>
      </Ecra>
    );
  if (!db)
    return (
      <Ecra>
        <p className="sub">A carregar os dados…</p>
      </Ecra>
    );

  return (
    <Contexto.Provider
      value={{
        db,
        alterar,
        substituir: (novo) => alterar(() => novo),
        modo: MODO,
        perfil,
        verClinicos,
        eAdmin: perfil.papel === 'admin',
        estadoSync,
        erroSync,
        pendentes,
        servidor,
        sair: () => {
          if (haPendentes() && !confirm('Há alterações que ainda não foram guardadas no servidor. Sair mesmo assim?')) return;
          servidor.sair();
        },
        recarregar,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

// ---------------- utilitários ----------------

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
