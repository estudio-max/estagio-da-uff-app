/**
 * RF07: importação das planilhas internas da Divisão (convênios de 2022 em diante).
 *
 * Regras (premissas de 20/11/2026, a confirmar com a PROGRAD; REQUIREMENTS D8 e D28):
 * - **Identificação:** a linha corresponde ao convênio com o mesmo código (PR-/PU-). Sem
 *   código, ou se nenhum convênio tem esse código, vale o mesmo processo SEI e, por último,
 *   o mesmo CNPJ com o mesmo início, desde que esse convênio ainda não tenha código. Assim o
 *   convênio importado em tramitação é atualizado, e não duplicado, quando ganha o código.
 * - **Situação dos privados** pela coluna ETAPA (`situacaoPrivado`); **dos públicos**, código
 *   e datas indicam finalizado, e o resto fica em tramitação.
 * - Processo na aba "Processos arquivados" cancela o convênio que ainda tramitava.
 * - O texto original (etapa, status, instrumento, observações) fica nas observações internas.
 *
 * Nada é inventado: linha sem dado mínimo vai para o relatório como rejeitada, e o que entra
 * com ressalva vira aviso. Este módulo não toca no Firestore.
 */
import { documentoValido } from './documentos.js';
import { type Escrita, type Estado, somarAnos, UFS, VIGENCIA_MAXIMA_ANOS } from './importacao.js';
import { type LeituraPlanilhas, type LinhaPlanilha, normalizarProcesso, normalizarTexto } from './planilhas.js';

type Dados = Record<string, unknown>;
type Situacao = 'finalizado' | 'em_tramitacao' | 'cancelado';

export interface LinhaRelatorioPlanilha {
  origem: string;
  concedente: string;
  motivo: string;
}

export interface RelatorioPlanilhas {
  lidos: number;
  criados: number;
  atualizados: number;
  rejeitados: LinhaRelatorioPlanilha[];
  avisos: LinhaRelatorioPlanilha[];
  situacoes: Record<Situacao, number>;
}

export interface PlanoPlanilhas {
  relatorio: RelatorioPlanilhas;
  grupos: Escrita[][];
}

/** Prefixo das linhas que a importação escreve nas observações internas (trocadas a cada importação). */
export const PREFIXO_OBSERVACAO = 'Planilha: ';

// ---------- Situação ----------

/** ETAPA dos privados que indica convênio assinado (decisão de 20/11/2026, D28). */
const ETAPAS_FINALIZADO = [
  /^PUBLICADO\s*\/\s*CONCLUIDO/,
  /^REGISTRADO\b/,
  /^ENVIADO (?:AO )?BS\b/,
  /^ASSINADO POR AMBAS AS PARTES/,
  /^CONCLUIDO\s*\/\s*ARQUIVADO/,
  /^EXPIRADO\s*\/\s*ARQUIVADO/,
];

/** `null` quando a linha não deve ser importada (marcada como repetida). */
export function situacaoPrivado(etapa: string): Situacao | null {
  const e = normalizarTexto(etapa);
  if (/^REPETIDO\b/.test(e)) return null;
  if (ETAPAS_FINALIZADO.some((r) => r.test(e))) return 'finalizado';
  if (/\bARQUIVADO\b/.test(e)) return 'cancelado';
  return 'em_tramitacao';
}

/** Públicos: o código e as datas só são preenchidos depois da assinatura. */
export const situacaoPublico = (l: LinhaPlanilha): Situacao =>
  normalizarCodigo(l.codigo) && l.inicio && l.fim ? 'finalizado' : 'em_tramitacao';

// ---------- Normalização ----------

/**
 * `PR-123/2026`; aceita `PR-123-2026`, espaços e minúsculas. Os dígitos ficam como a Divisão
 * escreveu (`PU-40/2026` e `PU-040/2026` são números diferentes). '' se não estiver no formato.
 */
export function normalizarCodigo(s: string): string {
  const m = /^(P[RU])\s*-\s*(\d+)\s*[/-]\s*(\d{4})$/.exec(s.trim().toUpperCase());
  return m ? `${m[1]}-${m[2]}/${m[3]}` : '';
}

