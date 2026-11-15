import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorioApi } from './diretorioApi.js';

function fetchFalso(resposta: { status?: number; corpo?: unknown }) {
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    return new Response(JSON.stringify(resposta.corpo ?? {}), { status: resposta.status ?? 200 });
  }) as typeof fetch;
  return { fn, chamadas };
}

const URL_MEMBROS = 'https://ldap-abc-uc.a.run.app/grupos/estagios/membros';

const diretorio = (fn: typeof fetch) =>
  criarDiretorioApi({
    urlMembros: URL_MEMBROS,
    obterAutorizacao: async (audiencia) => `Bearer id-token-para-${audiencia}`,
    fetchFn: fn,
  });

test('consulta uma pessoa, com a identidade da Function e a audiência do serviço', async () => {
  const { fn, chamadas } = fetchFalso({ corpo: { role: 'OWNER', status: 'ACTIVE' } });
  const papel = await diretorio(fn).papelNoGrupo('estagios.uff@id.uff.br', 'ana@id.uff.br');
  assert.equal(papel, 'OWNER');
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, `${URL_MEMBROS}/ana%40id.uff.br`);
  assert.equal(
    (chamadas[0].init?.headers as Record<string, string>).Authorization,
    'Bearer id-token-para-https://ldap-abc-uc.a.run.app',
  );
});

test('404 significa que a pessoa não é membro', async () => {
  const { fn } = fetchFalso({ status: 404 });
  assert.equal(await diretorio(fn).papelNoGrupo('g', 'x@id.uff.br'), null);
});

test('membro suspenso ou papel desconhecido não conta; sem status vale', async () => {
  for (const [corpo, esperado] of [
    [{ role: 'MEMBER', status: 'SUSPENDED' }, null],
    [{ role: 'OUTRO', status: 'ACTIVE' }, null],
    [{ role: 'MEMBER' }, 'MEMBER'],
  ] as const) {
    const { fn } = fetchFalso({ corpo });
    assert.equal(await diretorio(fn).papelNoGrupo('g', 'x@id.uff.br'), esperado);
  }
});

test('401, 403 e 500 viram erro, sem vazar o corpo da resposta', async () => {
  for (const status of [401, 403, 500]) {
    const { fn } = fetchFalso({ status, corpo: { email: 'pessoa@id.uff.br' } });
    await assert.rejects(
      diretorio(fn).papelNoGrupo('g', 'x@id.uff.br'),
      (e: Error) => e.message.includes(`HTTP ${status}`) && !e.message.includes('pessoa@'),
    );
  }
});

test('o e-mail é codificado na URL (sem injeção de caminho)', async () => {
  const { fn, chamadas } = fetchFalso({ status: 404 });
  await diretorio(fn).papelNoGrupo('g', '../admin@id.uff.br');
  assert.equal(chamadas[0].url, `${URL_MEMBROS}/..%2Fadmin%40id.uff.br`);
});
