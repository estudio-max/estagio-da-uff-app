// RF03/RF04/RN01/RN08: casos portados de tests/test_pagina_publica.py (versão Django), com
// dados fictícios. Lá os casos batiam no Django com banco; aqui batem em `responder`, que
// faz o mesmo papel das views. A leitura no Firestore está em paginaPublicaFirestore.emulador.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { somarDias } from './alertas.js';
import {
  type ConcedentePublica,
  type ConvenioPublico,
  andamento,
  dataLonga,
  documentoPublico,
  responder,
  tempoRestante,
} from './paginaPublica.js';

const HOJE = '2026-10-06';
let proximoId = 1;

function concedente(documento: string | null = '11222333000181', campos: Partial<ConcedentePublica> = {}): ConcedentePublica {
  return {
    razao_social: 'Empresa Fictícia Ltda',
    nome_fantasia: '',
    documento,
    tipo: 'empresa_privada',
    uf: 'RJ',
    cidade: 'Niterói',
    ramo_atividade: '',
    ...campos,
  };
}

function convenio(
  dono: ConcedentePublica,
  numero = 'PR-1/2026',
  campos: Partial<ConvenioPublico> = {},
): ConvenioPublico {
  return {
    id: `c${proximoId++}`,
    numero,
    processo_sei: '23069.000001/2026-00',
    objeto: '',
    situacao: 'finalizado',
    inicio_vigencia: somarDias(HOJE, -30),
    fim_vigencia: somarDias(HOJE, 365),
    concedente: dono,
    ...campos,
  };
}

function pagina(convenios: ConvenioPublico[], caminho = '/convenios', params: Record<string, string> = {}): string {
  const r = responder(convenios, HOJE, caminho, new URLSearchParams(params));
  assert.equal(r.status, 200);
  return r.html;
}

const detalhe = (convenios: ConvenioPublico[], c: ConvenioPublico): string =>
  pagina(convenios, `/convenios/${c.id}`);

// --- RN01: só vigentes e a iniciar ---

test('lista só convênios vigentes e a iniciar', () => {
  const dono = concedente();
  const todos = [
    convenio(dono, 'PR-VIGENTE/2026'),
    convenio(dono, 'PR-TRAMITANDO/2026', { situacao: 'em_tramitacao' }),
    convenio(dono, 'PR-CANCELADO/2026', { situacao: 'cancelado' }),
    convenio(dono, 'PR-VENCIDO/2020', {
      inicio_vigencia: somarDias(HOJE, -900),
      fim_vigencia: somarDias(HOJE, -1),
    }),
    convenio(dono, 'PR-FUTURO/2026', { inicio_vigencia: somarDias(HOJE, 1) }),
  ];
  const html = pagina(todos);
  assert.ok(html.includes('PR-VIGENTE/2026'));
  assert.ok(html.includes('PR-FUTURO/2026')); // D18: a iniciar aparece, com selo
  for (const oculto of ['TRAMITANDO', 'CANCELADO', 'VENCIDO']) assert.ok(!html.includes(oculto), oculto);
  assert.ok(html.includes('1 convênio vigente · 1 a iniciar'));
});

test('convênio que vence hoje ainda aparece; o que venceu ontem não', () => {
  const dono = concedente();
  const html = pagina([
    convenio(dono, 'PR-HOJE/2026', { fim_vigencia: HOJE }),
    convenio(dono, 'PR-ONTEM/2026', { fim_vigencia: somarDias(HOJE, -1) }),
  ]);
  assert.ok(html.includes('PR-HOJE/2026'));
  assert.ok(!html.includes('PR-ONTEM/2026'));
});

test('convênio entra na página ao ser finalizado', () => {
  const c = convenio(concedente(), 'PR-1/2026', { situacao: 'em_tramitacao' });
  assert.ok(!pagina([c]).includes('PR-1/2026'));
  c.situacao = 'finalizado';
  assert.ok(pagina([c]).includes('PR-1/2026'));
});