/** Tipo da concedente (RN05). Premissa como a D11: a planilha não distingue ensino de órgão público. */
export function tipoConcedente(l: LinhaPlanilha): string {
  const t = normalizarTexto(l.tipo);
  if (l.modelo === 'publico') return t === 'FUNDACAO PRIVADA' ? 'outros' : 'orgao_publico';
  if (!t) return 'outros';
  if (/INTEGRA/.test(t)) return 'agente_integracao';
  if (/PROFISSIONAL LIBERAL/.test(t)) return 'profissional_liberal';
  if (/SOCIEDADE CIVIL|^ONG\b|OSCIP|ASSOCIACAO/.test(t)) return 'ong_oscip';
  if (/^MEI$|MICROEMPRESA/.test(t)) return 'microempresa';
  if (/ENSINO/.test(t)) return 'ensino_privada';
  if (/^PRI+VAD[AO]$|EMPRESA PRIVADA|SOCIEDADE (?:UNIPESSOAL|EMPRESARIA)/.test(t)) return 'empresa_privada';
  return 'outros';
}

const MAPA_UF: Record<string, string> = { 'RIO DE JANEIRO': 'RJ', BH: 'MG' };
const caixaBaixa = (s: string): string => s.toLocaleLowerCase('pt-BR');
const dataBr = (iso: string): string => iso.split('-').reverse().join('/');
export const origemDe = (l: LinhaPlanilha): string => `${l.aba}, linha ${l.linha}`;

/** Id de convênio novo com código: estável, para a reimportação achar o mesmo documento. */
export const idConvenioPlanilha = (codigo: string): string =>
  `planilha-${codigo.toLowerCase().replace('/', '-')}`;

function observacoesDaLinha(l: LinhaPlanilha, justificativaArquivo: string | undefined): string[] {
  const linhas = [`${PREFIXO_OBSERVACAO}importado de "${origemDe(l)}".`];
  const rotulo = l.modelo === 'privado' ? 'etapa' : 'status';
  if (l.andamento) linhas.push(`${PREFIXO_OBSERVACAO}${rotulo}: ${l.andamento}`);
  if (l.instrumento) linhas.push(`${PREFIXO_OBSERVACAO}instrumento: ${l.instrumento}`);
  if (l.observacoes) linhas.push(`${PREFIXO_OBSERVACAO}observações: ${l.observacoes}`);
  if (justificativaArquivo !== undefined) {
    linhas.push(`${PREFIXO_OBSERVACAO}processo arquivado${justificativaArquivo ? `: ${justificativaArquivo}` : ''}`);
  }
  return linhas;
}

/** Troca as linhas da importação anterior e preserva o que a Divisão escreveu no app. */
export function mesclarObservacoes(atual: string, novas: string[]): string {
  const proprias = atual
    .split('\n')
    .filter((l) => !l.startsWith(PREFIXO_OBSERVACAO))
    .join('\n')
    .trimEnd();
  return [proprias, novas.join('\n')].filter(Boolean).join('\n\n');
}

const nomeDe = (c: Dados): string =>
  (c.nome_fantasia as string | undefined) || (c.razao_social as string | undefined) || '';

const camposMudados = (antes: Dados, dados: Dados, ignorar: string[] = []): string[] =>
  Object.keys(dados).filter((k) => !ignorar.includes(k) && antes[k] !== dados[k]);

const ORDEM: Record<Situacao, number> = { em_tramitacao: 0, finalizado: 1, cancelado: 1 };

// ---------- Planejamento ----------

/**
 * Decide o que gravar. Altera `estado` como se as escritas já tivessem sido feitas, para que
 * as linhas seguintes vejam as anteriores. As abas são lidas da mais antiga para a mais nova:
 * o dado mais recente da concedente prevalece.
 */
