// RF06 e MS05: casos portados de tests/test_painel.py (versão Django), com dados fictícios.
// O cálculo roda aqui sobre listas em memória; a leitura do Firestore está em
// painelFirestore.emulador.ts. Os casos de acesso (login e Divisão) ficam no app e na Function.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { somarDias } from './alertas.js';
import { type ConvenioPainel, QUANTOS_PARADOS, calcularPainel, vigencia } from './painel.js';

const HOJE = '2026-10-06';

let seq = 0;
function convenio(campos: Partial<ConvenioPainel> = {}): ConvenioPainel {
  seq += 1;
  return {
    id: `c${seq}`,
    numero: '',
    concedente_nome: 'Fictícia',
    tipo: 'empresa_privada',
    situacao: 'em_tramitacao',
    inicio_vigencia: null,
    fim_vigencia: null,
    finalizado_em: null,
    criado_em: HOJE,
    primeira_etapa: null,
    ...campos,
  };
}

/** Finalizado que vence daqui a `venceEm` dias, com 1000 dias de vigência (como no Django). */
function finalizado(numero: string, venceEm: number, campos: Partial<ConvenioPainel> = {}): ConvenioPainel {
  const fim = somarDias(HOJE, venceEm);
  return convenio({
    numero,
    situacao: 'finalizado',
    inicio_vigencia: somarDias(fim, -1000),
    fim_vigencia: fim,
    ...campos,
  });
}

test('contagens por situação, vencimento e tipo', () => {
  const ong = { tipo: 'ong_oscip' };
  const r = calcularPainel(
    [
      finalizado('PR-20D/2026', 20),
      finalizado('PR-60D/2026', 60),
      finalizado('PR-150D/2026', 150, ong),
      finalizado('PR-500D/2026', 500, ong),
      finalizado('PR-VENCIDO/2026', -1),
      convenio(), // em tramitação
      convenio({ situacao: 'cancelado' }),
    ],
    HOJE,
  );
  assert.deepEqual(r.por_vigencia, {
    em_tramitacao: 1,
    cancelado: 1,
    a_iniciar: 0,
    vigente: 4,
    vencido: 1,
  });
  assert.deepEqual(r.vencendo, { 30: 1, 90: 2, 180: 3 });
  assert.equal(r.por_tipo.empresa_privada, 2);
  assert.equal(r.por_tipo.ong_oscip, 2);
  assert.equal(r.por_tipo.microempresa, 0); // todos os tipos aparecem, mesmo zerados
});

test('tempo de tramitação usa a primeira etapa e a janela de um ano', () => {
  const r = calcularPainel(
    [
      // Etapas em HOJE-5 e HOJE-20: vale a primeira (20 dias).
      finalizado('PR-1/2026', 300, { finalizado_em: HOJE, primeira_etapa: somarDias(HOJE, -20) }),
      finalizado('PR-2/2026', 300, { finalizado_em: HOJE, primeira_etapa: somarDias(HOJE, -80) }),
      // Finalizado há 400 dias: fora da janela de 365.
      finalizado('PR-3/2026', 300, { finalizado_em: somarDias(HOJE, -400) }),
    ],
    HOJE,
  );
  assert.equal(r.tramitacao_amostra, 2);
  assert.equal(r.tramitacao_media, 50); // (20 + 80) / 2
  assert.equal(r.tramitacao_mediana, 50);
});

test('sem etapas, a tramitação conta do cadastro', () => {
  const r = calcularPainel(
    [finalizado('PR-1/2026', 300, { finalizado_em: HOJE, criado_em: somarDias(HOJE, -12) })],
    HOJE,
  );
  assert.equal(r.tramitacao_media, 12);
});

test('finalizado sem data de finalização (importado) fica fora da média', () => {
  const r = calcularPainel([finalizado('PR-1/2026', 300)], HOJE);
  assert.equal(r.tramitacao_amostra, 0);
});

test('sem finalizados não há média', () => {
  const r = calcularPainel([], HOJE);
  assert.equal(r.tramitacao_media, null);
  assert.equal(r.tramitacao_mediana, null);
  assert.equal(r.tramitacao_amostra, 0);
});

test('parados ordenados do mais antigo e limitados', () => {
  const r = calcularPainel(
    Array.from({ length: 12 }, (_, i) => convenio({ primeira_etapa: somarDias(HOJE, -i * 10) })),
    HOJE,
  );
  assert.equal(QUANTOS_PARADOS, 10);
  assert.deepEqual(
    r.parados.map((p) => p.dias),
    [110, 100, 90, 80, 70, 60, 50, 40, 30, 20],
  );
});

test('vigência segue a RN02, igual ao app', () => {
  const datas = { inicio_vigencia: '2026-10-07', fim_vigencia: '2027-10-06' };
  assert.equal(vigencia({ situacao: 'finalizado', ...datas }, HOJE), 'a_iniciar');
  assert.equal(vigencia({ situacao: 'finalizado', ...datas }, '2027-10-06'), 'vigente');
  assert.equal(vigencia({ situacao: 'finalizado', ...datas }, '2027-10-07'), 'vencido');
  assert.equal(vigencia({ situacao: 'cancelado', ...datas }, HOJE), 'cancelado');
  assert.equal(vigencia({ situacao: 'em_tramitacao', ...datas }, HOJE), 'em_tramitacao');
});

test('tipo desconhecido conta como outros', () => {
  const r = calcularPainel([finalizado('PR-1/2026', 100, { tipo: '' })], HOJE);
  assert.equal(r.por_tipo.outros, 1);
});
