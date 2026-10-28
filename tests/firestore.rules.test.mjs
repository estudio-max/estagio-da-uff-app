import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, getDocs } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-estagios-uff',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(() => env.cleanup());

const anonimo = () => env.unauthenticatedContext().firestore();
const autenticado = () => env.authenticatedContext('u1').firestore();

test('anônimo não lê convenios', () =>
  assertFails(getDocs(collection(anonimo(), 'convenios'))));

test('autenticado lê convenios', () =>
  assertSucceeds(getDocs(collection(autenticado(), 'convenios'))));

for (const [nome, db] of [['anônimo', anonimo], ['autenticado', autenticado]]) {
  test(`${nome} não escreve em convenios`, () =>
    assertFails(addDoc(collection(db(), 'convenios'), { x: 1 })));
}

test('autenticado não lê outras coleções', () =>
  assertFails(getDocs(collection(autenticado(), 'concedentes'))));
