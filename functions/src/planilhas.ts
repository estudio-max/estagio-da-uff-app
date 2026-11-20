/**
 * RF07: leitura das planilhas internas da Divisão (convênios privados e públicos).
 *
 * Só converte as células em registros; as regras ficam em `importacaoPlanilhas.ts`.
 * Formatos conhecidos (D8, analisados em 19 e 20/11/2026):
 * - **Privados AAAA**: cabeçalho na linha 1; colunas Código, Razão social, Nome Fantasia,
 *   Início, Término, Número do Processo, Cidade, UF, TIPO, Ramo de Atividade, Objeto, CNPJ,
 *   ETAPA, E-mail empresa e "Tipo" (novo ou renovação).
 * - **Convênios AAAA** (públicos de 2024 em diante): cabeçalho na linha 2, com STATUS em relato.
 * - **Convênios 2023** (públicos): bloco de título nas linhas 1 a 7 e cabeçalho na linha 9.
 * - **Processos arquivados**: Nº do processo e justificativa do arquivamento.
 * O cabeçalho é achado pela primeira linha que tem a coluna CNPJ; o nome das colunas é
 * comparado sem acento nem caixa. Linhas ocultas por filtro também entram.
 */
import ExcelJS from 'exceljs';

export type Modelo = 'privado' | 'publico';

/** Uma linha de convênio, com o texto das células já limpo. Datas em ISO ou `null`. */
export interface LinhaPlanilha {
  modelo: Modelo;
  aba: string;
  ano: number;
  linha: number;
  codigo: string;
  razaoSocial: string;
  nomeFantasia: string;
  documento: string;
  inicio: string | null;
  fim: string | null;
  /** Texto de data que não pôde ser lido. */
  dataIlegivel: string | null;
  processo: string;
  cidade: string;
  uf: string;
  tipo: string;
  ramo: string;
  objeto: string;
  /** ETAPA (privados) ou STATUS (públicos), como está na planilha. */
  andamento: string;
  email: string;
  resolucao: string;
  instrumento: string;
  observacoes: string;
}

export interface LeituraPlanilhas {
  linhas: LinhaPlanilha[];
  /** Processo SEI normalizado → justificativa do arquivamento. */
  arquivados: Map<string, string>;
  /** Abas que não são de convênio de 2022 em diante (ficam fora, por decisão do cliente). */
  abasIgnoradas: string[];
}

/** Decisão do cliente em 19/11/2026: só os convênios das abas de 2022 em diante. */
export const ANO_MINIMO = 2022;

/** Sem acento, em maiúsculas, espaços simples. "Nº" vira "NO". */
export const normalizarTexto = (s: string): string =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Nome normalizado da coluna → campo. */
const COLUNAS: Record<string, keyof LinhaPlanilha> = {
  CODIGO: 'codigo',
  'RAZAO SOCIAL': 'razaoSocial',
  'NOME FANTASIA': 'nomeFantasia',
  CNPJ: 'documento',
  INICIO: 'inicio',
  'DATA DE INICIO': 'inicio',
  TERMINO: 'fim',
  'DATA DE TERMINO': 'fim',
  'NUMERO DO PROCESSO': 'processo',
  'NO PROCESSO SEI': 'processo',
  CIDADE: 'cidade',
  'LOCALIDADE-RJ': 'cidade',
  UF: 'uf',
  TIPO: 'tipo',
  'TIPO DA INSTITUICAO': 'tipo',
  'NATUREZA JURIDICA': 'tipo',
  'RAMO DE ATIVIDADE': 'ramo',
  'RAMO ATIVIDADE': 'ramo',
  OBJETO: 'objeto',
  ETAPA: 'andamento',
  STATUS: 'andamento',
  'E-MAIL EMPRESA': 'email',
  'E-MAIL CONCEDENTE': 'email',
  'RESOLUCAO CEPEX NO': 'resolucao',
  'TIPO DE INSTRUMENTO': 'instrumento',
  INSTRUMENTO: 'instrumento',
  OBSERVACOES: 'observacoes',
};