for (const situacao of ['em_tramitacao', 'cancelado']) {
  test(`detalhe de convênio ${situacao} dá 404`, () => {
    const c = convenio(concedente(), 'PR-1/2026', { situacao });
    assert.equal(responder([c], HOJE, `/convenios/${c.id}`, new URLSearchParams()).status, 404);
  });
}

test('detalhe de convênio inexistente e caminho desconhecido dão 404', () => {
  const vazio = new URLSearchParams();
  assert.equal(responder([], HOJE, '/convenios/nao-existe', vazio).status, 404);
  assert.equal(responder([], HOJE, '/convenios/%E0%A4%A', vazio).status, 404);
  assert.equal(responder([], HOJE, '/outra', vazio).status, 404);
  assert.equal(responder([], HOJE, '/convenios/a/b', vazio).status, 404);
});

// --- RF03: campos internos nunca aparecem ---

test('campos internos não vazam na lista nem no detalhe', () => {
  // O modelo público não tem esses campos; se algum chegar por engano, não é exibido.
  const dono = { ...concedente(), email: 'contato-interno@ficticia.example' };
  const c = {
    ...convenio(dono),
    observacoes_internas: 'NOTA-INTERNA-SECRETA',
    resolucao_cep: 'RESOLUCAO-INTERNA-123',
  };
  for (const html of [pagina([c]), detalhe([c], c)]) {
    for (const segredo of ['NOTA-INTERNA', 'contato-interno', 'RESOLUCAO-INTERNA']) {
      assert.ok(!html.includes(segredo), segredo);
    }
  }
});

test('CPF de pessoa física não aparece nem é buscável', () => {
  const pessoa = concedente('52998224725', {
    razao_social: 'Profissional Fictício',
    tipo: 'profissional_liberal',
  });
  const c = convenio(pessoa);
  for (const html of [pagina([c]), detalhe([c], c)]) {
    assert.ok(html.includes('Profissional Fictício'));
    assert.ok(!html.includes('CPF') && !html.includes('***')); // RN08: nem cifrado
    assert.ok(!html.includes('529.982.247-25'));
    assert.ok(!html.includes('52998224725'));
    assert.ok(!html.includes('982.247') && !html.includes('982247'));
  }
  // Quem sabe o CPF não consegue confirmar, pela busca, que a pessoa tem convênio.
  assert.ok(!pagina([c], '/convenios', { q: '529.982.247-25' }).includes('Profissional Fictício'));
});

test('data longa em português', () => {
  assert.equal(dataLonga('2026-07-21'), 'terça-feira, 21 de julho de 2026');
  assert.equal(dataLonga('2027-01-03'), 'domingo, 03 de janeiro de 2027');
});

test('documento público: só CNPJ', () => {
  assert.equal(documentoPublico('11222333000181'), 'CNPJ 11.222.333/0001-81');
  assert.equal(documentoPublico('12ABC34501DE35'), 'CNPJ 12.ABC.345/01DE-35');
  assert.equal(documentoPublico('52998224725'), '');
  assert.equal(documentoPublico(null), '');
  assert.equal(documentoPublico(''), '');
});

test('conteúdo cadastrado é escapado no HTML', () => {
  const c = convenio(concedente(null, { razao_social: '<script>alert(1)</script>' }));
  for (const html of [pagina([c]), detalhe([c], c)]) {
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  }
  const busca = pagina([c], '/convenios', { q: '"><script>x</script>' });
  assert.ok(!busca.includes('<script>x</script>'));
});

test('página pública responde sem login', () => {
  assert.equal(responder([], HOJE, '/convenios', new URLSearchParams()).status, 200);
  assert.equal(responder([], HOJE, '/convenios/', new URLSearchParams()).status, 200);
});

// --- RF04: busca e filtros ---

