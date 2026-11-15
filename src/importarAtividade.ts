// Importação de treinos e jogos a partir de Excel. Lógica pura (testável).
//
// TREINOS — grelha: uma linha por jogador (colunas Nº e/ou Nome) e uma coluna
// por treino, com a data no cabeçalho. Células: P (presente), F (falta),
// L (lesionado), D (doente); vazio = sem registo.
//
// JOGOS — três folhas, ligadas pela data do jogo:
//   Jogos:         Data | Competição | Jornada | Adversário | Local | Duração | Notas
//   Convocatórias: Data | Jogador | Situação | Nº
//   Eventos:       Data | Minuto | Tipo | Jogador | Assistência / Entra | Penálti | Descrição
import { validarJogo } from './calc';
import type { Folha, Valor } from './importar';
import { converterData, converterNumero, normalizar } from './importar';
import type {
  BaseDados,
  Competicao,
  Evento,
  Jogador,
  Jogo,
  MotivoIndisponivel,
  Presenca,
  TipoCompeticao,
} from './types';
import { novoId } from './types';

// ---------- utilitários ----------

type Mapa<K extends string> = Partial<Record<K, number>>;

function encontrarCabecalho<K extends string>(
  linhas: Valor[][],
  sinonimos: Record<K, string[]>,
  obrigatorios: NoInfer<K>[],
): { idx: number; mapa: Mapa<K> } | null {
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const mapa: Mapa<K> = {};
    (linhas[i] ?? []).forEach((v, c) => {
      if (typeof v !== 'string') return;
      const n = normalizar(v);
      for (const [k, sin] of Object.entries(sinonimos) as [K, string[]][])
        if (mapa[k] === undefined && sin.includes(n)) mapa[k] = c;
    });
    if (obrigatorios.every((k) => mapa[k] !== undefined)) return { idx: i, mapa };
  }
  return null;
}

const celula = <K extends string>(linha: Valor[], mapa: Mapa<K>, k: K): Valor =>
  mapa[k] === undefined ? null : (linha[mapa[k]!] ?? null);

const texto = (v: Valor): string => (v == null ? '' : v instanceof Date ? (converterData(v) ?? '') : String(v).trim());

/** Ano inicial da época ("2026/2027" → 2026), para datas escritas sem ano. */
function anoInicialEpoca(epoca: string): number | null {
  const m = epoca.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

/** Converte data; aceita também "dd/mm" (ano deduzido da época: jul–dez = 1º ano). */
export function converterDataEpoca(v: Valor, epoca: string): string | null {
  const d = converterData(typeof v === 'string' ? v.trim() : v);
  if (d) return d;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(?:treino\s*)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/i);
  if (!m) return null;
  if (m[3]) return converterData(`${m[1]}/${m[2]}/${m[3]}`);
  const ano = anoInicialEpoca(epoca);
  if (!ano) return null;
  const mes = Number(m[2]);
  return converterData(`${m[1]}/${m[2]}/${mes >= 7 ? ano : ano + 1}`);
}

/** Identifica um jogador por nome (ou alcunha) ou por número. */
export function resolverJogador(
  v: Valor,
  jogadores: Jogador[],
  numerosDoJogo?: Map<number, string>,
): string | null {
  if (v == null || v instanceof Date) return null;
  const porNumero = (n: number) =>
    numerosDoJogo?.get(n) ?? jogadores.find((j) => j.ativo && j.numero === n)?.id ?? null;
  if (typeof v === 'number') return Number.isInteger(v) ? porNumero(v) : null;
  const s = v.trim();
  if (/^\d+$/.test(s)) return porNumero(Number(s));
  const n = normalizar(s);
  const porNome =
    jogadores.find((j) => normalizar(j.nome) === n) ??
    jogadores.find((j) => j.alcunha && normalizar(j.alcunha) === n);
  if (porNome) return porNome.id;
  // "15 - Nome Apelido" ou "15 Nome Apelido"
  const m = s.match(/^(\d+)\s*[-–.:]?\s*(.+)$/);
  if (m) return resolverJogador(m[2], jogadores, numerosDoJogo) ?? porNumero(Number(m[1]));
  return null;
}

