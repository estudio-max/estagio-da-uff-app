// RF07: importação das planilhas internas (D8, D28). Não há porta do Django para este caso:
// os testes cobrem as regras decididas em 19 e 20/11/2026, com planilhas fictícias geradas
// nos três formatos reais. O caminho no Firestore está em importacaoPlanilhas.emulador.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Estado } from './importacao.js';
import {
  type PlanoPlanilhas,
  mesclarObservacoes,
  normalizarCodigo,
  planejarImportacaoPlanilhas,
  relatorioPlanilhasCsv,
  situacaoPrivado,
  tipoConcedente,
} from './importacaoPlanilhas.js';
import { type LinhaPlanilha, lerDataCelula, lerDocumento, lerPlanilhas } from './planilhas.js';
import { CNPJ, data, planilhaFicticia } from './planilhasFicticias.js';

const HOJE = '2026-11-20';
const estadoVazio = (): Estado => ({ concedentes: new Map(), convenios: new Map() });

let proximo = 0;
async function planejar(abas: Parameters<typeof planilhaFicticia>[0], estado = estadoVazio()): Promise<PlanoPlanilhas & { estado: Estado }> {
  const leitura = await lerPlanilhas([await planilhaFicticia(abas)]);
  return { ...planejarImportacaoPlanilhas(leitura, estado, HOJE, () => `id${proximo++}`), estado };
}

const convenios = (e: Estado) => [...e.convenios.values()];
const porNumero = (e: Estado, numero: string) => convenios(e).find((c) => c.numero === numero);
const motivos = (lista: { motivo: string }[]): string => lista.map((l) => l.motivo).join(' | ');

const privado = (extra: Record<string, unknown> = {}) => ({
  Código: 'PR-001/2025',
  ETAPA: 'PUBLICADO/CONCLUÍDO',
  'Razão social': 'Empresa Fictícia Ltda',
  Início: data('2025-03-01'),
  Término: data('2030-02-28'),
  'Número do Processo': '23069.000001/2025-11',
  Cidade: 'Niterói',
  UF: 'RJ',
  TIPO: 'PRIVADA',
  CNPJ: CNPJ[0],
  ...extra,
});

// ---------- Leitura ----------

test('lê os três formatos de aba, ignora as anteriores a 2022 e as outras abas', async () => {
  const leitura = await lerPlanilhas([
    await planilhaFicticia({
      privados: { 2021: [privado({ Código: 'PR-009/2021' })], 2022: [privado()] },
      publicos: { 2025: [{ CÓDIGO: 'PU-7/2025', 'RAZÃO SOCIAL': 'Prefeitura Fictícia', CNPJ: CNPJ[1] }] },
      publicos2023: [
        { CÓDIGO: 'PU-001/2023', 'RAZÃO SOCIAL': 'Autarquia Fictícia', CNPJ: CNPJ[2], 'OUTRA LOCALIDADE': 'Rio Branco' },
        { CÓDIGO: 'PU-002/2023', 'RAZÃO SOCIAL': 'Fundação Fictícia', oculta: true },
      ],
      arquivados: [{ processo: '23069.000099/2024-01', justificativa: 'Desistência' }],
      outras: ['Atribuição de Tarefas'],
    }),
  ]);
  assert.deepEqual(
    leitura.linhas.map((l) => [l.aba, l.linha, l.codigo]),
    [
      ['Privados 2022', 2, 'PR-001/2025'],
      ['Convênios 2025', 3, 'PU-7/2025'],
      ['Convênios 2023', 10, 'PU-001/2023'],
      ['Convênios 2023', 11, 'PU-002/2023'], // linha oculta por filtro também entra
    ],
  );
  assert.deepEqual(leitura.abasIgnoradas, ['Privados 2021', 'Atribuição de Tarefas']);
  assert.equal(leitura.arquivados.get('23069.000099/2024-01'), 'Desistência');
  assert.equal(leitura.linhas[2].cidade, 'Rio Branco');
  assert.equal(leitura.linhas[0].modelo, 'privado');
  assert.equal(leitura.linhas[1].modelo, 'publico');
});