test('busca por nome, CNPJ, número e filtros', () => {
  const todos = [
    convenio(concedente('11222333000181', { razao_social: 'Alfa Tecnologia', nome_fantasia: 'AlfaTec' }), 'PR-10/2026'),
    convenio(
      concedente('12ABC34501DE35', {
        razao_social: 'Beta Saúde',
        tipo: 'ong_oscip',
        uf: 'SP',
        cidade: 'São Paulo',
      }),
      'PR-20/2026',
    ),
  ];
  const encontra = (params: Record<string, string> = {}): Set<string> => {
    const html = pagina(todos, '/convenios', params);
    return new Set(['Alfa Tecnologia', 'Beta Saúde'].filter((nome) => html.includes(nome)));
  };
  assert.deepEqual(encontra(), new Set(['Alfa Tecnologia', 'Beta Saúde']));
  assert.deepEqual(encontra({ q: 'alfatec' }), new Set(['Alfa Tecnologia']));
  assert.deepEqual(encontra({ q: 'PR-20' }), new Set(['Beta Saúde']));
  assert.deepEqual(encontra({ q: '11.222.333/0001-81' }), new Set(['Alfa Tecnologia']));
  assert.deepEqual(encontra({ q: '12.abc.345/01de-35' }), new Set(['Beta Saúde']));
  assert.deepEqual(encontra({ tipo: 'ong_oscip' }), new Set(['Beta Saúde']));
  assert.deepEqual(encontra({ uf: 'RJ' }), new Set(['Alfa Tecnologia']));
  assert.deepEqual(encontra({ q: 'inexistente' }), new Set());
  // MS07: sem resultado, orienta como pedir convênio.
  const vazio = pagina(todos, '/convenios', { q: 'inexistente' });
  assert.ok(vazio.includes('Nenhum convênio vigente encontrado'));
  assert.ok(vazio.includes('pode solicitar um à Divisão de Estágio'));
  assert.ok(vazio.includes('0 convênios encontrados'));
});

test('detalhe mostra os campos públicos', () => {
  const c = convenio(concedente('11222333000181', { ramo_atividade: 'Serviços de assistência social' }), 'PR-212/2026', {
    objeto: 'A CONCEDENTE oferecerá estágios.',
  });
  const html = detalhe([c], c);
  for (const esperado of [
    'PR-212/2026',
    '23069.000001/2026-00',
    '11.222.333/0001-81',
    'Empresa Privada',
    'Serviços de assistência social',
    'Niterói/RJ',
    'A CONCEDENTE oferecerá estágios.',
    c.inicio_vigencia!.slice(0, 4),
  ]) {
    assert.ok(html.includes(esperado), esperado);
  }
});

test('razão social sempre, nome fantasia abaixo dela quando houver', () => {
  const com = convenio(concedente('11222333000181', { razao_social: 'Alfa Tecnologia Ltda', nome_fantasia: 'AlfaTec' }));
  const sem = convenio(concedente('12ABC34501DE35', { razao_social: 'Beta Saúde S.A.' }), 'PR-2/2026');
  const lista = pagina([com, sem]);
  for (const html of [lista, detalhe([com, sem], com)]) {
    const razao = html.indexOf('Alfa Tecnologia Ltda', html.indexOf('<main'));
    const fantasia = html.indexOf('AlfaTec<', razao);
    assert.ok(razao >= 0, 'razão social');
    assert.ok(fantasia > razao, 'nome fantasia abaixo da razão social');
  }
  assert.ok(lista.includes('<span class="fantasia">AlfaTec</span>'));
  // Sem nome fantasia, só a razão social, sem linha vazia.
  assert.ok(detalhe([com, sem], sem).includes('Beta Saúde S.A.'));
  assert.ok(!detalhe([com, sem], sem).includes('Nome fantasia'));
  assert.equal(lista.match(/class="fantasia"/g)?.length, 1);
});

test('paginação mantém os filtros', () => {
  const dono = concedente();
  const todos = Array.from({ length: 51 }, (_, i) => convenio(dono, `PR-${String(i).padStart(3, '0')}/2026`));
  const html = pagina(todos, '/convenios', { uf: 'RJ' });
  assert.ok(html.includes('Página 1 de 2'));
  assert.ok(html.includes('uf=RJ&amp;page=2'));
  assert.ok(pagina(todos, '/convenios', { uf: 'RJ', page: '2' }).includes('Página 2 de 2'));
  assert.equal(responder(todos, HOJE, '/convenios', new URLSearchParams({ page: '3' })).status, 404);
  assert.equal(responder(todos, HOJE, '/convenios', new URLSearchParams({ page: 'x' })).status, 404);
});