// ---------- TREINOS ----------

export function converterPresenca(v: Valor): Presenca | null | 'invalido' {
  if (v == null) return null;
  const bruto = String(v).trim();
  if (!bruto) return null;
  if (/[✓✔]/.test(bruto)) return 'presente';
  const n = normalizar(bruto);
  if (['p', 'presente', 'sim', 's', 'x', '1', 'pres'].includes(n)) return 'presente';
  if (['f', 'falta', 'faltou', 'n', 'nao', '0', 'fj', 'fi', 'j', 'justificada', 'falta justificada', 'falta injustificada'].includes(n))
    return 'falta';
  if (['l', 'lesionado', 'les', 'lesao', 'lesionada'].includes(n)) return 'lesionado';
  if (['d', 'doente', 'doenca'].includes(n)) return 'doente';
  return 'invalido';
}

export interface TreinoPlaneado {
  data: string;
  presencas: Record<string, Presenca>;
  existenteId: string | null;
}

export interface PlanoTreinos {
  treinos: TreinoPlaneado[];
  jogadoresReconhecidos: number;
  naoReconhecidos: string[];
  registos: number;
  avisos: string[];
}

export function planearTreinos(folha: Folha, db: BaseDados): PlanoTreinos | { erro: string } {
  const linhas = folha.linhas;
  let idxCab = -1;
  let colNome = -1;
  let colNum = -1;
  let colunasData: { col: number; data: string }[] = [];

  for (let i = 0; i < Math.min(15, linhas.length) && idxCab < 0; i++) {
    const l = linhas[i] ?? [];
    let nome = -1;
    let num = -1;
    l.forEach((v, c) => {
      if (typeof v !== 'string') return;
      const n = normalizar(v);
      if (nome < 0 && ['nome', 'jogador', 'atleta'].includes(n)) nome = c;
      if (num < 0 && ['n', 'no', 'numero', 'num'].includes(n)) num = c;
    });
    if (nome < 0 && num < 0) continue;
    const datas = l
      .map((v, c) => ({ col: c, data: c === nome || c === num ? null : converterDataEpoca(v, db.definicoes.epoca) }))
      .filter((x): x is { col: number; data: string } => x.data !== null);
    if (datas.length) {
      idxCab = i;
      colNome = nome;
      colNum = num;
      colunasData = datas;
    }
  }
  if (idxCab < 0)
    return {
      erro: 'Não encontrei a grelha de treinos: é preciso uma linha de cabeçalho com “Nome” (ou “Nº”) e pelo menos uma coluna com uma data.',
    };

  const avisos: string[] = [];
  const porData = new Map<string, TreinoPlaneado>();
  for (const { data } of colunasData) {
    if (porData.has(data)) {
      avisos.push(`A data ${data.split('-').reverse().join('/')} aparece em mais do que uma coluna; os registos foram juntos.`);
      continue;
    }
    const existentes = db.treinos.filter((t) => t.data === data);
    if (existentes.length > 1)
      avisos.push(`Já existem ${existentes.length} treinos em ${data.split('-').reverse().join('/')}; os dados vão para o primeiro.`);
    porData.set(data, { data, presencas: {}, existenteId: existentes[0]?.id ?? null });
  }

  const naoReconhecidos: string[] = [];
  const reconhecidos = new Set<string>();
  let registos = 0;
  for (let i = idxCab + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    const nome = colNome >= 0 ? l[colNome] : null;
    const num = colNum >= 0 ? l[colNum] : null;
    if (texto(nome) === '' && texto(num) === '') continue;
    const id = resolverJogador(nome, db.jogadores) ?? resolverJogador(num, db.jogadores);
    const temValores = colunasData.some(({ col }) => texto(l[col]) !== '');
    if (!id) {
      if (temValores) naoReconhecidos.push(`${texto(nome) || '#' + texto(num)} (linha ${i + 1})`);
      continue;
    }
    reconhecidos.add(id);
    for (const { col, data } of colunasData) {
      const p = converterPresenca(l[col]);
      if (p === null) continue;
      if (p === 'invalido') {
        avisos.push(`Linha ${i + 1}, ${data.split('-').reverse().join('/')}: valor “${texto(l[col])}” não reconhecido (use P, F, L ou D).`);
        continue;
      }
      porData.get(data)!.presencas[id] = p;
      registos++;
    }
  }

  return {
    treinos: [...porData.values()].filter((t) => Object.keys(t.presencas).length > 0).sort((a, b) => a.data.localeCompare(b.data)),
    jogadoresReconhecidos: reconhecidos.size,
    naoReconhecidos,
    registos,
    avisos,
  };
}

