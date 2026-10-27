import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import {
  assertFails,
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

// Fase 0: tudo fechado, para anônimo e para usuário autenticado.
for (const [nome, ctx] of [
  ['anônimo', () => env.unauthenticatedContext()],
  ['autenticado', () => env.authenticatedContext('u1')],
]) {
  test(`${nome} não lê convenios`, async () => {
    await assertFails(getDocs(collection(ctx().firestore(), 'convenios')));
  });
  test(`${nome} não escreve em convenios`, async () => {
    await assertFails(addDoc(collection(ctx().firestore(), 'convenios'), { x: 1 }));
  });
}
