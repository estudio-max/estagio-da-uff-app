/**
 * RF07: importação dos convênios do estagio.uff.br (exportação XML do Drupal).
 * Porta de `convenios/importacao.py` da versão Django.
 *
 * Idempotente: a chave é o nó do Drupal (`id_drupal`); rodar de novo atualiza em vez de
 * duplicar. Nada é inventado: registro sem dado obrigatório vai para o relatório como
 * rejeitado, e o que entra com ressalva vira aviso. O valor original do Drupal fica nas
 * observações internas.
 *
 * Este módulo não toca no Firestore: recebe o estado atual (concedentes e convênios) e devolve
 * o que gravar. A gravação fica em `importacaoFirestore.ts`.
 */
import { decodeHTML, decodeXML } from 'entities';
import { XMLParser } from 'fast-xml-parser';
import { documentoValido, normalizar } from './documentos.js';

export const VIGENCIA_MAXIMA_ANOS = 5; // RN07 (premissa D15)

export const UFS = new Set([
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]);

// D11 (premissa, a confirmar com a PROGRAD): tipo do Drupal -> 9 tipos oficiais (RN05).
// O Drupal não distingue empresa de microempresa nem ensino de órgão público.
export const MAPA_TIPOS: Record<string, string> = {
  PRIVADA: 'empresa_privada',
  PPRIVADA: 'empresa_privada',
  PÚBLICA: 'orgao_publico',
  INTEGRADORA: 'agente_integracao',
  'AGENTE DE INTEGRAÇÃO': 'agente_integracao',
  'PROFISSIONAL LIBERAL': 'profissional_liberal',
  'ONG/OSCIP': 'ong_oscip',
  OSCIP: 'ong_oscip',
  'ORGANIZAÇÃO DA SOCIEDADE CIVIL': 'ong_oscip',
  'ORGANIZAÇÃO DE SOCIEDADE CIVIL': 'ong_oscip',
};
const MAPA_UF: Record<string, string> = { 'RIO DE JANEIRO': 'RJ', BH: 'MG' };

/** Um nó do export. Datas em ISO (`aaaa-mm-dd`), como no Firestore; `null` se ausente. */
export interface Registro {
  idDrupal: number;
  titulo: string;
  numero: string;
  processo: string;
  inicio: string | null;
  fim: string | null;
  /** Texto de data que não pôde ser lido (o registro é rejeitado). */
  dataIlegivel: string | null;
  cidade: string;
  uf: string;
  ramo: string;
  objeto: string;
  tipoDrupal: string;
  cnpj: string;
  corpo: string;
  email: string;
  resolucao: string;
  resolucaoUrl: string;
}

export interface LinhaRelatorio {
  no: number;
  titulo: string;
  motivo: string;
}

export interface Relatorio {
  lidos: number;
  criados: number;
  atualizados: number;
  rejeitados: LinhaRelatorio[];
  avisos: LinhaRelatorio[];
  tipos: Record<string, number>;
}

type Dados = Record<string, unknown>;

/** Concedentes e convênios já gravados, por id do documento. É alterado pela importação. */
export interface Estado {
  concedentes: Map<string, Dados>;
  convenios: Map<string, Dados>;
}

export interface Escrita {
  colecao: 'concedentes' | 'convenios';
  id: string;
  /** Campos a gravar (mesclados com o documento, se ele existir). */
  dados: Dados;
  novo: boolean;
  /** RF08: registro de histórico a criar junto, só para convênio. */
  historico?: { acao: 'importado' | 'reimportado'; campos: string[] };
}

export interface Plano {
  relatorio: Relatorio;
  /** Escritas de cada registro aceito, juntas para irem no mesmo lote. */
  grupos: Escrita[][];
}

// ---------- Leitura do XML ----------

/** Tira HTML e entidades: o export mistura texto com links da taxonomia. */
export function texto(valor: string): string {
  const semTags = valor.replace(/<[^>]+>/g, ' ');
  return decodeHTML(semTags).replace(/\s+/g, ' ').trim();
}