test('"TIPO" é a natureza da concedente e "Tipo" é novo ou renovação', async () => {
  const [l] = (await lerPlanilhas([await planilhaFicticia({ privados: { 2024: [privado({ Tipo: 'RENOVAÇÃO' })] } })])).linhas;
  assert.equal(l.tipo, 'PRIVADA');
  assert.equal(l.instrumento, 'RENOVAÇÃO');
});

test('datas das células', () => {
  assert.equal(lerDataCelula(data('2025-03-01')), '2025-03-01');
  assert.equal(lerDataCelula(45717), '2025-03-01'); // número de série do Excel
  assert.equal(lerDataCelula('01/03/2025'), '2025-03-01');
  assert.equal(lerDataCelula('1/3/25'), '2025-03-01');
  assert.equal(lerDataCelula(null), null);
  assert.equal(lerDataCelula(''), null);
  for (const ruim of ['06.09.22', '31/02/2025', 6694959, new Date(Date.UTC(20230, 2, 4))]) {
    assert.throws(() => lerDataCelula(ruim as never), /ilegível/, String(ruim));
  }
});

test('documento das células: zero à esquerda e sujeira', () => {
  assert.equal(lerDocumento(1222333000181), '01222333000181');
  assert.equal(lerDocumento(52998224725), '52998224725');
  assert.equal(lerDocumento('11.222.333/0001­81'), CNPJ[0]); // hífen invisível
  assert.equal(lerDocumento('11.222.333/0001–81,'), CNPJ[0]); // travessão e vírgula
});

// ---------- Regras ----------

test('ETAPA dos privados → situação (D28)', () => {
  const casos: [string, string | null][] = [
    ['PUBLICADO/CONCLUÍDO', 'finalizado'],
    ['PUBLICADO/CONCLUIDO', 'finalizado'],
    ['REGISTRADO', 'finalizado'],
    ['ENVIADO BS 26/01', 'finalizado'],
    ['ENVIADO BS - 05/08', 'finalizado'],
    ['ASSINADO POR AMBAS AS PARTES - REGISTRAR NO PORTAL ', 'finalizado'],
    ['CONCLUÍDO/ARQUIVADO', 'finalizado'],
    ['EXPIRADO/ARQUIVADO', 'finalizado'],
    ['ARQUIVADO', 'cancelado'],
    ['SEM ASSINATURA PRÓ-REITOR - ARQUIVADO', 'cancelado'],
    ['REPETIDO PR-011/2024', null],
    ['REPETIDO - 14/10/22', null],
    ['falta cadastro testemunha', 'em_tramitacao'],
    ['DISPONIBILIZADO', 'em_tramitacao'],
    ['TERMO SEM ASSINATURA PRÓ-REITOR', 'em_tramitacao'],
    ['AGUARDAR RETORNO CEPEX', 'em_tramitacao'],
    ['x', 'em_tramitacao'],
    ['', 'em_tramitacao'],
  ];
  for (const [etapa, esperado] of casos) assert.equal(situacaoPrivado(etapa), esperado, etapa);
});

test('código do convênio', () => {
  assert.equal(normalizarCodigo('PR-123/2026'), 'PR-123/2026');
  assert.equal(normalizarCodigo('pr-123-2026'), 'PR-123/2026');
  assert.equal(normalizarCodigo(' PU - 40 / 2026 '), 'PU-40/2026');
  assert.equal(normalizarCodigo('PU-040/2026'), 'PU-040/2026'); // os dígitos ficam como estão
  for (const ruim of ['', 'duplicado', '2023.1', 'PR-12/26']) assert.equal(normalizarCodigo(ruim), '', ruim);
});

