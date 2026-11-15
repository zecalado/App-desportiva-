import { useState } from 'react';
import type { FormEvent } from 'react';
import type { OrigemLink, Perfil, Servidor } from '../servidor';

export const MIN_PASSWORD = 8;

export function Entrar({ servidor, erroInicial }: { servidor: Servidor; erroInicial: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState(erroInicial ?? '');
  const [info, setInfo] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [recuperar, setRecuperar] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setInfo('');
    setAEnviar(true);
    try {
      if (recuperar) {
        await servidor.pedirRecuperacao(email);
        setInfo('Se o email estiver registado, vai receber um link para definir uma nova palavra-passe.');
      } else await servidor.entrar(email, password);
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <form onSubmit={submeter} className="form-entrada">
      <h1>Gestão de Plantel</h1>
      <p className="sub">{recuperar ? 'Recuperar a palavra-passe' : 'Entrar com a sua conta da equipa técnica'}</p>
      <label>
        Email
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </label>
      {!recuperar && (
        <label>
          Palavra-passe
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      {erro && <div className="erro">{erro}</div>}
      {info && <div className="aviso">{info}</div>}
      <button className="primario" type="submit" disabled={aEnviar}>
        {aEnviar ? 'Aguarde…' : recuperar ? 'Enviar link' : 'Entrar'}
      </button>
      <button
        type="button"
        className="ligacao"
        onClick={() => {
          setRecuperar(!recuperar);
          setErro('');
          setInfo('');
        }}
      >
        {recuperar ? '← Voltar' : 'Esqueci-me da palavra-passe'}
      </button>
      <p className="sub pequeno">
        Não há registo público: as contas são criadas pelo administrador. Se não receber o email de recuperação, peça ao
        administrador.
      </p>
    </form>
  );
}

export function FormularioPassword({
  servidor,
  aoConcluir,
  textoBotao,
}: {
  servidor: Servidor;
  aoConcluir: () => void;
  textoBotao: string;
}) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (p1.length < MIN_PASSWORD) return setErro(`A palavra-passe tem de ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (p1 !== p2) return setErro('As palavras-passe não coincidem.');
    setAEnviar(true);
    setErro('');
    try {
      await servidor.definirPassword(p1);
      aoConcluir();
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setAEnviar(false);
    }
  };
  return (
    <form onSubmit={submeter} className="form-entrada">
      <label>
        Nova palavra-passe
        <input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} autoFocus />
      </label>
      <label>
        Repetir palavra-passe
        <input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
      </label>
      {erro && <div className="erro">{erro}</div>}
      <button className="primario" type="submit" disabled={aEnviar}>
        {aEnviar ? 'Aguarde…' : textoBotao}
      </button>
    </form>
  );
}

export function DefinirPassword({
  servidor,
  perfil,
  origem,
  concluir,
}: {
  servidor: Servidor;
  perfil: Perfil;
  origem: OrigemLink;
  concluir: () => void;
}) {
  return (
    <>
      <h1>{origem === 'convite' ? 'Bem-vindo(a)' : 'Nova palavra-passe'}</h1>
      <p className="sub">
        {origem === 'convite'
          ? `Defina a palavra-passe da sua conta (${perfil.email}). Vai usá-la para entrar a partir de agora.`
          : `Defina uma nova palavra-passe para ${perfil.email}.`}
      </p>
      <FormularioPassword servidor={servidor} aoConcluir={concluir} textoBotao="Guardar e continuar" />
    </>
  );
}

export function SemAcesso({ perfil, sair, atualizar }: { perfil: Perfil; sair: () => void; atualizar: () => void }) {
  return (
    <>
      <h1>A aguardar acesso</h1>
      <p>
        A conta <strong>{perfil.email}</strong> {perfil.ativo || !perfil.papel ? 'ainda não tem um perfil atribuído' : 'está desativada'}.
      </p>
      <p className="sub">Peça ao administrador da equipa técnica para lhe atribuir um perfil e depois carregue em “Verificar de novo”.</p>
      <p>
        <button className="primario" onClick={atualizar}>
          Verificar de novo
        </button>{' '}
        <button onClick={sair}>Sair</button>
      </p>
    </>
  );
}
