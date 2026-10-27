// Dados fictícios para o Emulator Suite. Uso: npm run seed (com os emuladores no ar).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
if (!getApps().length) initializeApp({ projectId: 'demo-estagios-uff' });

await getAuth()
  .createUser({ uid: 'divisao-dev', email: 'divisao@exemplo.test', password: 'senha-de-teste' })
  .catch((e) => {
    if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') throw e;
  });

const db = getFirestore();
const convenios = [
  { id: 'c1', concedente: 'Empresa Fictícia Alfa', status: 'Vigente', vigencia_fim: '2027-03-05' },
  { id: 'c2', concedente: 'Instituto Fictício Beta', status: 'Vencido', vigencia_fim: '2025-11-20' },
  { id: 'c3', concedente: 'Órgão Fictício Gama', status: 'Vigente', vigencia_fim: '2028-01-15' },
];
for (const { id, ...dados } of convenios) await db.collection('convenios').doc(id).set(dados);
console.log('Seed fictício aplicado.');