test('convênio a iniciar tem selo com a data de início', () => {
  const inicio = somarDias(HOJE, 20);
  const c = convenio(concedente(), 'PR-1/2026', { inicio_vigencia: inicio });
  const selo = `A partir de ${inicio.split('-').reverse().join('/')}`;
  assert.ok(pagina([c]).includes(selo));
  const html = detalhe([c], c);
  assert.ok(html.includes(selo));
  assert.ok(!html.includes('>Vigente<'));
});

test('convênio vigente não tem selo de futuro', () => {
  const c = convenio(concedente());
  assert.ok(!pagina([c]).includes('A partir de'));
  assert.ok(detalhe([c], c).includes('>Vigente<'));
});

// --- Visual da Divisão: prazo e barra da vigência (como na lista do app) ---

test('prazo do convênio: vence em, começa em e fração decorrida', () => {
  const dono = concedente();
  const longe = andamento(convenio(dono), HOJE);
  assert.equal(longe.prazo, null); // acima de 90 dias, só a barra
  assert.ok(longe.fracao > 0 && longe.fracao < 1);
  assert.deepEqual(andamento(convenio(dono, 'PR-1/2026', { fim_vigencia: somarDias(HOJE, 90) }), HOJE).prazo, 'Vence em 90 dias');
  const urgente = andamento(convenio(dono, 'PR-1/2026', { fim_vigencia: somarDias(HOJE, 30) }), HOJE);
  assert.equal(urgente.prazo, 'Vence em 30 dias');
  assert.equal(urgente.urgente, true);
  assert.equal(andamento(convenio(dono, 'PR-1/2026', { fim_vigencia: somarDias(HOJE, 31) }), HOJE).urgente, false);
  assert.equal(andamento(convenio(dono, 'PR-1/2026', { fim_vigencia: HOJE }), HOJE).prazo, 'Vence hoje');
  const futuro = andamento(convenio(dono, 'PR-1/2026', { inicio_vigencia: somarDias(HOJE, 1) }), HOJE);
  assert.deepEqual(futuro, { fracao: 0, prazo: 'Começa em 1 dia', urgente: false });
});

test('tempo restante em anos e meses, ou dias abaixo de um mês', () => {
  assert.equal(tempoRestante('2026-10-06', '2027-12-06'), '1 ano e 2 meses');
  assert.equal(tempoRestante('2026-10-06', '2028-10-05'), '1 ano e 11 meses');
  assert.equal(tempoRestante('2026-10-06', '2026-11-06'), '1 mês');
  assert.equal(tempoRestante('2026-10-06', '2026-11-05'), '30 dias');
});

test('lista mostra o prazo; detalhe mostra o tempo restante', () => {
  const perto = convenio(concedente(), 'PR-1/2026', { fim_vigencia: somarDias(HOJE, 12) });
  assert.ok(pagina([perto]).includes('Vence em 12 dias'));
  const longe = convenio(concedente(), 'PR-2/2026', { fim_vigencia: '2027-12-06' });
  assert.ok(detalhe([longe], longe).includes('Faltam 1 ano e 2 meses'));
  assert.ok(!pagina([longe]).includes('Vence em'));
});

test('resumo conta vigentes, a iniciar e concedentes', () => {
  const alfa = concedente('11222333000181', { razao_social: 'Alfa' });
  const beta = concedente('12ABC34501DE35', { razao_social: 'Beta' });
  const html = pagina([
    convenio(alfa, 'PR-1/2026'),
    convenio(alfa, 'PR-2/2026'),
    convenio(beta, 'PR-3/2026', { inicio_vigencia: somarDias(HOJE, 5) }),
  ]);
  assert.ok(html.includes('<dt>Vigentes</dt><dd>2</dd>'));
  assert.ok(html.includes('<dt>A iniciar</dt><dd>1</dd>'));
  assert.ok(html.includes('<dt>Concedentes</dt><dd>2</dd>'));
});