const iso = (ano: number, mes: number, dia: number): string =>
  `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/**
 * dd/mm/aa do Drupal. Ano de 2 dígitos é sempre 20aa (convênios a partir de 2015).
 * Vazio vira `null`; texto que não é data lança erro.
 */
export function lerData(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(v);
  if (!m) throw new Error(`data ilegível: ${v}`);
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), 2000 + Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) throw new Error(`data ilegível: ${v}`);
  return iso(ano, mes, dia);
}

/** dd/mm/aaaa, para as mensagens. */
const dataBr = (isoData: string): string => isoData.split('-').reverse().join('/');

/** Soma anos a uma data ISO; 29/02 caindo em ano não bissexto vira 01/03 (como no Django). */
export function somarAnos(isoData: string, anos: number): string {
  const [a, m, d] = isoData.split('-').map(Number);
  const alvo = new Date(Date.UTC(a + anos, m - 1, d));
  return alvo.getUTCMonth() === m - 1 ? iso(a + anos, m, d) : iso(a + anos, 3, 1);
}

function nosDoXml(arvore: unknown): Dados[] {
  const nos: Dados[] = [];
  const visitar = (valor: unknown): void => {
    if (Array.isArray(valor)) return valor.forEach(visitar);
    if (valor === null || typeof valor !== 'object') return;
    for (const [chave, filho] of Object.entries(valor)) {
      if (chave === 'node' && Array.isArray(filho)) nos.push(...(filho as Dados[]));
      else visitar(filho);
    }
  };
  visitar(arvore);
  return nos;
}

export function lerXml(xml: string): Registro[] {
  const parser = new XMLParser({
    parseTagValue: false,
    trimValues: false,
    isArray: (nome) => nome === 'node',
    // O conteúdo de cada campo chega cru: HTML dentro do campo não vira elemento.
    stopNodes: ['*.node.*'],
  });
  return nosDoXml(parser.parse(xml)).map((no) => {
    const campo = (tag: string): string => {
      const v = no[tag];
      if (typeof v !== 'string') return '';
      return decodeXML(v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
    };
    let dataIlegivel: string | null = null;
    const data = (tag: string): string | null => {
      try {
        return lerData(campo(tag));
      } catch {
        dataIlegivel ??= campo(tag);
        return null;
      }
    };
    const resolucaoBruta = campo('Resolu-o-CEP');
    const link = /href="(https?:\/\/[^"]+)"/.exec(resolucaoBruta);
    const email = /mailto:([^"'>]+)/.exec(campo('Email'));
    const ultimoSegmento = campo('url').replace(/\/+$/, '').split('/').pop() ?? '';
    return {
      idDrupal: /^\d+$/.test(ultimoSegmento) ? Number(ultimoSegmento) : 0,
      titulo: texto(campo('Titulo')),
      numero: texto(campo('Nr-CONVENIO')),
      processo: texto(campo('N-MERO-DO-PROCESSO')),
      inicio: data('In-cio'),
      fim: data('Termino'),
      dataIlegivel,
      cidade: texto(campo('Cidade')),
      uf: texto(campo('UF')).toUpperCase(),
      ramo: texto(campo('Ramo-de-atividade')),
      objeto: texto(campo('Objeto')),
      tipoDrupal: texto(campo('Tipo-da-Institui-o')),
      cnpj: normalizar(texto(campo('CNPJ'))),
      corpo: texto(campo('Corpo')),
      email: email ? email[1] : texto(campo('Email')),
      resolucao: texto(resolucaoBruta),
      resolucaoUrl: link ? link[1] : '',
    };
  });
}

// ---------- Regras ----------

export function motivoDeRejeicao(r: Registro): string | null {
  if (!r.idDrupal) return 'sem o nó do Drupal (campo url)';
  if (!r.numero) return 'sem nº do convênio';
  if (r.dataIlegivel !== null) return `data ilegível: ${r.dataIlegivel}`;
  if (!r.inicio || !r.fim) return 'sem data de início ou de término';
  if (r.fim <= r.inicio) {
    return `término (${dataBr(r.fim)}) não é depois do início (${dataBr(r.inicio)})`;
  }
  if (r.cnpj && !documentoValido(r.cnpj)) {
    return `CNPJ/CPF com dígito verificador inválido: ${r.cnpj}`;
  }
  return null;
}

function observacoes(r: Registro): string {
  const linhas = [`Importado do estagio.uff.br (nó ${r.idDrupal}). Tipo no Drupal: ${r.tipoDrupal}.`];
  if (r.corpo && r.corpo !== r.objeto) linhas.push(`Corpo no Drupal: ${r.corpo}`);
  return linhas.join('\n');
}

const nomeDe = (c: Dados): string =>
  (c.nome_fantasia as string | undefined) || (c.razao_social as string | undefined) || '';

const caixaBaixa = (s: string): string => s.toLocaleLowerCase('pt-BR');

const camposMudados = (antes: Dados, dados: Dados, ignorar: string[] = []): string[] =>
  Object.keys(dados).filter((k) => !ignorar.includes(k) && antes[k] !== dados[k]);

/** Id do convênio importado: estável, para a reimportação achar o mesmo documento. */
export const idConvenio = (idDrupal: number): string => `drupal-${idDrupal}`;

/**
 * Decide o que gravar. Altera `estado` como se as escritas já tivessem sido feitas, para que
 * os registros seguintes vejam os anteriores (número repetido, concedente já criada).
 */
export function planejarImportacao(
  registros: Registro[],
  estado: Estado,
  novoIdConcedente: () => string,
): Plano {
  const relatorio: Relatorio = {
    lidos: registros.length,
    criados: 0,
    atualizados: 0,
    rejeitados: [],
    avisos: [],
    tipos: {},
  };
  const grupos: Escrita[][] = [];

  const concedentePorDocumento = new Map<string, string>();
  const semDocumentoPorNome = new Map<string, string>();
  for (const [id, c] of estado.concedentes) {
    if (c.documento) concedentePorDocumento.set(c.documento as string, id);
    else {
      const chave = caixaBaixa((c.razao_social as string | undefined) ?? '');
      if (!semDocumentoPorNome.has(chave)) semDocumentoPorNome.set(chave, id);
    }
  }
  const convenioPorIdDrupal = new Map<number, string>();
  const convenioPorNumero = new Map<string, string>();
  for (const [id, c] of estado.convenios) {
    if (typeof c.id_drupal === 'number') convenioPorIdDrupal.set(c.id_drupal, id);
    if (c.numero) convenioPorNumero.set(c.numero as string, id);
  }
  const concedentesRenomeadas = new Set<string>();

  for (const r of registros) {
    relatorio.tipos[r.tipoDrupal] = (relatorio.tipos[r.tipoDrupal] ?? 0) + 1;
    const rejeitar = (motivo: string): void => {
      relatorio.rejeitados.push({ no: r.idDrupal, titulo: r.titulo, motivo });
    };
    const motivo = motivoDeRejeicao(r);
    if (motivo) {
      rejeitar(motivo);
      continue;
    }
    const inicio = r.inicio as string;
    const fim = r.fim as string;

    const convenioId = convenioPorIdDrupal.get(r.idDrupal) ?? idConvenio(r.idDrupal);
    const donoDoNumero = convenioPorNumero.get(r.numero);
    if (donoDoNumero && donoDoNumero !== convenioId) {
      // Checado antes de mexer na concedente: o registro rejeitado não deixa rastro.
      rejeitar(`nº do convênio ${r.numero} já usado por outro registro`);
      continue;
    }

    const avisos: string[] = [];
    if (fim >= somarAnos(inicio, VIGENCIA_MAXIMA_ANOS)) {
      avisos.push(`vigência acima de ${VIGENCIA_MAXIMA_ANOS} anos (RN07)`);
    }
    const grupo: Escrita[] = [];

    // --- Concedente ---
    const tipo = MAPA_TIPOS[r.tipoDrupal.toUpperCase()] ?? 'outros';
    if (tipo === 'outros') avisos.push(`tipo "${r.tipoDrupal}" sem correspondência; ficou "Outros"`);
    let uf = MAPA_UF[r.uf] ?? r.uf;
    if (!UFS.has(uf)) {
      avisos.push(`UF "${r.uf}" inválida; ficou em branco`);
      uf = '';
    }
    const dadosConcedente: Dados = {
      razao_social: r.titulo.slice(0, 255),
      tipo,
      uf,
      cidade: r.cidade.slice(0, 100),
      ramo_atividade: r.ramo.slice(0, 255),
    };
    if (r.email) dadosConcedente.email = r.email;

    let concedenteId: string | undefined;
    if (r.cnpj) {
      concedenteId = concedentePorDocumento.get(r.cnpj);
      if (concedenteId) {
        const atual = estado.concedentes.get(concedenteId) as Dados;
        if (camposMudados(atual, dadosConcedente).length) {
          const nomeAntes = nomeDe(atual);
          const nova = { ...atual, ...dadosConcedente };
          estado.concedentes.set(concedenteId, nova);
          grupo.push({ colecao: 'concedentes', id: concedenteId, dados: dadosConcedente, novo: false });
          if (nomeDe(nova) !== nomeAntes) concedentesRenomeadas.add(concedenteId);
        }
      } else {
        concedenteId = novoIdConcedente();
        concedentePorDocumento.set(r.cnpj, concedenteId);
      }
    } else {
      // D20: sem CNPJ, agrupa pelo nome exato (sem diferenciar caixa) para não criar uma
      // concedente por renovação.
      avisos.push('sem CNPJ: concedente criada sem documento');
      const chave = caixaBaixa(dadosConcedente.razao_social as string);
      concedenteId = semDocumentoPorNome.get(chave);
      if (!concedenteId) {
        concedenteId = novoIdConcedente();
        semDocumentoPorNome.set(chave, concedenteId);
      }
    }
    if (!estado.concedentes.has(concedenteId)) {
      const nova: Dados = {
        documento: r.cnpj || null,
        nome_fantasia: '',
        email: '',
        ...dadosConcedente,
      };
      estado.concedentes.set(concedenteId, nova);
      grupo.push({ colecao: 'concedentes', id: concedenteId, dados: nova, novo: true });
    }
    const concedente = estado.concedentes.get(concedenteId) as Dados;

    // --- Convênio ---
    const dadosConvenio: Dados = {
      concedente_id: concedenteId,
      concedente_nome: nomeDe(concedente),
      numero: r.numero,
      processo_sei: r.processo.slice(0, 25),
      inicio_vigencia: inicio,
      fim_vigencia: fim,
      situacao: 'finalizado',
      objeto: r.objeto,
      resolucao_cep: r.resolucao.slice(0, 100),
      resolucao_cep_url: r.resolucaoUrl,
      observacoes_internas: observacoes(r),
      id_drupal: r.idDrupal,
    };
    const existente = estado.convenios.get(convenioId);
    if (existente) {
      const campos = camposMudados(existente, dadosConvenio, ['concedente_nome']);
      if (campos.length || existente.concedente_nome !== dadosConvenio.concedente_nome) {
        grupo.push({
          colecao: 'convenios',
          id: convenioId,
          dados: dadosConvenio,
          novo: false,
          ...(campos.length ? { historico: { acao: 'reimportado' as const, campos } } : {}),
        });
      }
      if (existente.numero && existente.numero !== r.numero) {
        convenioPorNumero.delete(existente.numero as string);
      }
      estado.convenios.set(convenioId, { ...existente, ...dadosConvenio });
      relatorio.atualizados++;
    } else {
      // D19: data de finalização desconhecida; não entra no tempo de tramitação (MS05).
      const novo: Dados = { minuta: 'padrao_uff', origem: 'concedente', finalizado_em: null, ...dadosConvenio };
      estado.convenios.set(convenioId, novo);
      grupo.push({
        colecao: 'convenios',
        id: convenioId,
        dados: novo,
        novo: true,
        historico: { acao: 'importado', campos: [] },
      });
      relatorio.criados++;
    }
    convenioPorIdDrupal.set(r.idDrupal, convenioId);
    convenioPorNumero.set(r.numero, convenioId);

    for (const motivoAviso of avisos) {
      relatorio.avisos.push({ no: r.idDrupal, titulo: r.titulo, motivo: motivoAviso });
    }
    if (grupo.length) grupos.push(grupo);
  }

  // A cópia do nome nos convênios (ARCHITECTURE §3) acompanha a concedente renomeada.
  for (const [id, c] of estado.convenios) {
    if (!concedentesRenomeadas.has(c.concedente_id as string)) continue;
    const nome = nomeDe(estado.concedentes.get(c.concedente_id as string) as Dados);
    if (c.concedente_nome === nome) continue;
    estado.convenios.set(id, { ...c, concedente_nome: nome });
    grupos.push([{ colecao: 'convenios', id, dados: { concedente_nome: nome }, novo: false }]);
  }

  return { relatorio, grupos };
}

// ---------- Relatório ----------

function celula(valor: string | number): string {
  const s = String(valor);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com rejeitados e avisos; separador `;` e BOM, para o Excel abrir direto. */
export function relatorioCsv(relatorio: Relatorio): string {
  const linhas = [
    ['situação', 'nó no Drupal', 'título', 'motivo'],
    ...relatorio.rejeitados.map((l) => ['rejeitado', l.no, l.titulo, l.motivo]),
    ...relatorio.avisos.map((l) => ['aviso', l.no, l.titulo, l.motivo]),
  ];
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}
