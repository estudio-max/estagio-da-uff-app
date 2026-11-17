// RF05 de ponta a ponta contra o emulador do Firestore (porta de test_comando_roda e do
// registro único do Django). Roda com `npm run test:emulador`.
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { type Email, enviarAlertas, somarDias } from './alertas.js';
import { dependenciasFirestore } from './alertasFirestore.js';

const PROJETO = 'demo-estagios-uff';
const app = initializeApp({ projectId: PROJETO }, 'teste-alertas');
const db = getFirestore(app);
const HOJE = '2026-10-06';
const CONFIG = {
  divisaoEmail: 'divisao@exemplo.test',
  antecedencias: [365, 180, 90, 30],
  appUrl: 'https://estagios.exemplo.test',
};

beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'rode com o emulador (npm run test:emulador)');
  await fetch(`http://${host}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, {
    method: 'DELETE',
  });
});
after(() => deleteApp(app));

const convenio = (id: string, venceEmDias: number, situacao = 'finalizado') => {
  const fim = somarDias(HOJE, venceEmDias);
  return db.collection('convenios').doc(id).set({
    numero: `PR-${id}/2026`,
    concedente_id: 'c1',
    concedente_nome: 'Empresa Fictícia',
    situacao,
    minuta: 'padrao_uff',
    origem: 'concedente',
    inicio_vigencia: somarDias(fim, -1000),
    fim_vigencia: fim,
  });
};

test('lê a janela, envia um e-mail, registra e não repete', async () => {
  await Promise.all([
    convenio('perto', 10),
    convenio('longe', 500),
    convenio('vencido', -5),
    convenio('tramitando', 10, 'em_tramitacao'),
  ]);
  const emails: Email[] = [];
  const deps = dependenciasFirestore(db, async (e) => {
    emails.push(e);
  });

  assert.equal(await enviarAlertas(HOJE, CONFIG, deps), 1);
  assert.equal(emails.length, 1);
  assert.ok(emails[0].texto.includes('PR-perto/2026'));

  const registros = await db.collection('convenios').doc('perto').collection('alertas').get();
  assert.deepEqual(
    registros.docs.map((d) => [d.id, d.get('antecedencia_dias'), d.get('fim_vigencia')]),
    [[`30_${somarDias(HOJE, 10)}`, 30, somarDias(HOJE, 10)]],
  );
  assert.ok(registros.docs[0].get('enviado_em'));

  assert.equal(await enviarAlertas(somarDias(HOJE, 1), CONFIG, deps), 0);
  assert.equal(emails.length, 1);
});

test('falha no envio não grava nada', async () => {
  await convenio('perto', 10);
  const deps = dependenciasFirestore(db, async () => {
    throw new Error('servidor de email fora do ar');
  });
  await assert.rejects(enviarAlertas(HOJE, CONFIG, deps), /fora do ar/);
  const registros = await db.collection('convenios').doc('perto').collection('alertas').get();
  assert.equal(registros.size, 0);
});
