import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-estagios-uff',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(() => env.clearFirestore());
after(() => env.cleanup());

const anonimo = () => env.unauthenticatedContext().firestore();
const semPapel = () => env.authenticatedContext('u1').firestore();
const divisao = () => env.authenticatedContext('d1', { divisao: true }).firestore();

const concedente = {
  documento: '11222333000181',
  razao_social: 'Empresa Fictícia Ltda',
  tipo: 'empresa_privada',
  uf: 'RJ',
  cidade: 'Niterói',
};

const convenio = {
  concedente_id: 'c1',
  concedente_nome: 'Empresa Fictícia Ltda',
  numero: 'PR-001/2026',
  minuta: 'padrao_uff',
  origem: 'concedente',
  situacao: 'finalizado',
  inicio_vigencia: '2026-01-01',
  fim_vigencia: '2030-12-31',
};

const semar = (db, caminho, dados) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), caminho), dados));

// --- RN04: só a Divisão lê e escreve ---

for (const [nome, db] of [['anônimo', anonimo], ['autenticado sem papel', semPapel]]) {
  test(`${nome} não lê convênios nem concedentes`, async () => {
    await assertFails(getDocs(collection(db(), 'convenios')));
    await assertFails(getDocs(collection(db(), 'concedentes')));
  });
  test(`${nome} não escreve convênio nem concedente`, async () => {
    await assertFails(addDoc(collection(db(), 'convenios'), convenio));
    await assertFails(addDoc(collection(db(), 'concedentes'), concedente));
  });
}

test('divisão lê e cria concedente e convênio', async () => {
  const db = divisao();
  await assertSucceeds(addDoc(collection(db, 'concedentes'), concedente));
  await assertSucceeds(addDoc(collection(db, 'convenios'), convenio));
  await assertSucceeds(getDocs(collection(db, 'convenios')));
});

test('ninguém exclui: convênio errado vira cancelado', async () => {
  await semar(null, 'convenios/x', convenio);
  await semar(null, 'concedentes/c1', concedente);
  await assertFails(deleteDoc(doc(divisao(), 'convenios/x')));
  await assertFails(deleteDoc(doc(divisao(), 'concedentes/c1')));
  await assertSucceeds(updateDoc(doc(divisao(), 'convenios/x'), { situacao: 'cancelado' }));
});

test('outras coleções seguem fechadas, até para a divisão', async () => {
  await assertFails(getDocs(collection(divisao(), 'qualquer')));
});

// --- Invariantes (no Django, constraints do banco) ---

test('fim antes do início é barrado', async () => {
  await assertFails(
    addDoc(collection(divisao(), 'convenios'), {
      ...convenio,
      inicio_vigencia: '2026-05-01',
      fim_vigencia: '2026-04-01',
    }),
  );
});

for (const campo of ['numero', 'inicio_vigencia', 'fim_vigencia']) {
  test(`finalizado exige ${campo}`, async () => {
    const vazio = campo === 'numero' ? '' : null;
    await assertFails(addDoc(collection(divisao(), 'convenios'), { ...convenio, [campo]: vazio }));
  });
}

test('em tramitação pode ficar sem número e datas', async () => {
  const rascunho = {
    ...convenio,
    numero: '',
    situacao: 'em_tramitacao',
    inicio_vigencia: null,
    fim_vigencia: null,
  };
  await assertSucceeds(addDoc(collection(divisao(), 'convenios'), rascunho));
  await assertSucceeds(addDoc(collection(divisao(), 'convenios'), rascunho));
});

test('situação, minuta e origem fora da lista são barradas', async () => {
  for (const ruim of [{ situacao: 'publicado' }, { minuta: 'x' }, { origem: 'x' }]) {
    await assertFails(addDoc(collection(divisao(), 'convenios'), { ...convenio, ...ruim }));
  }
});

test('concedente: tipo fora dos 9 da RN05 e documento ausente são barrados', async () => {
  await assertFails(addDoc(collection(divisao(), 'concedentes'), { ...concedente, tipo: 'x' }));
  await assertFails(addDoc(collection(divisao(), 'concedentes'), { ...concedente, documento: null }));
  await assertFails(addDoc(collection(divisao(), 'concedentes'), { ...concedente, documento: '123' }));
});

// --- RF02: etapas ---

test('divisão registra etapa; etapa inválida é barrada; ninguém apaga', async () => {
  await semar(null, 'convenios/x', convenio);
  const etapas = collection(divisao(), 'convenios/x/etapas');
  await assertSucceeds(addDoc(etapas, { etapa: 'analise', data: '2026-09-01', observacao: '' }));
  await assertFails(addDoc(etapas, { etapa: 'inventada', data: '2026-09-01' }));
  await semar(null, 'convenios/x/etapas/e1', { etapa: 'analise', data: '2026-09-01' });
  await assertFails(deleteDoc(doc(divisao(), 'convenios/x/etapas/e1')));
  await assertFails(addDoc(collection(semPapel(), 'convenios/x/etapas'), { etapa: 'analise', data: '2026-09-01' }));
});

// --- RF08: histórico só se acrescenta ---

test('histórico: quem e quando vêm do servidor e o registro é imutável', async () => {
  await semar(null, 'convenios/x', convenio);
  const hist = collection(divisao(), 'convenios/x/historico');
  const ok = { por: 'd1', em: serverTimestamp(), acao: 'alterado', campos: ['numero'] };
  await assertSucceeds(addDoc(hist, ok));
  await assertFails(addDoc(hist, { ...ok, por: 'outra-pessoa' }));
  await assertFails(addDoc(hist, { ...ok, em: new Date('2020-01-01') }));
  await semar(null, 'convenios/x/historico/h1', { por: 'd1', em: new Date(), acao: 'criado' });
  await assertFails(updateDoc(doc(divisao(), 'convenios/x/historico/h1'), { acao: 'x' }));
  await assertFails(deleteDoc(doc(divisao(), 'convenios/x/historico/h1')));
  await assertSucceeds(getDoc(doc(divisao(), 'convenios/x/historico/h1')));
  await assertFails(getDocs(collection(semPapel(), 'convenios/x/historico')));
});