export function aplicarTreinos(db: BaseDados, plano: PlanoTreinos): BaseDados {
  const treinos = db.treinos.map((t) => ({ ...t, presencas: { ...t.presencas } }));
  for (const p of plano.treinos) {
    const ex = p.existenteId ? treinos.find((t) => t.id === p.existenteId) : undefined;
    if (ex) Object.assign(ex.presencas, p.presencas);
    else treinos.push({ id: novoId(), data: p.data, notas: '', presencas: { ...p.presencas } });
  }
  return { ...db, treinos };
}

// ---------- JOGOS ----------

const SIN_JOGOS = {
  data: ['data', 'data do jogo', 'dia'],
  competicao: ['competicao', 'prova'],
  jornada: ['jornada', 'eliminatoria', 'ronda', 'jornada eliminatoria'],
  adversario: ['adversario', 'equipa adversaria', 'contra'],
  local: ['local', 'casa fora', 'c f', 'campo'],
  duracao: ['duracao', 'duracao min', 'minutos'],
  notas: ['notas', 'observacoes', 'obs', 'informacoes'],
};
const SIN_CONV = {
  data: SIN_JOGOS.data,
  jogador: ['jogador', 'nome', 'atleta'],
  situacao: ['situacao', 'estado', 'convocatoria'],
  numero: ['n', 'no', 'numero', 'n camisola', 'camisola', 'numero camisola', 'n jogo'],
};
const SIN_EV = {
  data: SIN_JOGOS.data,
  minuto: ['minuto', 'min', 'minutos'],
  tipo: ['tipo', 'evento', 'acao'],
  jogador: ['jogador', 'nome', 'jogador sai', 'sai', 'marcador'],
  jogador2: ['assistencia entra', 'assistencia', 'entra', 'jogador 2', 'jogador entra', 'assistencia ou entra'],
  penalti: ['penalti', 'penalty', 'grande penalidade'],
  descricao: ['descricao', 'marcador adversario', 'detalhe', 'notas', 'obs'],
};

export function converterSituacao(v: Valor): 'titular' | 'suplente' | MotivoIndisponivel | 'nc' | null {
  const n = normalizar(texto(v));
  if (!n) return null;
  if (['titular', 't', 'tit', '11 inicial', 'inicial'].includes(n)) return 'titular';
  if (['suplente', 's', 'sup', 'supl', 'banco', 'su', 'snu'].includes(n)) return 'suplente';
  if (['lesionado', 'l', 'les', 'lesao'].includes(n)) return 'lesionado';
  if (['doente', 'd', 'doenca'].includes(n)) return 'doente';
  if (['castigado', 'c', 'castigo', 'suspenso'].includes(n)) return 'castigado';
  if (['outro', 'o', 'indisponivel', 'outro motivo'].includes(n)) return 'outro';
  if (['nc', 'nao convocado', 'n c', 'nao'].includes(n)) return 'nc';
  return null;
}

export function converterTipoEvento(v: Valor): Evento['tipo'] | null {
  const n = normalizar(texto(v));
  if (['golo', 'g', 'golo marcado', 'golo nosso'].includes(n)) return 'golo';
  if (['golo adversario', 'golo sofrido', 'ga', 'gs', 'golo contra', 'golo do adversario', 'sofrido'].includes(n)) return 'golo_adversario';
  if (['amarelo', 'a', 'cartao amarelo', 'ca'].includes(n)) return 'amarelo';
  if (['vermelho', 'v', 'cartao vermelho', 'cv', 'vermelho direto'].includes(n)) return 'vermelho';
  if (['substituicao', 'sub', 's', 'subst', 'troca'].includes(n)) return 'substituicao';
  return null;
}

