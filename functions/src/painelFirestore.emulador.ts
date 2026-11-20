// RF06 contra o emulador do Firestore: a leitura junta o tipo da concedente, a primeira
// etapa e a data do cadastro, e as contagens batem com o que está no banco (§6).
// Roda com `npm run test:emulador`.
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hojeEmBrasilia, somarDias } from './alertas.js';
import { calcularPainel } from './painel.js';
import { carregarPainel } from './painelFirestore.js';

const PROJETO = 'demo-estagios-uff';
const app = initializeApp({ projectId: PROJETO }, 'teste-painel');
const db = getFirestore(app);

beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'rode com o emulador (npm run test:emulador)');
  await fetch(`http://${host}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, {
    method: 'DELETE',
  });
});
after(() => deleteApp(app));

test('lê tipo, primeira etapa e cadastro, e as contagens batem com o banco', async () => {
  const hoje = hojeEmBrasilia();
  await db.doc('concedentes/k1').set({ razao_social: 'ONG Fictícia', tipo: 'ong_oscip' });
  await db.doc('convenios/v1').set({
    numero: 'PR-1/2026',
    concedente_id: 'k1',
    concedente_nome: 'ONG Fictícia',
    situacao: 'finalizado',
    inicio_vigencia: somarDias(hoje, -10),
    fim_vigencia: somarDias(hoje, 20),
    finalizado_em: hoje,
  });
  const etapas = db.collection('convenios/v1/etapas');
  await etapas.add({ etapa: 'analise', data: somarDias(hoje, -5) });
  await etapas.add({ etapa: 'documentacao_recebida', data: somarDias(hoje, -30) });
  await db.doc('convenios/v2').set({ concedente_id: 'k1', concedente_nome: 'ONG Fictícia', situacao: 'em_tramitacao' });

  const lidos = await carregarPainel(db);
  const v1 = lidos.find((c) => c.id === 'v1');
  assert.equal(v1?.tipo, 'ong_oscip');
  assert.equal(v1?.primeira_etapa, somarDias(hoje, -30));
  assert.equal(lidos.find((c) => c.id === 'v2')?.criado_em, hoje);

  const r = calcularPainel(lidos, hoje);
  const total = (await db.collection('convenios').count().get()).data().count;
  assert.equal(Object.values(r.por_vigencia).reduce((a, b) => a + b, 0), total);
  assert.deepEqual([r.por_vigencia.vigente, r.vencendo['30'], r.por_tipo.ong_oscip], [1, 1, 1]);
  assert.equal(r.tramitacao_media, 30);
  assert.deepEqual(r.parados.map((p) => [p.id, p.dias]), [['v2', 0]]);
});
