// Planilhas fictícias nos três formatos reais (D8), para os testes. Nenhum dado real:
// nomes inventados, CNPJs gerados com dígito verificador válido.
import ExcelJS from 'exceljs';

export const CABECALHO_PRIVADOS = [
  'Solicitante', 'E-mail', 'Código', 'Data SEI', 'Despacho', 'ETAPA', 'Razão social', 'Nome Fantasia',
  'Início', 'Término', 'Número do Processo', 'Cidade', 'UF', 'TIPO', 'Ramo de Atividade', 'Objeto',
  'CNPJ', 'Curso', 'Curso2', 'E-mail empresa', 'E-mail - representante', 'E-mail testemunha', 'Tipo',
];
export const CABECALHO_PUBLICOS = [
  'CÓDIGO', 'RAZÃO SOCIAL', 'STATUS', 'INÍCIO', 'TÉRMINO', 'DURAÇÃO', 'Nº PROCESSO SEI', 'UF',
  'TIPO DA INSTITUIÇÃO', 'RAMO DE ATIVIDADE', 'OBJETO', 'CIDADE', 'CNPJ', 'RESOLUÇÃO CEPEx Nº',
  'TIPO DE INSTRUMENTO', 'OBSERVAÇÕES',
];
export const CABECALHO_PUBLICOS_2023 = [
  'CÓDIGO', 'RAZÃO SOCIAL', 'NOME FANTASIA', 'CNPJ', 'NATUREZA JURÍDICA', 'CURSO CONTEMPLADO',
  'MUNICÍPIO CURSO UFF', 'ABRANGÊNCIA GEOGRÁFICA', 'MODALIDADE ESTÁGIO', 'DURAÇÃO', 'INÍCIO', 'TÉRMINO',
  'LOCALIDADE-RJ', 'OUTRA LOCALIDADE', 'UF', 'RAMO ATIVIDADE', 'Nº PROCESSO SEI', 'RESOLUÇÃO CEPEx Nº',
  'OBJETO', 'INSTRUMENTO', 'TIPO ASSINATURA INSTRUMENTO', 'E-MAIL CONCEDENTE',
];

type Linha = Record<string, ExcelJS.CellValue>;

/** Data como o Excel guarda (meia-noite UTC). */
export const data = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

function preencher(ws: ExcelJS.Worksheet, cabecalho: string[], linhaCabecalho: number, linhas: (Linha & { oculta?: boolean })[]): void {
  ws.getRow(linhaCabecalho).values = cabecalho;
  linhas.forEach((l, i) => {
    const row = ws.getRow(linhaCabecalho + 1 + i);
    for (const [coluna, valor] of Object.entries(l)) {
      if (coluna === 'oculta') continue;
      const c = cabecalho.indexOf(coluna);
      if (c < 0) throw new Error(`coluna desconhecida: ${coluna}`);
      row.getCell(c + 1).value = valor as ExcelJS.CellValue;
    }
    if (l.oculta) row.hidden = true;
  });
}

export interface AbasFicticias {
  privados?: Record<number, Linha[]>;
  publicos?: Record<number, Linha[]>;
  publicos2023?: (Linha & { oculta?: boolean })[];
  arquivados?: { processo: string; justificativa: string }[];
  outras?: string[];
}

export async function planilhaFicticia(abas: AbasFicticias): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const [ano, linhas] of Object.entries(abas.privados ?? {})) {
    preencher(wb.addWorksheet(`Privados ${ano}`), CABECALHO_PRIVADOS, 1, linhas);
  }
  for (const [ano, linhas] of Object.entries(abas.publicos ?? {})) {
    const ws = wb.addWorksheet(`Convênios ${ano}`);
    ws.getCell('A1').value = `PU-40/${ano}`; // sobra acima do cabeçalho, como na real
    preencher(ws, CABECALHO_PUBLICOS, 2, linhas);
  }
  if (abas.publicos2023) {
    const ws = wb.addWorksheet('Convênios 2023');
    ws.mergeCells('A1:C7');
    ws.getCell('A1').value = 'CADASTRO DE CONVÊNIOS PÚBLICOS - 2023';
    preencher(ws, CABECALHO_PUBLICOS_2023, 9, abas.publicos2023);
  }
  if (abas.arquivados) {
    const ws = wb.addWorksheet('Processos arquivados');
    ws.getRow(1).values = ['DATA', 'RAZÃO SOCIAL', 'N° PROCESSO', 'JUSTIFICATIVA ARQUIVAMENTO'];
    abas.arquivados.forEach((a, i) => {
      ws.getRow(i + 2).values = [data('2024-01-10'), 'Fictícia', a.processo, a.justificativa];
    });
  }
  for (const nome of abas.outras ?? []) wb.addWorksheet(nome).getCell('A1').value = 'qualquer coisa';
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** CNPJs fictícios com dígito verificador válido. */
export const CNPJ = ['11222333000181', '11444777000161', '22333444000181', '33444555000181', '44555666000181'];