export function planejarImportacaoPlanilhas(
  leitura: LeituraPlanilhas,
  estado: Estado,
  hoje: string,
  novoId: () => string,
): PlanoPlanilhas {
  const linhas = [...leitura.linhas].sort((a, b) => a.ano - b.ano || a.aba.localeCompare(b.aba) || a.linha - b.linha);
  const relatorio: RelatorioPlanilhas = {
    lidos: linhas.length,
    criados: 0,
    atualizados: 0,
    rejeitados: [],
    avisos: leitura.abasIgnoradas.map((aba) => ({
      origem: `aba ${aba}`,
      concedente: '',
      motivo: `aba ignorada: só entram as abas de convênios de 2022 em diante`,
    })),
    situacoes: { finalizado: 0, em_tramitacao: 0, cancelado: 0 },
  };
  const anoAtual = Number(hoje.slice(0, 4));

  const concedentePorDocumento = new Map<string, string>();
  const semDocumentoPorNome = new Map<string, string>();
  /** Qualquer concedente, pelo nome: liga a linha sem CNPJ à concedente que já tem CNPJ. */
  const porNome = new Map<string, string>();
  const indexarConcedente = (id: string, c: Dados): void => {
    const chave = caixaBaixa((c.razao_social as string | undefined) ?? '');
    if (c.documento) concedentePorDocumento.set(c.documento as string, id);
    else if (!semDocumentoPorNome.has(chave)) semDocumentoPorNome.set(chave, id);
    if (chave && !porNome.has(chave)) porNome.set(chave, id);
  };
  for (const [id, c] of estado.concedentes) indexarConcedente(id, c);
  const porNumero = new Map<string, string>();
  const porProcesso = new Map<string, string>();
  const porDocumentoInicio = new Map<string, string>();
  /** Concedente → convênio dela em tramitação e ainda sem número (negociação). */
  const negociacaoPorConcedente = new Map<string, string>();
  const indexar = (id: string, c: Dados): void => {
    if (c.numero) porNumero.set(c.numero as string, id);
    if (!c.numero && c.situacao === 'em_tramitacao') negociacaoPorConcedente.set(c.concedente_id as string, id);
    const processo = normalizarProcesso((c.processo_sei as string | undefined) ?? '');
    if (processo && !porProcesso.has(processo)) porProcesso.set(processo, id);
    const doc = estado.concedentes.get(c.concedente_id as string)?.documento as string | undefined;
    if (doc && c.inicio_vigencia) {
      const chave = `${doc}|${c.inicio_vigencia as string}`;
      if (!porDocumentoInicio.has(chave)) porDocumentoInicio.set(chave, id);
    }
  };
  for (const [id, c] of estado.convenios) indexar(id, c);
  /** Convênio → linha desta importação que já o usou. */
  const usados = new Map<string, string>();
  const originais = { concedentes: new Map(estado.concedentes), convenios: new Map(estado.convenios) };
  const concedentesTocadas = new Set<string>();
  /** Concedente criada nesta importação → primeiro convênio dela. */
  const concedentesNovas = new Map<string, string>();
  const conveniosTocados = new Set<string>();

  for (const l of linhas) {
    const origem = origemDe(l);
    const nome = l.razaoSocial || l.nomeFantasia;
    const rejeitar = (motivo: string): void => {
      relatorio.rejeitados.push({ origem, concedente: nome, motivo });
    };
    const avisos: string[] = [];

    // --- Situação ---
    let situacao: Situacao | null = l.modelo === 'privado' ? situacaoPrivado(l.andamento) : situacaoPublico(l);
    if (situacao === null) {
      rejeitar(`linha marcada como repetida na planilha (${l.andamento})`);
      continue;
    }
    if (!nome) {
      rejeitar('sem razão social');
      continue;
    }
    const codigo = normalizarCodigo(l.codigo);
    if (l.codigo && !codigo) avisos.push(`código "${l.codigo}" fora do formato PR-/PU-nnn/aaaa; ficou sem número`);
    const processo = normalizarProcesso(l.processo);
    const justificativaArquivo = processo ? leitura.arquivados.get(processo) : undefined;
    if (justificativaArquivo !== undefined && situacao === 'em_tramitacao') situacao = 'cancelado';

    // --- Datas ---
    let inicio = l.inicio;
    let fim = l.fim;
    // Ano de 2 dígitos que o Excel leu como 19xx (ex.: "28/01/30" virou 1930): é 20xx.
    let anoInvalido: string | null = null;
    const seculoXXI = (d: string | null, campo: string): string | null => {
      if (!d || d >= '1950') return d;
      if (d < '1900') {
        anoInvalido ??= dataBr(d);
        return d;
      }
      const corrigida = `${Number(d.slice(0, 4)) + 100}${d.slice(4)}`;
      avisos.push(`${campo} ${dataBr(d)} lido como ${dataBr(corrigida)} (ano digitado com 2 dígitos)`);
      return corrigida;
    };
    inicio = seculoXXI(inicio, 'início');
    fim = seculoXXI(fim, 'término');
    let problemaData: string | null = null;
    if (l.dataIlegivel !== null) problemaData = `data ilegível: ${l.dataIlegivel}`;
    else if (anoInvalido) problemaData = `data ilegível: ${anoInvalido}`;
    else if (inicio && fim && fim <= inicio) {
      problemaData = `término (${dataBr(fim)}) não é depois do início (${dataBr(inicio)})`;
    } else if ((inicio === null) !== (fim === null)) problemaData = 'só uma das datas preenchida';
    if (problemaData) {
      // Não se perde o convênio: entra sem datas e a Divisão corrige no app.
      avisos.push(
        situacao === 'finalizado'
          ? `convênio assinado, mas ${problemaData}; ficou em tramitação e sem datas, para corrigir`
          : `${problemaData}; ficou sem datas`,
      );
      inicio = null;
      fim = null;
      if (situacao === 'finalizado') situacao = 'em_tramitacao';
    } else if (situacao === 'finalizado' && (!codigo || !inicio || !fim)) {
      avisos.push('etapa indica convênio assinado, mas falta o código ou as datas; ficou em tramitação');
      situacao = 'em_tramitacao';
    }
    if (inicio && fim && fim >= somarAnos(inicio, VIGENCIA_MAXIMA_ANOS)) {
      avisos.push(`vigência acima de ${VIGENCIA_MAXIMA_ANOS} anos (RN07)`);
    }
    if (situacao === 'em_tramitacao' && l.ano <= anoAtual - 2) {
      avisos.push(`em tramitação desde a aba de ${l.ano}: verificar se deve ser cancelado`);
    }

    // --- Documento ---
    // Zero à esquerda perdido ou texto depois do número ("…0001-90 MATRIZ").
    let documento =
      [l.documento, l.documento.padStart(14, '0'), l.documento.slice(0, 14)].find(
        (d) => /^[A-Z0-9]{11,14}$/.test(d) && documentoValido(d),
      ) ?? l.documento;
    if (documento && !documentoValido(documento)) {
      avisos.push(`CNPJ/CPF inválido (${documento}); concedente ficou sem documento`);
      documento = '';
    } else if (!documento && situacao !== 'em_tramitacao') {
      avisos.push('sem CNPJ: concedente sem documento, agrupada pelo nome');
    }

    // --- Qual convênio ---
    const semCodigo = (id: string | undefined): string | undefined =>
      id && !estado.convenios.get(id)?.numero ? id : undefined;
    const chaveNome = caixaBaixa(nome.slice(0, 255));
    const concedenteConhecida = documento
      ? concedentePorDocumento.get(documento)
      : (semDocumentoPorNome.get(chaveNome) ?? porNome.get(chaveNome));
    let convenioId = codigo ? porNumero.get(codigo) : undefined;
    if (!convenioId) {
      const porProc = processo ? porProcesso.get(processo) : undefined;
      const porDoc = documento && inicio ? porDocumentoInicio.get(`${documento}|${inicio}`) : undefined;
      convenioId = codigo ? (semCodigo(porProc) ?? semCodigo(porDoc)) : (porProc ?? porDoc);
    }
    // Negociação (comum nos públicos) sem código, processo nem CNPJ com início: o convênio é
    // o que a mesma concedente tem em tramitação, sem número. A linha da aba mais nova
    // atualiza a da mais antiga.
    const pelaConcedente = !codigo && !processo && !(documento && inicio);
    if (pelaConcedente) {
      convenioId = concedenteConhecida ? negociacaoPorConcedente.get(concedenteConhecida) : undefined;
      if (convenioId && usados.has(convenioId)) {
        avisos.push(`sem código, processo ou CNPJ: atualiza a negociação de "${usados.get(convenioId)}"`);
      }
    } else if (convenioId && usados.has(convenioId)) {
      rejeitar(`repete o convênio de "${usados.get(convenioId)}" (mesmo código, processo ou CNPJ e início)`);
      continue;
    }
    if (!processo && l.processo) avisos.push(`processo "${l.processo}" fora do formato do SEI; guardado como está`);

    // --- Concedente ---
    let uf = normalizarTexto(l.uf);
    uf = MAPA_UF[uf] ?? uf;
    if (uf && !UFS.has(uf)) {
      avisos.push(`UF "${l.uf}" inválida; ficou em branco`);
      uf = '';
    }
    const tipo = tipoConcedente(l);
    if (tipo === 'outros' && l.tipo) avisos.push(`tipo "${l.tipo}" sem correspondência; ficou "Outros"`);
    // Só o que veio preenchido: a planilha em branco não apaga o que já existe.
    const dadosConcedente: Dados = Object.fromEntries(
      Object.entries({
        razao_social: (l.razaoSocial || l.nomeFantasia).slice(0, 255),
        nome_fantasia: l.nomeFantasia.slice(0, 255),
        uf,
        cidade: l.cidade.slice(0, 100),
        ramo_atividade: l.ramo.slice(0, 255),
        email: /^\S+@\S+\.\S+$/.test(l.email) ? l.email : '',
      }).filter(([, v]) => v !== ''),
    );
    dadosConcedente.tipo = tipo;

    let concedenteId = concedenteConhecida;
    if (concedenteId) {
      const atual = estado.concedentes.get(concedenteId) as Dados;
      // O tipo "Outros" não substitui um tipo já conhecido.
      if (tipo === 'outros' && atual.tipo) delete dadosConcedente.tipo;
      estado.concedentes.set(concedenteId, { ...atual, ...dadosConcedente });
    } else {
      concedenteId = novoId();
      const nova: Dados = {
        documento: documento || null,
        nome_fantasia: '',
        email: '',
        uf: '',
        cidade: '',
        ramo_atividade: '',
        ...dadosConcedente,
      };
      indexarConcedente(concedenteId, nova);
      estado.concedentes.set(concedenteId, nova);
      concedentesNovas.set(concedenteId, '');
    }
    concedentesTocadas.add(concedenteId);

    // --- Convênio ---
    const existente = convenioId ? estado.convenios.get(convenioId) : undefined;
    if (existente && ORDEM[situacao] < ORDEM[existente.situacao as Situacao]) {
      // A situação não volta atrás: o que já foi finalizado ou cancelado prevalece.
      avisos.push(`planilha diz "em tramitação", mas o convênio já está "${existente.situacao as string}"; mantido`);
      situacao = existente.situacao as Situacao;
    }
    const dadosConvenio: Dados = {
      concedente_id: concedenteId,
      numero: codigo || ((existente?.numero as string | undefined) ?? ''),
      processo_sei: (processo || l.processo).slice(0, 25),
      inicio_vigencia: inicio ?? (existente?.inicio_vigencia as string | null | undefined) ?? null,
      fim_vigencia: fim ?? (existente?.fim_vigencia as string | null | undefined) ?? null,
      situacao,
      observacoes_internas: mesclarObservacoes(
        (existente?.observacoes_internas as string | undefined) ?? '',
        observacoesDaLinha(l, justificativaArquivo),
      ),
    };
    if (l.objeto) dadosConvenio.objeto = l.objeto;
    if (l.resolucao) dadosConvenio.resolucao_cep = l.resolucao.slice(0, 100);
    if (situacao === 'finalizado' && !(dadosConvenio.numero && dadosConvenio.inicio_vigencia && dadosConvenio.fim_vigencia)) {
      // Garantia das regras do Firestore: finalizado sempre tem número e datas.
      dadosConvenio.situacao = 'em_tramitacao';
    }

    if (existente && convenioId) {
      if (existente.numero && existente.numero !== dadosConvenio.numero) porNumero.delete(existente.numero as string);
      estado.convenios.set(convenioId, { ...existente, ...dadosConvenio });
      if (!originais.convenios.has(convenioId)) {
        // Criado por uma linha anterior desta mesma importação.
      } else relatorio.atualizados++;
    } else {
      convenioId = codigo && !estado.convenios.has(idConvenioPlanilha(codigo)) ? idConvenioPlanilha(codigo) : novoId();
      // D19: data de finalização desconhecida; não entra no tempo de tramitação (MS05).
      estado.convenios.set(convenioId, {
        minuta: 'padrao_uff',
        origem: l.modelo === 'publico' ? 'uff' : 'concedente',
        objeto: '',
        resolucao_cep: '',
        finalizado_em: null,
        ...dadosConvenio,
      });
      relatorio.criados++;
    }
    if (concedentesNovas.get(concedenteId) === '') concedentesNovas.set(concedenteId, convenioId);
    indexar(convenioId, estado.convenios.get(convenioId) as Dados);
    usados.set(convenioId, origem);
    conveniosTocados.add(convenioId);

    for (const motivo of avisos) relatorio.avisos.push({ origem, concedente: nome, motivo });
  }

  // As escritas saem do estado final comparado com o inicial. Uma concedente (ou negociação)
  // que aparece em várias linhas é gravada uma vez, com o dado da aba mais nova; e importar de
  // novo o mesmo arquivo não grava nada.
  const grupoDoConvenio = new Map<string, Escrita[]>();
  const conveniosDaConcedente = new Map<string, string[]>();
  for (const [id, c] of estado.convenios) {
    const lista = conveniosDaConcedente.get(c.concedente_id as string) ?? [];
    lista.push(id);
    conveniosDaConcedente.set(c.concedente_id as string, lista);
  }
  // A cópia do nome nos convênios (ARCHITECTURE §3) acompanha a concedente.
  for (const concedenteId of concedentesTocadas) {
    const nomeFinal = nomeDe(estado.concedentes.get(concedenteId) as Dados);
    for (const id of conveniosDaConcedente.get(concedenteId) ?? []) {
      const c = estado.convenios.get(id) as Dados;
      if (c.concedente_nome !== nomeFinal) {
        estado.convenios.set(id, { ...c, concedente_nome: nomeFinal });
        conveniosTocados.add(id);
      }
    }
  }
  for (const id of conveniosTocados) {
    const final = estado.convenios.get(id) as Dados;
    relatorio.situacoes[final.situacao as Situacao]++;
    const antes = originais.convenios.get(id);
    if (!antes) {
      grupoDoConvenio.set(id, [{ colecao: 'convenios', id, dados: final, novo: true, historico: { acao: 'importado_planilha', campos: [] } }]);
      continue;
    }
    const mudados = camposMudados(antes, final);
    if (!mudados.length) continue;
    const campos = mudados.filter((k) => k !== 'concedente_nome');
    grupoDoConvenio.set(id, [
      {
        colecao: 'convenios',
        id,
        dados: Object.fromEntries(mudados.map((k) => [k, final[k]])),
        novo: false,
        ...(campos.length ? { historico: { acao: 'reimportado_planilha' as const, campos } } : {}),
      },
    ]);
  }
  // Concedente nova vai no mesmo lote do primeiro convênio dela: entra junto ou não entra.
  for (const [concedenteId, convenioId] of concedentesNovas) {
    const escrita: Escrita = {
      colecao: 'concedentes',
      id: concedenteId,
      dados: estado.concedentes.get(concedenteId) as Dados,
      novo: true,
    };
    grupoDoConvenio.get(convenioId)?.unshift(escrita) ?? grupoDoConvenio.set(convenioId, [escrita]);
  }
  const grupos: Escrita[][] = [];
  for (const concedenteId of concedentesTocadas) {
    if (concedentesNovas.has(concedenteId)) continue;
    const antes = originais.concedentes.get(concedenteId) as Dados;
    const final = estado.concedentes.get(concedenteId) as Dados;
    const mudados = camposMudados(antes, final);
    if (mudados.length) {
      grupos.push([
        { colecao: 'concedentes', id: concedenteId, dados: Object.fromEntries(mudados.map((k) => [k, final[k]])), novo: false },
      ]);
    }
  }
  grupos.push(...grupoDoConvenio.values());

  return { relatorio, grupos };
}

// ---------- Relatório ----------

function celula(valor: string): string {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** CSV com rejeitados e avisos; separador `;` e BOM, para o Excel abrir direto. */
export function relatorioPlanilhasCsv(relatorio: RelatorioPlanilhas): string {
  const linhas = [
    ['situação', 'origem', 'concedente', 'motivo'],
    ...relatorio.rejeitados.map((l) => ['rejeitado', l.origem, l.concedente, l.motivo]),
    ...relatorio.avisos.map((l) => ['aviso', l.origem, l.concedente, l.motivo]),
  ];
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}