test('tipo da concedente (RN05)', () => {
  const linha = (modelo: 'privado' | 'publico', tipo: string) => ({ modelo, tipo }) as LinhaPlanilha;
  const casos: [LinhaPlanilha, string][] = [
    [linha('privado', 'PRIVADA'), 'empresa_privada'],
    [linha('privado', 'PRIIVADA'), 'empresa_privada'],
    [linha('privado', 'Empresa Privada'), 'empresa_privada'],
    [linha('privado', 'SOCIEDADE EMPRESÁRIA LIMITADA'), 'empresa_privada'],
    [linha('privado', 'INTEGRADORA'), 'agente_integracao'],
    [linha('privado', 'AGENTE DE INTEGRAÇÃO'), 'agente_integracao'],
    [linha('privado', 'Profissional Liberal'), 'profissional_liberal'],
    [linha('privado', 'Organização da Sociedade Civil'), 'ong_oscip'],
    [linha('privado', 'ONG'), 'ong_oscip'],
    [linha('privado', 'OSCIP'), 'ong_oscip'],
    [linha('privado', 'MEI'), 'microempresa'],
    [linha('privado', 'INSTITUIÇÃO DE ENSINO'), 'ensino_privada'],
    [linha('privado', ''), 'outros'],
    [linha('privado', 'COOPERATIVA'), 'outros'],
    [linha('publico', 'PÚBLICA'), 'orgao_publico'],
    [linha('publico', ''), 'orgao_publico'],
    [linha('publico', 'AUTARQUIA FEDERAL'), 'orgao_publico'],
    [linha('publico', 'FUNDAÇÃO PRIVADA'), 'outros'],
  ];
  for (const [l, esperado] of casos) assert.equal(tipoConcedente(l), esperado, l.tipo);
});

test('privados: situação pela ETAPA; código e datas sozinhos não bastam', async () => {
  const { estado, relatorio } = await planejar({
    privados: {
      2025: [
        privado({ Código: 'PR-001/2025', ETAPA: 'PUBLICADO/CONCLUÍDO' }),
        privado({ Código: 'PR-002/2025', ETAPA: 'falta cadastro testemunha', 'Número do Processo': '23069.000002/2025-11' }),
        privado({ Código: 'PR-003/2025', ETAPA: 'ARQUIVADO', 'Número do Processo': '23069.000003/2025-11' }),
        privado({ Código: '', ETAPA: 'REPETIDO PR-001/2025' }),
      ],
    },
  });
  assert.equal(porNumero(estado, 'PR-001/2025')?.situacao, 'finalizado');
  assert.equal(porNumero(estado, 'PR-002/2025')?.situacao, 'em_tramitacao');
  assert.equal(porNumero(estado, 'PR-003/2025')?.situacao, 'cancelado');
  assert.equal(relatorio.criados, 3);
  assert.match(motivos(relatorio.rejeitados), /repetida/);
  // O texto original fica nas observações internas.
  assert.match(porNumero(estado, 'PR-002/2025')?.observacoes_internas as string, /etapa: falta cadastro testemunha/);
});

test('públicos: código e datas indicam finalizado; o relato vai para as observações', async () => {
  const { estado } = await planejar({
    publicos: {
      2025: [
        { CÓDIGO: 'PU-10/2025', 'RAZÃO SOCIAL': 'Prefeitura Fictícia', INÍCIO: data('2025-02-01'), TÉRMINO: data('2030-01-31'), CNPJ: CNPJ[1], STATUS: 'Publicado no BS' },
        { 'RAZÃO SOCIAL': 'Secretaria Fictícia', STATUS: 'Em 18/6 enviamos a minuta' },
      ],
    },
  });
  assert.equal(porNumero(estado, 'PU-10/2025')?.situacao, 'finalizado');
  const negociacao = convenios(estado).find((c) => c.numero === '');
  assert.equal(negociacao?.situacao, 'em_tramitacao');
  assert.equal(negociacao?.origem, 'uff');
  assert.match(negociacao?.observacoes_internas as string, /status: Em 18\/6 enviamos a minuta/);
});

test('processo arquivado cancela o que tramitava, mas não o que foi assinado', async () => {
  const { estado } = await planejar({
    privados: {
      2024: [
        privado({ Código: 'PR-001/2024', ETAPA: 'falta documentação', 'Número do Processo': '23069.000010/2024-01' }),
        privado({ Código: 'PR-002/2024', ETAPA: 'PUBLICADO/CONCLUÍDO', 'Número do Processo': '23069.000011/2024-01', CNPJ: CNPJ[1] }),
      ],
    },
    arquivados: [
      { processo: '23069.000010/2024-01', justificativa: 'Desistência da empresa' },
      { processo: '23069.000011/2024-01', justificativa: 'Concluído' },
    ],
  });
  assert.equal(porNumero(estado, 'PR-001/2024')?.situacao, 'cancelado');
  assert.match(porNumero(estado, 'PR-001/2024')?.observacoes_internas as string, /processo arquivado: Desistência/);
  assert.equal(porNumero(estado, 'PR-002/2024')?.situacao, 'finalizado');
});

