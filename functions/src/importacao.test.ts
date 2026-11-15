// RF07: casos portados de tests/test_importacao.py (versão Django).
// Dados fictícios no mesmo formato do export real; o XML do Drupal nunca entra no repositório.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Estado,
  lerData,
  lerXml,
  planejarImportacao,
  relatorioCsv,
} from './importacao.js';

const EMAIL_HTML = '&lt;a href="mailto:contato@ficticia.example"&gt;contato@ficticia.example&lt;/a&gt;';
const RESOLUCAO_HTML = '&lt;a href="https://exemplo.uff.br/res.pdf"&gt;CEPEX 3463/2024&lt;/a&gt;';

export function no(nid: number, campos: Record<string, string> = {}): string {
  const padrao: Record<string, string> = {
    Titulo: `Empresa Fictícia ${nid}`,
    'Nr-CONVENIO': `PR-${nid}/2026`,
    'N-MERO-DO-PROCESSO': '23069.000001/2026-00',
    'In-cio': '01/10/26',
    Termino: '30/09/31',
    Cidade: 'NITERÓI',
    UF: 'RJ',
    'Ramo-de-atividade': 'Atividade fictícia',
    url: `http://www.estagio.uff.br/node/${nid}`,
    Objeto: 'A CONCEDENTE oferecerá estágios.',
    'Tipo-da-Institui-o': '&lt;a href="/tipo-de-empresa/privada"&gt;Privada&lt;/a&gt;',
    CNPJ: '11222333000181',
    Corpo: '',
    Email: '',
    'Resolu-o-CEP': '',
  };
  const corpo = Object.entries({ ...padrao, ...campos })
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('');
  return `<node>${corpo}</node>`;
}

