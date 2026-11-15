// Dados fictícios para o Emulator Suite. Uso: npm run seed (com os emuladores no ar).
// Nenhum dado real: nomes inventados e CNPJs gerados com dígito verificador válido.
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

// Alvo: emulador (padrão) ou o projeto dev na nuvem (SEED_ALVO=nuvem, ver docs/DEMO-NUVEM.md).
const nuvem = process.env.SEED_ALVO === 'nuvem';
let senha = 'senha-de-teste';
if (nuvem) {
  const { FIREBASE_PROJECT_ID: projeto, SEED_SENHA, CONFIRMO_NUVEM } = process.env;
  if (!projeto || CONFIRMO_NUVEM !== 'sim' || (SEED_SENHA ?? '').length < 12) {
    console.error('Nuvem exige FIREBASE_PROJECT_ID, CONFIRMO_NUVEM=sim e SEED_SENHA com 12+ caracteres.');
    process.exit(1);
  }
  if (projeto.startsWith('demo-') || /prod/i.test(projeto)) {
    console.error('Recusado: o seed da nuvem é só para o projeto dev.');
    process.exit(1);
  }
  senha = SEED_SENHA;
  if (!getApps().length) initializeApp({ projectId: projeto });
} else {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  if (!getApps().length) initializeApp({ projectId: 'demo-estagios-uff' });
}

const auth = getAuth();
const db = getFirestore();

// --- usuários: um da Divisão (claim) e um sem papel, para mostrar o bloqueio (RN04) ---
async function usuario(uid, email, claims) {
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, email, password: senha });
  if (claims) await auth.setCustomUserClaims(uid, claims);
}
await usuario('divisao-dev', 'divisao@exemplo.test', { divisao: true });
await usuario('externo-dev', 'externo@exemplo.test', null);

// --- CNPJ com dígito verificador válido ---
function cnpj(base12) {
  const dv = (s, pesos) => {
    const r = [...s].reduce((a, c, i) => a + (c.charCodeAt(0) - 48) * pesos[i], 0) % 11;
    return r < 2 ? '0' : String(11 - r);
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(base12, p1);
  return base12 + d1 + dv(base12 + d1, [6, ...p1]);
}

const dia = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const concedentes = [
  { id: 'c1', documento: cnpj('112223330001'), razao_social: 'Alfa Tecnologia Fictícia Ltda', nome_fantasia: 'Alfa Tech', tipo: 'empresa_privada', uf: 'RJ', cidade: 'Niterói', ramo_atividade: 'Software', email: 'estagio@alfa.exemplo.test' },
  { id: 'c2', documento: cnpj('220334440001'), razao_social: 'Instituto Beta de Ensino Fictício', nome_fantasia: 'Instituto Beta', tipo: 'ensino_privada', uf: 'RJ', cidade: 'Rio de Janeiro', ramo_atividade: 'Educação', email: '' },
  { id: 'c3', documento: cnpj('330445550001'), razao_social: 'Prefeitura Municipal de Gama Fictícia', nome_fantasia: '', tipo: 'orgao_publico', uf: 'RJ', cidade: 'Gama', ramo_atividade: 'Administração pública', email: '' },
  { id: 'c4', documento: cnpj('440556660001'), razao_social: 'ONG Delta Solidária', nome_fantasia: 'Delta Solidária', tipo: 'ong_oscip', uf: 'SP', cidade: 'São Paulo', ramo_atividade: 'Assistência social', email: '' },
  { id: 'c5', documento: '52998224725', razao_social: 'Marina Exemplo (profissional liberal)', nome_fantasia: '', tipo: 'profissional_liberal', uf: 'RJ', cidade: 'Niterói', ramo_atividade: 'Psicologia', email: '' },
  { id: 'c6', documento: cnpj('660778880001'), razao_social: 'Agência Épsilon de Integração Ltda', nome_fantasia: 'Épsilon', tipo: 'agente_integracao', uf: 'MG', cidade: 'Belo Horizonte', ramo_atividade: 'Integração de estágios', email: '' },
];

const base = { resolucao_cep: '', resolucao_cep_url: '', objeto: '', minuta: 'padrao_uff', origem: 'concedente', observacoes_internas: '', finalizado_em: null };
const nome = Object.fromEntries(concedentes.map((c) => [c.id, c.nome_fantasia || c.razao_social]));

const convenios = [
  { id: 'v1', c: 'c1', numero: 'PR-212/2026', processo_sei: '23069.179497/2026-46', situacao: 'finalizado', inicio_vigencia: dia(-120), fim_vigencia: dia(1700), objeto: 'Estágio em desenvolvimento de software.', finalizado_em: dia(-125) },
  { id: 'v2', c: 'c2', numero: 'PR-087/2021', processo_sei: '23069.044120/2021-11', situacao: 'finalizado', inicio_vigencia: dia(-1800), fim_vigencia: dia(-60) },
  { id: 'v3', c: 'c3', numero: 'PR-301/2026', processo_sei: '23069.210033/2026-02', situacao: 'finalizado', inicio_vigencia: dia(45), fim_vigencia: dia(1800), minuta: 'externa', origem: 'uff', finalizado_em: dia(-3) },
  { id: 'v4', c: 'c4', numero: '', processo_sei: '23069.230001/2026-77', situacao: 'em_tramitacao', inicio_vigencia: null, fim_vigencia: null, observacoes_internas: 'Aguardando a documentação da concedente.' },
  { id: 'v5', c: 'c5', numero: 'PR-150/2024', processo_sei: '', situacao: 'finalizado', inicio_vigencia: dia(-600), fim_vigencia: dia(25) },
  { id: 'v6', c: 'c6', numero: 'PR-199/2025', processo_sei: '23069.099911/2025-30', situacao: 'cancelado', inicio_vigencia: null, fim_vigencia: null, observacoes_internas: 'Cancelado: cadastrado em duplicidade.' },
  { id: 'v7', c: 'c1', numero: 'PR-044/2023', processo_sei: '23069.030500/2023-90', situacao: 'finalizado', inicio_vigencia: dia(-900), fim_vigencia: dia(900) },
];

const etapasPadrao = [
  ['documentacao_recebida', -140], ['analise', -135], ['termo_preparado', -130],
  ['assinatura_concedente', -128], ['assinatura_pro_reitor', -126], ['extrato_bs', -124],
];

for (const c of concedentes) {
  const { id, ...dados } = c;
  await db.collection('concedentes').doc(id).set(dados);
}

for (const v of convenios) {
  const { id, c, ...dados } = v;
  const ref = db.collection('convenios').doc(id);
  await ref.set({ ...base, ...dados, concedente_id: c, concedente_nome: nome[c] });
  await ref.collection('historico').doc('criado').set({ por: 'divisao-dev', por_nome: 'divisao@exemplo.test', em: FieldValue.serverTimestamp(), acao: 'criado', campos: [] });
  const etapas = v.id === 'v4' ? etapasPadrao.slice(0, 2) : v.situacao === 'finalizado' ? etapasPadrao : [];
  for (const [i, [etapa, deslocamento]] of etapas.entries()) {
    await ref.collection('etapas').doc('e' + i).set({ etapa, data: dia(deslocamento), observacao: '' });
  }
}
console.log('Seed fictício aplicado: 2 usuários, 6 concedentes, 7 convênios.');