test('assinado sem código ou com datas incoerentes entra em tramitação, sem se perder', async () => {
  const { estado, relatorio } = await planejar({
    privados: {
      2025: [
        privado({ Código: '', ETAPA: 'REGISTRADO' }),
        privado({ Código: 'PR-002/2025', Término: data('2025-02-28'), 'Número do Processo': '23069.000002/2025-11', CNPJ: CNPJ[1] }),
      ],
    },
  });
  assert.equal(relatorio.rejeitados.length, 0);
  assert.equal(convenios(estado).filter((c) => c.situacao === 'em_tramitacao').length, 2);
  assert.equal(porNumero(estado, 'PR-002/2025')?.inicio_vigencia, null);
  assert.match(motivos(relatorio.avisos), /falta o código ou as datas/);
  assert.match(motivos(relatorio.avisos), /não é depois do início.*ficou em tramitação e sem datas/);
});

test('ano digitado com 2 dígitos (1930) vira 2030', async () => {
  const { estado, relatorio } = await planejar({
    publicos: { 2025: [{ CÓDIGO: 'PU-1/2025', 'RAZÃO SOCIAL': 'Prefeitura Fictícia', INÍCIO: data('2025-01-29'), TÉRMINO: data('1930-01-28'), CNPJ: CNPJ[1] }] },
  });
  const c = porNumero(estado, 'PU-1/2025');
  assert.equal(c?.fim_vigencia, '2030-01-28');
  assert.equal(c?.situacao, 'finalizado');
  assert.match(motivos(relatorio.avisos), /28\/01\/1930 lido como 28\/01\/2030/);
});

test('todo finalizado tem número e datas (regras do Firestore)', async () => {
  const { estado } = await planejar({
    privados: { 2025: [privado({ Código: 'x', Início: '', Término: '' }), privado({ Código: 'PR-9/2025', Término: '' })] },
    publicos: { 2025: [{ 'RAZÃO SOCIAL': 'Órgão Fictício', INÍCIO: data('2025-01-01'), TÉRMINO: data('2030-01-01') }] },
  });
  for (const c of convenios(estado)) {
    if (c.situacao === 'finalizado') assert.ok(c.numero && c.inicio_vigencia && c.fim_vigencia && c.fim_vigencia > c.inicio_vigencia);
  }
});

// ---------- Identificação ----------

test('convênio em tramitação que depois ganha código é atualizado, não duplicado', async () => {
  const antes = await planejar({
    privados: { 2026: [privado({ Código: '', ETAPA: 'analisar cadastros', Início: '', Término: '', 'Número do Processo': '23069.000050/2026-01' })] },
  });
  assert.equal(antes.estado.convenios.size, 1);
  const depois = await planejar(
    { privados: { 2026: [privado({ Código: 'PR-050/2026', ETAPA: 'REGISTRADO', Início: data('2026-03-01'), Término: data('2031-02-28'), 'Número do Processo': '23069.000050/2026-01' })] } },
    antes.estado,
  );
  assert.equal(depois.estado.convenios.size, 1);
  assert.equal(depois.relatorio.criados, 0);
  const [c] = convenios(depois.estado);
  assert.equal(c.numero, 'PR-050/2026');
  assert.equal(c.situacao, 'finalizado');
  const escrita = depois.grupos.flat().find((e) => e.colecao === 'convenios');
  assert.deepEqual(escrita?.historico?.acao, 'reimportado_planilha');
});

test('sem código e sem processo: CNPJ com o mesmo início identifica', async () => {
  const antes = await planejar({ privados: { 2025: [privado({ Código: '', ETAPA: 'cadastro ok', 'Número do Processo': '' })] } });
  const depois = await planejar({ privados: { 2025: [privado({ Código: 'PR-7/2025', 'Número do Processo': '' })] } }, antes.estado);
  assert.equal(depois.estado.convenios.size, 1);
  assert.equal(convenios(depois.estado)[0].numero, 'PR-7/2025');
});