export const xml = (...nos: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?><nodes>${nos.join('')}</nodes>`;

const estadoVazio = (): Estado => ({ concedentes: new Map(), convenios: new Map() });

function importar(texto: string, estado = estadoVazio()) {
  let seq = 0;
  const plano = planejarImportacao(lerXml(texto), estado, () => `c${++seq}-${estado.concedentes.size}`);
  return { ...plano, estado };
}

const unico = <T>(m: Map<string, T>): T => {
  assert.equal(m.size, 1);
  return [...m.values()][0];
};

for (const [entrada, esperado] of [
  ['01/10/26', '2026-10-01'],
  ['30/12/99', '2099-12-30'],
  ['07/05/15', '2015-05-07'],
  ['', null],
] as const) {
  test(`ano de dois dígitos é sempre 20xx: "${entrada}"`, () => assert.equal(lerData(entrada), esperado));
}

test('data que não é dd/mm/aa é ilegível', () => {
  for (const ruim of ['01/10/2026', '31/02/26', 'amanhã']) assert.throws(() => lerData(ruim));
});

test('lê campos e limpa HTML', () => {
  const [r] = lerXml(xml(no(15461, { Email: EMAIL_HTML, 'Resolu-o-CEP': RESOLUCAO_HTML })));
  assert.equal(r.idDrupal, 15461);
  assert.equal(r.tipoDrupal, 'Privada');
  assert.equal(r.email, 'contato@ficticia.example');
  assert.equal(r.resolucao, 'CEPEX 3463/2024');
  assert.equal(r.resolucaoUrl, 'https://exemplo.uff.br/res.pdf');
  assert.deepEqual([r.inicio, r.fim], ['2026-10-01', '2031-09-30']);
});

test('HTML cru dentro do campo também vira texto', () => {
  const [r] = lerXml(xml(no(1, { Corpo: '<p>Texto <b>do</b> corpo &amp;nbsp;</p>', Titulo: 'A &amp;amp; B' })));
  assert.equal(r.corpo, 'Texto do corpo');
  assert.equal(r.titulo, 'A & B');
});

test('importa convênio completo', () => {
  const { relatorio, estado, grupos } = importar(xml(no(1)));
  assert.equal(relatorio.criados, 1);
  assert.deepEqual(relatorio.rejeitados, []);
  const c = unico(estado.convenios);
  assert.equal(c.id_drupal, 1);
  assert.equal(c.situacao, 'finalizado');
  assert.equal(c.finalizado_em, null); // D19: data real desconhecida, fora do tempo de tramitação
  assert.equal(c.minuta, 'padrao_uff');
  const concedente = unico(estado.concedentes);
  assert.equal(concedente.tipo, 'empresa_privada');
  assert.equal(concedente.documento, '11222333000181');
  assert.equal(c.concedente_nome, 'Empresa Fictícia 1');
  assert.match(c.observacoes_internas as string, /nó 1/);
  assert.match(c.observacoes_internas as string, /Tipo no Drupal: Privada/);
  // RF08: o convênio importado nasce com o registro no histórico.
  assert.deepEqual(
    grupos.flat().filter((e) => e.historico).map((e) => e.historico),
    [{ acao: 'importado', campos: [] }],
  );
});

test('reimportar atualiza sem duplicar', () => {
  const { estado } = importar(xml(no(1)));
  const { relatorio, grupos } = importar(xml(no(1, { Termino: '29/09/31' })), estado);
  assert.deepEqual([relatorio.criados, relatorio.atualizados], [0, 1]);
  assert.equal(unico(estado.convenios).fim_vigencia, '2031-09-29');
  assert.equal(estado.concedentes.size, 1);
  assert.deepEqual(grupos.flat().map((e) => e.historico), [{ acao: 'reimportado', campos: ['fim_vigencia'] }]);
});

test('reimportar o mesmo arquivo não grava nada', () => {
  const { estado } = importar(xml(no(1), no(2, { CNPJ: '' })));
  const { relatorio, grupos } = importar(xml(no(1), no(2, { CNPJ: '' })), estado);
  assert.equal(relatorio.atualizados, 2);
  assert.deepEqual(grupos, []);
});

test('reimportar preserva o que só existe no app (minuta, origem, nome fantasia)', () => {
  const { estado } = importar(xml(no(1)));
  const [idConv, conv] = [...estado.convenios][0];
  estado.convenios.set(idConv, { ...conv, minuta: 'externa' });
  const [idConc, conc] = [...estado.concedentes][0];
  estado.concedentes.set(idConc, { ...conc, nome_fantasia: 'Fictícia' });
  importar(xml(no(1, { Termino: '29/09/31' })), estado);
  assert.equal(unico(estado.convenios).minuta, 'externa');
  assert.equal(unico(estado.concedentes).nome_fantasia, 'Fictícia');
});

test('concedente renomeada atualiza a cópia do nome nos convênios', () => {
  const { estado } = importar(xml(no(1), no(2)));
  const { grupos } = importar(xml(no(1, { Titulo: 'Nome Novo' })), estado);
  assert.deepEqual([...estado.convenios.values()].map((c) => c.concedente_nome), ['Nome Novo', 'Nome Novo']);
  assert.ok(grupos.flat().some((e) => e.id === 'drupal-2' && e.dados.concedente_nome === 'Nome Novo'));
});

for (const [campos, motivo] of [
  [{ 'Nr-CONVENIO': '' }, 'sem nº'],
  [{ 'In-cio': '' }, 'sem data'],
  [{ Termino: '01/10/26' }, 'não é depois do início'],
  [{ CNPJ: '11222333000180' }, 'dígito verificador inválido'],
  [{ Termino: '2031-09-30' }, 'data ilegível'],
] as const) {
  test(`rejeita e explica: ${motivo}`, () => {
    const { relatorio, grupos } = importar(xml(no(1, campos)));
    assert.equal(relatorio.criados, 0);
    assert.equal(relatorio.rejeitados.length, 1);
    assert.equal(relatorio.rejeitados[0].no, 1);
    assert.ok(relatorio.rejeitados[0].motivo.includes(motivo), relatorio.rejeitados[0].motivo);
    assert.deepEqual(grupos, []);
  });
}

test('número repetido rejeita o segundo e não deixa lixo', () => {
  const { relatorio, estado } = importar(xml(no(1), no(2, { 'Nr-CONVENIO': 'PR-1/2026', CNPJ: '' })));
  assert.equal(relatorio.criados, 1);
  assert.ok(relatorio.rejeitados[0].motivo.includes('PR-1/2026 já usado'));
  assert.equal(estado.concedentes.size, 1); // a concedente do rejeitado não foi criada
  assert.ok(!relatorio.avisos.some((a) => a.no === 2));
});

test('número já usado por convênio cadastrado no app também é rejeitado', () => {
  const estado = estadoVazio();
  estado.convenios.set('app1', { numero: 'PR-1/2026', concedente_id: 'x' });
  const { relatorio } = importar(xml(no(1)), estado);
  assert.equal(relatorio.criados, 0);
  assert.ok(relatorio.rejeitados[0].motivo.includes('já usado'));
});

test('sem CNPJ entra com aviso e agrupa pelo nome', () => {
  const { relatorio, estado } = importar(
    xml(
      no(1, { CNPJ: '', Titulo: 'Loja Antiga' }),
      no(2, { CNPJ: '', Titulo: 'LOJA ANTIGA', 'Nr-CONVENIO': 'PR-2/2026' }),
    ),
  );
  assert.equal(relatorio.criados, 2);
  assert.equal([...estado.concedentes.values()].filter((c) => c.documento === null).length, 1);
  assert.equal(relatorio.avisos.filter((a) => a.motivo.includes('sem CNPJ')).length, 2);
});

test('avisa tipo desconhecido, UF inválida e vigência longa', () => {
  const { relatorio, estado } = importar(
    xml(
      no(1, { UF: 'EUA', Termino: '30/12/99', 'Tipo-da-Institui-o': 'INSTITUIÇÃO DE ENSINO' }),
      no(2, { UF: 'RIO DE JANEIRO', CNPJ: '12ABC34501DE35', 'Nr-CONVENIO': 'PR-2/2026' }),
    ),
  );
  const motivos = relatorio.avisos.map((a) => a.motivo).join(' | ');
  assert.ok(motivos.includes('"INSTITUIÇÃO DE ENSINO" sem correspondência'));
  assert.ok(motivos.includes('UF "EUA" inválida'));
  assert.ok(motivos.includes('acima de 5 anos'));
  const porDoc = (d: string) => [...estado.concedentes.values()].find((c) => c.documento === d);
  assert.equal(porDoc('12ABC34501DE35')?.uf, 'RJ');
  assert.equal(porDoc('11222333000181')?.tipo, 'outros');
});

test('relatório CSV abre no Excel e lista rejeitados e avisos', () => {
  const { relatorio } = importar(xml(no(1, { CNPJ: '' }), no(2, { 'In-cio': '', Titulo: 'Com; ponto' })));
  const csv = relatorioCsv(relatorio);
  assert.ok(csv.startsWith('﻿situação;nó no Drupal;título;motivo'));
  assert.ok(csv.includes('rejeitado;2;"Com; ponto";sem data'));
  assert.ok(csv.includes('aviso;1;Empresa Fictícia 1;sem CNPJ'));
});
