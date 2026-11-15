// RF07 de ponta a ponta contra o emulador do Firestore (porta de test_comando_simula_importa_e_publica).
// Roda com `npm run test:emulador`, que sobe o emulador; fora dele, este arquivo não é executado.
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { importarXml } from './importacaoFirestore.js';

const PROJETO = 'demo-estagios-uff';
const app = initializeApp({ projectId: PROJETO }, 'teste-importacao');
const db = getFirestore(app);
const autor = { uid: 'd1', email: 'divisao@ficticio.example' };

const no = (nid: number, extra = ''): string =>
  `<node><Titulo>Empresa Fictícia ${nid}</Titulo><Nr-CONVENIO>PR-${nid}/2026</Nr-CONVENIO>` +
  `<In-cio>${extra === 'sem-data' ? '' : '01/10/26'}</In-cio><Termino>30/09/31</Termino>` +
  `<UF>RJ</UF><Cidade>NITERÓI</Cidade><CNPJ>11222333000181</CNPJ>` +
  `<Tipo-da-Institui-o>Privada</Tipo-da-Institui-o><url>http://www.estagio.uff.br/node/${nid}</url></node>`;
const xml = `<?xml version="1.0" encoding="UTF-8"?><nodes>${no(1)}${no(2, 'sem-data')}</nodes>`;

beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'rode com o emulador (npm run test:emulador)');
  await fetch(`http://${host}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, {
    method: 'DELETE',
  });
});
after(() => deleteApp(app));

test('simula sem gravar, importa, reimporta sem duplicar', async () => {
  const simulado = await importarXml(db, xml, autor, true);
  assert.equal(simulado.criados, 1);
  assert.equal((await db.collection('convenios').get()).size, 0);

  const r = await importarXml(db, xml, autor, false);
  assert.deepEqual([r.lidos, r.criados, r.rejeitados], [2, 1, 1]);
  assert.ok(r.csv.includes('rejeitado;2;') && r.csv.includes('sem data'));

  const convenio = await db.collection('convenios').doc('drupal-1').get();
  assert.equal(convenio.get('numero'), 'PR-1/2026');
  assert.equal(convenio.get('finalizado_em'), null);
  const concedente = await db.collection('concedentes').doc(convenio.get('concedente_id')).get();
  assert.equal(concedente.get('documento'), '11222333000181');
  const historico = await convenio.ref.collection('historico').get();
  assert.deepEqual(
    historico.docs.map((d) => [d.get('acao'), d.get('por')]),
    [['importado', 'd1']],
  );

  const deNovo = await importarXml(db, xml, autor, false);
  assert.deepEqual([deNovo.criados, deNovo.atualizados], [0, 1]);
  assert.equal((await db.collection('convenios').get()).size, 1);
  assert.equal((await db.collection('concedentes').get()).size, 1);
  assert.equal((await convenio.ref.collection('historico').get()).size, 1);
});