/** Texto de uma célula do exceljs (rich text, hyperlink, fórmula ou valor simples). */
export function textoCelula(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((p) => p.text).join('').trim();
    if ('text' in v && typeof v.text === 'string') return v.text.trim();
    if ('result' in v) return textoCelula(v.result as ExcelJS.CellValue);
    return '';
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

const iso = (a: number, m: number, d: number): string =>
  `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function dataValida(a: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? iso(a, m, d) : null;
}

/**
 * Data de uma célula: data do Excel, número de série (entre 1955 e 2118) ou texto
 * `dd/mm/aaaa` (ou `dd/mm/aa`, sempre 20aa). Vazio é `null`; o resto lança erro.
 */
export function lerDataCelula(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object' && !(v instanceof Date) && 'result' in v) {
    return lerDataCelula(v.result as ExcelJS.CellValue);
  }
  if (v instanceof Date) {
    const ano = v.getUTCFullYear();
    if (Number.isNaN(v.getTime()) || ano < 1900 || ano > 2100) throw new Error('data ilegível');
    return iso(ano, v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) throw new Error(`data ilegível: ${v}`);
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const s = textoCelula(v);
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  const data = m && dataValida(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
  if (!data) throw new Error(`data ilegível: ${s}`);
  return data;
}

/**
 * CNPJ/CPF da célula, sem máscara. Número (o Excel perde o zero à esquerda) é completado
 * até 14 dígitos, ou 11 se só couber como CPF.
 */
export function lerDocumento(v: ExcelJS.CellValue): string {
  if (typeof v === 'number') {
    const s = String(Math.round(v));
    return s.length > 11 ? s.padStart(14, '0') : s.padStart(11, '0');
  }
  // Tira máscara e sujeira: hífen invisível, travessão, vírgula, colchete.
  return textoCelula(v)
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

/** Abas de convênio: "Privados AAAA" ou "Convênios AAAA". */
function classificarAba(nome: string): { modelo: Modelo; ano: number } | null {
  const m = /^(PRIVADOS|CONVENIOS) (\d{4})$/.exec(normalizarTexto(nome));
  if (!m) return null;
  return { modelo: m[1] === 'PRIVADOS' ? 'privado' : 'publico', ano: Number(m[2]) };
}

function linhaDoCabecalho(ws: ExcelJS.Worksheet): number | null {
  for (let n = 1; n <= Math.min(15, ws.rowCount); n++) {
    const row = ws.getRow(n);
    for (let c = 1; c <= row.cellCount; c++) {
      if (normalizarTexto(textoCelula(row.getCell(c).value)) === 'CNPJ') return n;
    }
  }
  return null;
}

function lerAbaDeConvenios(ws: ExcelJS.Worksheet, modelo: Modelo, ano: number): LinhaPlanilha[] {
  const cab = linhaDoCabecalho(ws);
  if (!cab) return [];
  const colunas = new Map<number, keyof LinhaPlanilha>();
  let colunaOutraLocalidade: number | null = null;
  ws.getRow(cab).eachCell((cell, col) => {
    const bruto = textoCelula(cell.value);
    // Nos privados há "TIPO" (natureza) e "Tipo" (novo ou renovação): só a caixa distingue.
    const campo = bruto === 'Tipo' ? 'instrumento' : COLUNAS[normalizarTexto(bruto)];
    if (campo && ![...colunas.values()].includes(campo)) colunas.set(col, campo);
    if (normalizarTexto(bruto) === 'OUTRA LOCALIDADE') colunaOutraLocalidade = col;
  });

  const linhas: LinhaPlanilha[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= cab) return;
    const l: LinhaPlanilha = {
      modelo, aba: ws.name, ano, linha: n, codigo: '', razaoSocial: '', nomeFantasia: '', documento: '',
      inicio: null, fim: null, dataIlegivel: null, processo: '', cidade: '', uf: '', tipo: '', ramo: '',
      objeto: '', andamento: '', email: '', resolucao: '', instrumento: '', observacoes: '',
    };
    for (const [col, campo] of colunas) {
      const v = row.getCell(col).value;
      if (campo === 'inicio' || campo === 'fim') {
        try {
          l[campo] = lerDataCelula(v);
        } catch {
          l.dataIlegivel ??= textoCelula(v) || String(v);
        }
      } else if (campo === 'documento') {
        l.documento = lerDocumento(v);
      } else {
        (l[campo] as string) = textoCelula(v);
      }
    }
    if (!l.cidade && colunaOutraLocalidade) l.cidade = textoCelula(row.getCell(colunaOutraLocalidade).value);
    // Linha sem nome, código nem documento é sobra de formatação.
    if (l.razaoSocial || l.codigo || l.documento) linhas.push(l);
  });
  return linhas;
}

/** Nº do processo SEI normalizado (`23069.123456/2024-01`), ou '' se não estiver no formato. */
export function normalizarProcesso(s: string): string {
  const m = /^(\d{5})\.?(\d{6})\/?(\d{4})-?(\d{2})$/.exec(s.replace(/\s/g, ''));
  return m ? `${m[1]}.${m[2]}/${m[3]}-${m[4]}` : '';
}

function lerArquivados(ws: ExcelJS.Worksheet, arquivados: Map<string, string>): void {
  let colProcesso = 0;
  let colJustificativa = 0;
  ws.getRow(1).eachCell((cell, col) => {
    const nome = normalizarTexto(textoCelula(cell.value));
    if (nome.includes('PROCESSO')) colProcesso = col;
    if (nome.includes('JUSTIFICATIVA')) colJustificativa = col;
  });
  if (!colProcesso) return;
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const processo = normalizarProcesso(textoCelula(row.getCell(colProcesso).value));
    if (!processo) return;
    arquivados.set(processo, colJustificativa ? textoCelula(row.getCell(colJustificativa).value) : '');
  });
}

/** Lê um ou mais arquivos (.xlsx ou .xlsm). As macros do .xlsm não são executadas. */
export async function lerPlanilhas(arquivos: Buffer[]): Promise<LeituraPlanilhas> {
  const leitura: LeituraPlanilhas = { linhas: [], arquivados: new Map(), abasIgnoradas: [] };
  for (const arquivo of arquivos) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
    for (const ws of wb.worksheets) {
      if (normalizarTexto(ws.name).includes('ARQUIVAD')) {
        lerArquivados(ws, leitura.arquivados);
        continue;
      }
      const aba = classificarAba(ws.name);
      if (!aba || aba.ano < ANO_MINIMO) {
        leitura.abasIgnoradas.push(ws.name);
        continue;
      }
      leitura.linhas.push(...lerAbaDeConvenios(ws, aba.modelo, aba.ano));
    }
  }
  return leitura;
}
