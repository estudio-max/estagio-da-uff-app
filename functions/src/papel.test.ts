import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decidirPapel, type DiretorioGrupos, type PapelNoGrupo } from './papel.js';

const diretorio = (papeis: Record<string, PapelNoGrupo>): DiretorioGrupos => ({
  papelNoGrupo: async (_grupo, email) => papeis[email] ?? null,
});

const base = {
  dominio: 'id.uff.br',
  grupo: 'estagios.uff@id.uff.br',
  papeisComAcesso: ['OWNER', 'MANAGER', 'MEMBER'] as PapelNoGrupo[],
  diretorio: diretorio({
    'ana@id.uff.br': 'MEMBER',
    'bia@id.uff.br': 'MANAGER',
    'cosme@id.uff.br': 'OWNER',
  }),
};

test('membro do grupo com e-mail verificado recebe o papel', async () => {
  const d = await decidirPapel({ ...base, email: 'ana@id.uff.br', emailVerificado: true });
  assert.deepEqual(d, { divisao: true, papel: 'MEMBER', motivo: 'ok' });
});

test('gerente e proprietário também são membros (um papel só por pessoa)', async () => {
  for (const [email, papel] of [['bia@id.uff.br', 'MANAGER'], ['cosme@id.uff.br', 'OWNER']]) {
    const d = await decidirPapel({ ...base, email, emailVerificado: true });
    assert.equal(d.divisao, true);
    assert.equal(d.papel, papel);
  }
});

test('o e-mail é normalizado (caixa e espaços)', async () => {
  const d = await decidirPapel({ ...base, email: '  ANA@ID.UFF.BR ', emailVerificado: true });
  assert.equal(d.divisao, true);
});

test('e-mail ausente ou não verificado é barrado antes de consultar o grupo', async () => {
  let consultas = 0;
  const contador: DiretorioGrupos = {
    papelNoGrupo: async () => {
      consultas++;
      return 'MEMBER';
    },
  };
  const semEmail = await decidirPapel({ ...base, diretorio: contador, emailVerificado: true });
  const naoVerificado = await decidirPapel({
    ...base,
    diretorio: contador,
    email: 'ana@id.uff.br',
    emailVerificado: false,
  });
  assert.equal(semEmail.motivo, 'sem_email');
  assert.equal(naoVerificado.motivo, 'email_nao_verificado');
  assert.equal(consultas, 0);
});

test('fora do domínio é barrado, inclusive subdomínio e sufixo parecido', async () => {
  for (const email of [
    'ana@gmail.com',
    'ana@sub.id.uff.br',
    'ana@notid.uff.br',
    'ana@id.uff.br.evil.com',
  ]) {
    const d = await decidirPapel({ ...base, email, emailVerificado: true });
    assert.equal(d.divisao, false, email);
    assert.equal(d.motivo, 'dominio', email);
  }
});

test('quem não está no grupo não recebe o papel', async () => {
  const d = await decidirPapel({ ...base, email: 'zeca@id.uff.br', emailVerificado: true });
  assert.deepEqual(d, { divisao: false, papel: null, motivo: 'fora_do_grupo' });
});

test('papéis podem ser restringidos (ex.: só MEMBER)', async () => {
  const d = await decidirPapel({
    ...base,
    papeisComAcesso: ['MEMBER'],
    email: 'cosme@id.uff.br',
    emailVerificado: true,
  });
  assert.deepEqual(d, { divisao: false, papel: 'OWNER', motivo: 'papel_sem_acesso' });
});

test('falha do diretório propaga (a Function não concede nada)', async () => {
  const quebrado: DiretorioGrupos = {
    papelNoGrupo: async () => {
      throw new Error('HTTP 503');
    },
  };
  await assert.rejects(
    decidirPapel({ ...base, diretorio: quebrado, email: 'ana@id.uff.br', emailVerificado: true }),
    /503/,
  );
});