test('o mesmo CNPJ pode ter vários convênios', async () => {
  const { estado } = await planejar({
    privados: {
      2022: [privado({ Código: 'PR-001/2022', Início: data('2022-03-01'), Término: data('2027-02-28'), 'Número do Processo': '23069.000001/2022-11' })],
      2026: [privado({ Código: 'PR-001/2026', Início: data('2026-03-01'), Término: data('2031-02-28'), 'Número do Processo': '23069.000001/2026-11' })],
    },
  });
  assert.equal(estado.convenios.size, 2);
  assert.equal(estado.concedentes.size, 1);
});

test('negociação sem código, processo nem CNPJ: identificada pela concedente; a aba mais nova atualiza', async () => {
  const { estado, relatorio } = await planejar({
    publicos: {
      2024: [{ 'RAZÃO SOCIAL': 'Secretaria Fictícia', STATUS: 'Em 9/5 enviamos e-mail' }],
      2025: [{ 'RAZÃO SOCIAL': 'Secretaria Fictícia', STATUS: 'Tratativa iniciada em 2024; minuta enviada' }],
    },
  });
  assert.equal(estado.convenios.size, 1);
  assert.match(convenios(estado)[0].observacoes_internas as string, /minuta enviada/);
  assert.doesNotMatch(convenios(estado)[0].observacoes_internas as string, /Em 9\/5/);
  assert.equal(relatorio.rejeitados.length, 0);
  assert.match(motivos(relatorio.avisos), /atualiza a negociação de "Convênios 2024, linha 3"/);
});

test('linha sem CNPJ liga à concedente de mesmo nome que já tem CNPJ', async () => {
  const { estado } = await planejar({
    publicos: {
      2024: [{ CÓDIGO: 'PU-1/2024', 'RAZÃO SOCIAL': 'Prefeitura Fictícia', CNPJ: CNPJ[1], INÍCIO: data('2024-01-01'), TÉRMINO: data('2029-01-01') }],
      2026: [{ 'RAZÃO SOCIAL': 'PREFEITURA FICTÍCIA', STATUS: 'nova negociação' }],
    },
  });
  assert.equal(estado.concedentes.size, 1);
  assert.equal(estado.convenios.size, 2);
});

test('código repetido na planilha: a segunda linha é rejeitada', async () => {
  const { estado, relatorio } = await planejar({
    privados: { 2024: [privado({ Código: 'PR-011/2024' }), privado({ Código: 'PR-011/2024', CNPJ: CNPJ[1], 'Razão social': 'Outra Fictícia' })] },
  });
  assert.equal(estado.convenios.size, 1);
  assert.match(motivos(relatorio.rejeitados), /repete o convênio de "Privados 2024, linha 2"/);
});

// ---------- Reimportação ----------

test('importar de novo o mesmo arquivo não grava nada', async () => {
  const abas = {
    privados: {
      2024: [privado({ Código: 'PR-1/2024', 'Nome Fantasia': 'Fictícia' }), privado({ Código: 'PR-2/2024', CNPJ: CNPJ[1], ETAPA: 'falta cadastro testemunha' })],
      2025: [privado({ Código: 'PR-3/2025', 'Nome Fantasia': 'Fictícia Nova', Cidade: 'Rio de Janeiro', 'Número do Processo': '23069.000003/2025-11' })],
    },
    publicos: {
      2024: [{ 'RAZÃO SOCIAL': 'Secretaria Fictícia', STATUS: 'contato' }],
      2025: [{ 'RAZÃO SOCIAL': 'Secretaria Fictícia', STATUS: 'minuta' }],
    },
  };
  const primeira = await planejar(abas);
  assert.ok(primeira.grupos.length > 0);
  // A mesma concedente em duas linhas: gravada uma vez, com o dado da aba mais nova.
  const concedente = [...primeira.estado.concedentes.values()].find((c) => c.documento === CNPJ[0]);
  assert.equal(concedente?.nome_fantasia, 'Fictícia Nova');
  assert.equal(primeira.grupos.flat().filter((e) => e.colecao === 'concedentes' && e.id === primeira.grupos.flat().find((x) => x.dados.documento === CNPJ[0])?.id).length, 1);
  const segunda = await planejar(abas, primeira.estado);
  assert.equal(segunda.grupos.length, 0);
  assert.equal(segunda.relatorio.criados, 0);
});

