// Página pública contra o emulador do Firestore: só convênios publicáveis e só campos públicos
// (porta de test_campos_internos_nao_vazam_na_lista_nem_no_detalhe, com o caminho real).
// Roda com `npm run test:emulador`, que sobe o emulador; fora dele, este arquivo não é executado.
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { responder } from './paginaPublica.js';
import { carregarPublicos } from './paginaPublicaFirestore.js';

const PROJETO = 'demo-estagios-uff';
const app = initializeApp({ projectId: PROJETO }, 'teste-pagina-publica');
const db = getFirestore(app);
const HOJE = '2026-10-06';

beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  assert.ok(host, 'rode com o emulador (npm run test:emulador)');
  await fetch(`http://${host}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, {
    method: 'DELETE',
  });
});
after(() => deleteApp(app));

test('lê só os publicáveis e só os campos públicos', async () => {
  await db.doc('concedentes/k1').set({
    razao_social: 'Empresa Fictícia Ltda',
    nome_fantasia: 'Fictícia',
    documento: '11222333000181',
    tipo: 'empresa_privada',
    uf: 'RJ',
    cidade: 'Niterói',
    ramo_atividade: 'Serviços',
    email: 'contato-interno@ficticia.example',
  });
  const base = {
    concedente_id: 'k1',
    concedente_nome: 'Empresa Fictícia Ltda',
    processo_sei: '23069.000001/2026-00',
    objeto: 'Estágios.',
    situacao: 'finalizado',
    inicio_vigencia: '2026-01-01',
    fim_vigencia: '2030-12-31',
    observacoes_internas: 'NOTA-INTERNA-SECRETA',
    resolucao_cep: 'RESOLUCAO-INTERNA-123',
    minuta: 'externa',
  };
  await db.doc('convenios/vigente').set({ ...base, numero: 'PR-1/2026' });
  await db.doc('convenios/vigente/etapas/e1').set({ etapa: 'analise', observacao: 'ETAPA-INTERNA' });
  await db.doc('convenios/tramitando').set({ ...base, numero: 'PR-2/2026', situacao: 'em_tramitacao' });
  await db.doc('convenios/vencido').set({ ...base, numero: 'PR-3/2020', fim_vigencia: '2026-10-05' });
  await db.doc('convenios/orfao').set({ ...base, numero: 'PR-4/2026', concedente_id: 'nao-existe' });

  const publicos = await carregarPublicos(db, HOJE);
  assert.deepEqual(
    publicos.map((c) => c.numero),
    ['PR-1/2026'],
  );
  const [c] = publicos;
  assert.deepEqual(Object.keys(c).sort(), [
    'concedente', 'fim_vigencia', 'id', 'inicio_vigencia', 'numero', 'objeto', 'processo_sei', 'situacao',
  ]);
  assert.ok(!('email' in c.concedente));

  const vazio = new URLSearchParams();
  for (const caminho of ['/convenios', '/convenios/vigente']) {
    const { status, html } = responder(publicos, HOJE, caminho, vazio);
    assert.equal(status, 200);
    assert.ok(html.includes('PR-1/2026'));
    for (const segredo of ['NOTA-INTERNA', 'contato-interno', 'RESOLUCAO-INTERNA', 'ETAPA-INTERNA', 'Externa']) {
      assert.ok(!html.includes(segredo), segredo);
    }
  }
  assert.equal(responder(publicos, HOJE, '/convenios/tramitando', vazio).status, 404);
});
