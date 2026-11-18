import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorioApi } from './diretorioApi.js';

function fetchFalso(resposta: { status?: number; corpo?: unknown; texto?: string }) {
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    const corpo = resposta.texto ?? JSON.stringify(resposta.corpo ?? {});
    return new Response(corpo, { status: resposta.status ?? 200 });
  }) as typeof fetch;
  return { fn, chamadas };
}

const URL_MEMBROS = 'https://ldap-abc-uc.a.run.app/grupos/estagios/membros';
const GRUPO = 'estagios.uff@id.uff.br';
const membro = (m: Record<string, unknown>) => ({
  ok: true,
  groupName: 'Estágios UFF',
  member: { email: 'ana@id.uff.br', ...m },
});

const diretorio = (fn: typeof fetch) =>
  criarDiretorioApi({ urlMembros: URL_MEMBROS, autorizacao: 'Bearer token-da-ana', fetchFn: fn });

test('consulta /membros/me com o grupo no parâmetro e o token de quem entrou', async () => {
  const { fn, chamadas } = fetchFalso({ corpo: membro({ role: 'OWNER', status: 'ACTIVE' }) });
  assert.equal(await diretorio(fn).papelNoGrupo(GRUPO, 'ana@id.uff.br'), 'OWNER');
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, `${URL_MEMBROS}/me?email=estagios.uff%40id.uff.br`);
  assert.equal(
    (chamadas[0].init?.headers as Record<string, string>).Authorization,
    'Bearer token-da-ana',
  );
});

test('404 da API ({ ok: false }) significa que a pessoa não está no grupo', async () => {
  const { fn } = fetchFalso({
    status: 404,
    corpo: { ok: false, error: 'Grupo ou usuário no grupo não encontrado.' },
  });
  assert.equal(await diretorio(fn).papelNoGrupo(GRUPO, 'ana@id.uff.br'), null);
});

test('404 sem a resposta da API (rota ou URL errada) é erro, não "fora do grupo"', async () => {
  const { fn } = fetchFalso({ status: 404, texto: '<pre>Cannot GET /x</pre>' });
  await assert.rejects(diretorio(fn).papelNoGrupo(GRUPO, 'ana@id.uff.br'), /HTTP 404/);
});

test('membro suspenso ou papel desconhecido não conta; sem status vale', async () => {
  for (const [m, esperado] of [
    [{ role: 'MEMBER', status: 'SUSPENDED' }, null],
    [{ role: 'OUTRO', status: 'ACTIVE' }, null],
    [{ role: 'MEMBER' }, 'MEMBER'],
  ] as const) {
    const { fn } = fetchFalso({ corpo: membro(m) });
    assert.equal(await diretorio(fn).papelNoGrupo(GRUPO, 'ana@id.uff.br'), esperado);
  }
});

test('resposta de outra pessoa é erro', async () => {
  const { fn } = fetchFalso({ corpo: membro({ email: 'bia@id.uff.br', role: 'OWNER' }) });
  await assert.rejects(diretorio(fn).papelNoGrupo(GRUPO, 'ana@id.uff.br'), /outra pessoa/);
});

test('400, 401, 403 e 500 viram erro, sem vazar o corpo da resposta', async () => {
  for (const status of [400, 401, 403, 500]) {
    const { fn } = fetchFalso({ status, corpo: { ok: false, error: 'pessoa@id.uff.br' } });
    await assert.rejects(
      diretorio(fn).papelNoGrupo(GRUPO, 'ana@id.uff.br'),
      (e: Error) => e.message.includes(`HTTP ${status}`) && !e.message.includes('pessoa@'),
    );
  }
});

test('sem token ou sem grupo, não consulta', async () => {
  const { fn, chamadas } = fetchFalso({ corpo: membro({ role: 'OWNER' }) });
  assert.throws(() => criarDiretorioApi({ urlMembros: URL_MEMBROS, autorizacao: '', fetchFn: fn }));
  await assert.rejects(diretorio(fn).papelNoGrupo(' ', 'ana@id.uff.br'), /GRUPO_EMAIL/);
  assert.equal(chamadas.length, 0);
});

test('o grupo é codificado no parâmetro (sem injeção)', async () => {
  const { fn, chamadas } = fetchFalso({ status: 404, corpo: { ok: false } });
  await diretorio(fn).papelNoGrupo('a@id.uff.br&x=1', 'ana@id.uff.br');
  assert.equal(chamadas[0].url, `${URL_MEMBROS}/me?email=a%40id.uff.br%26x%3D1`);
});