test('concedente nova vai no mesmo grupo do primeiro convênio dela', async () => {
  const { grupos } = await planejar({ privados: { 2025: [privado()] } });
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].map((e) => e.colecao), ['concedentes', 'convenios']);
});

test('a situação não volta atrás e as observações da Divisão são preservadas', async () => {
  const antes = await planejar({ privados: { 2025: [privado({ ETAPA: 'falta cadastro testemunha' })] } });
  const [id] = antes.estado.convenios.keys();
  const c = antes.estado.convenios.get(id)!;
  // A Divisão finalizou no app e escreveu uma nota.
  antes.estado.convenios.set(id, { ...c, situacao: 'finalizado', observacoes_internas: `Nota da Divisão.\n\n${c.observacoes_internas}` });
  const depois = await planejar({ privados: { 2025: [privado({ ETAPA: 'falta cadastro testemunha' })] } }, antes.estado);
  const final = depois.estado.convenios.get(id)!;
  assert.equal(final.situacao, 'finalizado');
  assert.match(final.observacoes_internas as string, /^Nota da Divisão\./);
  assert.equal((final.observacoes_internas as string).match(/Planilha: importado/g)?.length, 1);
  assert.match(motivos(depois.relatorio.avisos), /já está "finalizado"; mantido/);
});

test('mesclar observações troca só as linhas da importação', () => {
  assert.equal(mesclarObservacoes('', ['Planilha: a']), 'Planilha: a');
  assert.equal(mesclarObservacoes('Nota.\n\nPlanilha: velha', ['Planilha: nova']), 'Nota.\n\nPlanilha: nova');
});

// ---------- Documentos e avisos ----------

test('CPF válido entra; documento inválido fica de fora com aviso', async () => {
  const { estado, relatorio } = await planejar({
    privados: {
      2025: [
        privado({ Código: 'PR-1/2025', CNPJ: '529.982.247-25', TIPO: 'PROFISSIONAL LIBERAL', 'Razão social': 'Profissional Fictício' }),
        privado({ Código: 'PR-2/2025', CNPJ: '11.222.333/0001-99', 'Razão social': 'Inválida Fictícia', 'Número do Processo': '23069.000002/2025-11' }),
      ],
    },
  });
  const docs = [...estado.concedentes.values()].map((c) => c.documento);
  assert.ok(docs.includes('52998224725'));
  assert.ok(docs.includes(null));
  assert.match(motivos(relatorio.avisos), /CNPJ\/CPF inválido/);
});

test('em tramitação há mais de um ano gera aviso', async () => {
  const { relatorio } = await planejar({ privados: { 2023: [privado({ ETAPA: 'falta procuração' })], 2026: [privado({ Código: 'PR-1/2026', CNPJ: CNPJ[1], ETAPA: 'falta procuração' })] } });
  const avisos = relatorio.avisos.filter((a) => /verificar se deve ser cancelado/.test(a.motivo));
  assert.deepEqual(avisos.map((a) => a.origem), ['Privados 2023, linha 2']);
});

test('relatório CSV abre no Excel e escapa o separador', () => {
  const csv = relatorioPlanilhasCsv({
    lidos: 1, criados: 0, atualizados: 0, avisos: [],
    rejeitados: [{ origem: 'Privados 2024, linha 2', concedente: 'Fictícia; Ltda', motivo: 'x' }],
    situacoes: { finalizado: 0, em_tramitacao: 0, cancelado: 0 },
  });
  assert.ok(csv.startsWith('﻿situação;origem;concedente;motivo\r\n'));
  assert.ok(csv.includes('rejeitado;Privados 2024, linha 2;"Fictícia; Ltda";x'));
});