/** "40", "40'", 40, "45+2" (→ 47) */
export function converterMinuto(v: Valor): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 150 ? v : null;
  const s = texto(v);
  const m = s.match(/^(\d{1,3})\s*(?:\+\s*(\d{1,2}))?\s*['"’´º]*$/);
  if (!m) return null;
  const total = Number(m[1]) + Number(m[2] ?? 0);
  return total <= 150 ? total : null;
}

function tipoCompeticao(nome: string): TipoCompeticao {
  const n = normalizar(nome);
  return n.includes('taca') ? 'taca' : n.includes('amig') ? 'amigavel' : 'campeonato';
}

export interface JogoPlaneado {
  jogo: Jogo;
  acao: 'novo' | 'substituir';
  avisos: string[];
}

export interface PlanoJogos {
  jogos: JogoPlaneado[];
  competicoesNovas: Competicao[];
  ignorados: string[]; // jogos que já existem e não serão substituídos
  avisos: string[];
  folhasUsadas: { jogos: string; convocatorias: string | null; eventos: string | null };
}

function escolherFolha<K extends string>(
  folhas: Folha[],
  nomes: string[],
  sin: Record<K, string[]>,
  obrig: NoInfer<K>[],
): { folha: Folha; idx: number; mapa: Mapa<K> } | null {
  const ordem = [
    ...folhas.filter((f) => nomes.includes(normalizar(f.nome))),
    ...folhas.filter((f) => !nomes.includes(normalizar(f.nome))),
  ];
  for (const f of ordem) {
    const c = encontrarCabecalho(f.linhas, sin, obrig);
    if (c) return { folha: f, ...c };
  }
  return null;
}

export function planearJogos(
  folhas: Folha[],
  db: BaseDados,
  substituirExistentes: boolean,
): PlanoJogos | { erro: string } {
  const fj = escolherFolha(folhas, ['jogos', 'jogo', 'calendario'], SIN_JOGOS, ['data', 'adversario']);
  if (!fj)
    return { erro: 'Não encontrei a folha “Jogos”: é preciso uma linha de cabeçalho com pelo menos “Data” e “Adversário”.' };
  const fc = escolherFolha(folhas.filter((f) => f !== fj.folha), ['convocatorias', 'convocatoria', 'convocados'], SIN_CONV, ['data', 'jogador', 'situacao']);
  const fe = escolherFolha(folhas.filter((f) => f !== fj.folha && f !== fc?.folha), ['eventos', 'ocorrencias'], SIN_EV, ['data', 'minuto', 'tipo']);
  const epoca = db.definicoes.epoca;
  const avisos: string[] = [];
  const fmt = (d: string) => d.split('-').reverse().join('/');

  // Competições
  const competicoes = [...db.competicoes];
  const competicoesNovas: Competicao[] = [];
  const resolverCompeticao = (nome: string): Competicao | null => {
    if (!nome) return competicoes.find((c) => c.tipo === 'campeonato') ?? competicoes[0] ?? null;
    const n = normalizar(nome);
    let c = competicoes.find((x) => normalizar(x.nome) === n);
    if (!c) {
      c = { id: novoId(), nome: nome.trim(), tipo: tipoCompeticao(nome), amarelosParaCastigo: null };
      competicoes.push(c);
      competicoesNovas.push(c);
    }
    return c;
  };

  // 1) Jogos
  const planeados = new Map<string, JogoPlaneado>();
  const ignorados: string[] = [];
  for (let i = fj.idx + 1; i < fj.folha.linhas.length; i++) {
    const l = fj.folha.linhas[i] ?? [];
    const dataBruta = celula(l, fj.mapa, 'data');
    const adv = texto(celula(l, fj.mapa, 'adversario'));
    if (dataBruta == null && !adv) continue;
    const data = converterDataEpoca(dataBruta, epoca);
    if (!data) {
      avisos.push(`Jogos, linha ${i + 1}: data “${texto(dataBruta)}” não reconhecida — linha ignorada.`);
      continue;
    }
    if (planeados.has(data)) {
      avisos.push(`Jogos, linha ${i + 1}: já há um jogo em ${fmt(data)} no ficheiro — linha ignorada.`);
      continue;
    }
    const existente = db.jogos.find((j) => j.data === data);
    if (existente && !substituirExistentes) {
      ignorados.push(`${fmt(data)} ${existente.adversario}`);
      continue;
    }
    const nomeComp = texto(celula(l, fj.mapa, 'competicao'));
    const comp = resolverCompeticao(nomeComp);
    if (!comp) {
      avisos.push(`Jogos, linha ${i + 1}: sem competição definida — linha ignorada.`);
      continue;
    }
    const localTxt = normalizar(texto(celula(l, fj.mapa, 'local')));
    const local: Jogo['local'] = ['f', 'fora', 'visitante', 'away'].includes(localTxt) ? 'fora' : 'casa';
    const avisosJogo: string[] = [];
    if (localTxt && !['f', 'fora', 'visitante', 'away', 'c', 'casa', 'visitado', 'home'].includes(localTxt))
      avisosJogo.push(`Local “${texto(celula(l, fj.mapa, 'local'))}” não reconhecido; assumido “Casa”.`);
    if (!nomeComp) avisosJogo.push(`Sem competição; assumido “${comp.nome}”.`);
    const dur = converterNumero(celula(l, fj.mapa, 'duracao'));
    planeados.set(data, {
      acao: existente ? 'substituir' : 'novo',
      avisos: avisosJogo,
      jogo: {
        id: existente?.id ?? novoId(),
        competicaoId: comp.id,
        jornada: texto(celula(l, fj.mapa, 'jornada')),
        data,
        adversario: adv,
        local,
        duracao: dur && dur > 0 && dur <= 130 ? dur : 90,
        convocados: [],
        indisponiveis: [],
        eventos: [],
        notas: texto(celula(l, fj.mapa, 'notas')),
      },
    });
  }

  const jogoDaLinha = (folha: string, i: number, v: Valor): JogoPlaneado | null => {
    const data = converterDataEpoca(v, epoca);
    if (!data) {
      if (texto(v)) avisos.push(`${folha}, linha ${i + 1}: data “${texto(v)}” não reconhecida.`);
      return null;
    }
    const p = planeados.get(data);
    if (!p && !db.jogos.some((j) => j.data === data))
      avisos.push(`${folha}, linha ${i + 1}: não há jogo em ${fmt(data)} na folha Jogos.`);
    return p ?? null; // jogos ignorados (já existentes) não recebem dados
  };
  const nomeJ = (id: string) => db.jogadores.find((j) => j.id === id)?.nome ?? '?';

  // 2) Convocatórias
  if (fc) {
    for (let i = fc.idx + 1; i < fc.folha.linhas.length; i++) {
      const l = fc.folha.linhas[i] ?? [];
      if (l.every((v) => texto(v) === '')) continue;
      const p = jogoDaLinha('Convocatórias', i, celula(l, fc.mapa, 'data'));
      if (!p) continue;
      const jv = celula(l, fc.mapa, 'jogador');
      const id = resolverJogador(jv, db.jogadores);
      if (!id) {
        p.avisos.push(`Convocatória: jogador “${texto(jv)}” não existe no plantel (linha ${i + 1}).`);
        continue;
      }
      const sit = converterSituacao(celula(l, fc.mapa, 'situacao'));
      if (!sit) {
        p.avisos.push(`Convocatória: situação “${texto(celula(l, fc.mapa, 'situacao'))}” de ${nomeJ(id)} não reconhecida (linha ${i + 1}).`);
        continue;
      }
      if (sit === 'nc') continue;
      const j = p.jogo;
      if (j.convocados.some((c) => c.jogadorId === id) || j.indisponiveis.some((c) => c.jogadorId === id)) {
        p.avisos.push(`Convocatória: ${nomeJ(id)} aparece mais do que uma vez.`);
        continue;
      }
      if (sit === 'titular' || sit === 'suplente') {
        const nCel = celula(l, fc.mapa, 'numero');
        const n = converterNumero(nCel);
        j.convocados.push({
          jogadorId: id,
          numero: n != null && Number.isInteger(n) ? n : (db.jogadores.find((x) => x.id === id)?.numero ?? null),
          titular: sit === 'titular',
        });
      } else j.indisponiveis.push({ jogadorId: id, motivo: sit });
    }
  }

  // 3) Eventos
  if (fe) {
    for (let i = fe.idx + 1; i < fe.folha.linhas.length; i++) {
      const l = fe.folha.linhas[i] ?? [];
      if (l.every((v) => texto(v) === '')) continue;
      const p = jogoDaLinha('Eventos', i, celula(l, fe.mapa, 'data'));
      if (!p) continue;
      const linha = `(linha ${i + 1})`;
      const tipo = converterTipoEvento(celula(l, fe.mapa, 'tipo'));
      const minuto = converterMinuto(celula(l, fe.mapa, 'minuto'));
      if (!tipo) {
        p.avisos.push(`Evento: tipo “${texto(celula(l, fe.mapa, 'tipo'))}” não reconhecido ${linha}.`);
        continue;
      }
      if (minuto == null) {
        p.avisos.push(`Evento: minuto “${texto(celula(l, fe.mapa, 'minuto'))}” inválido ${linha}.`);
        continue;
      }
      const numerosJogo = new Map(
        p.jogo.convocados.filter((c) => c.numero != null).map((c) => [c.numero as number, c.jogadorId]),
      );
      const v1 = celula(l, fe.mapa, 'jogador');
      const v2 = celula(l, fe.mapa, 'jogador2');
      const j1 = resolverJogador(v1, db.jogadores, numerosJogo);
      const j2 = resolverJogador(v2, db.jogadores, numerosJogo);
      const id = novoId();
      if (tipo === 'golo_adversario') {
        p.jogo.eventos.push({ id, tipo, minuto, descricao: texto(celula(l, fe.mapa, 'descricao')) || texto(v1) });
        continue;
      }
      if (!j1) {
        p.avisos.push(`Evento ${minuto}': jogador “${texto(v1)}” não reconhecido ${linha}.`);
        continue;
      }
      if (texto(v2) && !j2) p.avisos.push(`Evento ${minuto}': jogador “${texto(v2)}” não reconhecido ${linha}.`);
      if (tipo === 'golo') {
        const pen = normalizar(texto(celula(l, fe.mapa, 'penalti')));
        p.jogo.eventos.push({ id, tipo, minuto, jogadorId: j1, assistenciaId: j2, penalti: ['sim', 's', 'x', '1', 'p', 'penalti'].includes(pen) });
      } else if (tipo === 'substituicao') {
        if (!j2) {
          p.avisos.push(`Substituição ${minuto}': falta o jogador que entra ${linha}.`);
          continue;
        }
        p.jogo.eventos.push({ id, tipo, minuto, saiId: j1, entraId: j2 });
      } else p.jogo.eventos.push({ id, tipo, minuto, jogadorId: j1 });
    }
  }

  const jogos = [...planeados.values()].sort((a, b) => a.jogo.data.localeCompare(b.jogo.data));
  for (const p of jogos) {
    if (!p.jogo.convocados.length) p.avisos.push('Sem convocatória.');
    else p.avisos.push(...validarJogo(p.jogo, db.jogadores));
  }
  return {
    jogos,
    competicoesNovas,
    ignorados,
    avisos,
    folhasUsadas: { jogos: fj.folha.nome, convocatorias: fc?.folha.nome ?? null, eventos: fe?.folha.nome ?? null },
  };
}

export function aplicarJogos(db: BaseDados, plano: PlanoJogos): BaseDados {
  const jogos = [...db.jogos];
  for (const p of plano.jogos) {
    const i = jogos.findIndex((j) => j.id === p.jogo.id);
    if (i >= 0) jogos[i] = p.jogo;
    else jogos.push(p.jogo);
  }
  return { ...db, competicoes: [...db.competicoes, ...plano.competicoesNovas], jogos };
}
