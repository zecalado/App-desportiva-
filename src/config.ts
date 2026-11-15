// Modo de funcionamento, decidido na compilação:
//  - local:  dados só no browser (protótipo; `npm run build:local`)
//  - online: Supabase (definir VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
//  - falso:  servidor simulado, só para testes (`VITE_SERVIDOR=falso`)
import type { OrigemLink, Servidor } from './servidor';

export type Modo = 'local' | 'online' | 'falso';

const env = import.meta.env;
export const MODO: Modo =
  env.MODE === 'offline'
    ? 'local'
    : env.VITE_SERVIDOR === 'falso'
      ? 'falso'
      : env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
        ? 'online'
        : 'local';

// Links de convite/recuperação chegam com informação no endereço (#...).
// É lida antes de o cliente do Supabase a consumir.
const hash = typeof window !== 'undefined' ? window.location.hash : '';
export const ORIGEM_LINK: OrigemLink = /type=invite/.test(hash)
  ? 'convite'
  : /type=recovery/.test(hash)
    ? 'recuperacao'
    : null;
export const ERRO_LINK: string | null = /error_code=otp_expired/.test(hash)
  ? 'O link expirou ou já foi usado. Peça um novo convite ao administrador ou use “Esqueci-me da palavra-passe”.'
  : /error=/.test(hash)
    ? decodeURIComponent((hash.match(/error_description=([^&]*)/)?.[1] ?? 'Link inválido.').replace(/\+/g, ' '))
    : null;

let instancia: Promise<Servidor> | null = null;
export function obterServidor(): Promise<Servidor> {
  instancia ??=
    MODO === 'falso'
      ? import('./servidorFalso').then((m) => m.criarServidorFalso())
      : import('./servidorSupabase').then((m) =>
          m.criarServidorSupabase(env.VITE_SUPABASE_URL as string, env.VITE_SUPABASE_ANON_KEY as string),
        );
  return instancia;
}
