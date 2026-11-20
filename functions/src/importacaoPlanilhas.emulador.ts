// RF07 (planilhas) de ponta a ponta contra o emulador do Firestore: simula sem gravar,
// importa, reimporta sem duplicar nem gravar histórico, e o convênio finalizado aparece na
// leitura da Divisão. Roda com `npm run test:emulador`; fora dele, não é executado.
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { importarPlanilhas } from './importacaoFirestore.js';
import { CNPJ, data, planilhaFicticia } from './planilhasFicticias.js';

const PROJETO = 'demo-estagios-uff';
const app = initializeApp({ projectId: PROJETO }, 'teste-importacao-planilhas');
const db = getFirestore(app);
const autor = { uid: 'd1', email: 'divisao@ficticio.example' };
const HOJE = '2026-11-20';

beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'rode com o emulador (npm run test:emulador)');
  await fetch(`http://${host}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, {
    method: 'DELETE',
  });
});
after(() => deleteApp(app));

test('simula sem gravar, importa, reimporta sem duplicar', async () => {
  const arquivo = await planilhaFicticia({
    privados: {
      2025: [
        {
          Código: 'PR-001/2025', ETAPA: 'PUBLICADO/CONCLUÍDO', 'Razão social': 'Empresa Fictícia Ltda',
          Início: data('2025-03-01'), Término: data('2030-02-28'), 'Número do Processo': '23069.000001/2025-11',
          Cidade: 'Niterói', UF: 'RJ', TIPO: 'PRIVADA', CNPJ: CNPJ[0],
        },
      ],
    },
    publicos: { 2026: [{ 'RAZÃO SOCIAL': 'Secretaria Fictícia', STATUS: 'Em 18/6 enviamos a minuta' }] },
  });

  const simulado = await importarPlanilhas(db, [arquivo], autor, true, HOJE);
  assert.equal(simulado.criados, 2);
  assert.equal((await db.collection('convenios').get()).size, 0);

  const importado = await importarPlanilhas(db, [arquivo], autor, false, HOJE);
  assert.deepEqual([importado.criados, importado.rejeitados], [2, 0]);
  const convenio = await db.doc('convenios/planilha-pr-001-2025').get();
  assert.equal(convenio.get('situacao'), 'finalizado');
  assert.equal(convenio.get('finalizado_em'), null);
  const concedente = await db.doc(`concedentes/${convenio.get('concedente_id')}`).get();
  assert.equal(concedente.get('documento'), CNPJ[0]);
  assert.equal(convenio.get('concedente_nome'), 'Empresa Fictícia Ltda');
  const historico = await convenio.ref.collection('historico').get();
  assert.deepEqual(historico.docs.map((d) => [d.get('acao'), d.get('por')]), [['importado_planilha', 'd1']]);

  const reimportado = await importarPlanilhas(db, [arquivo], autor, false, HOJE);
  assert.equal(reimportado.criados, 0);
  assert.equal((await db.collection('convenios').get()).size, 2);
  assert.equal((await db.collection('concedentes').get()).size, 2);
  assert.equal((await convenio.ref.collection('historico').get()).size, 1);
});
