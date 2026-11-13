import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorio } from './diretorio.js';

interface Chamada {
  url: string;
  init?: RequestInit;
}

/** Fetch falso: responde na ordem e guarda as chamadas. */
function fetchFalso(respostas: Array<{ status?: number; corpo?: unknown }>) {
  const chamadas: Chamada[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });
    const r = respostas.shift() ?? { status: 500 };
    const status = r.status ?? 200;
    return new Response(JSON.stringify(r.corpo ?? {}), { status });
  }) as typeof fetch;
  return { fn, chamadas };
}

const config = (fn: typeof fetch) => ({
  saAlvo: 'sa-diretorio@projeto.iam.gserviceaccount.com',
  subject: 'admin-leitura@id.uff.br',
  obterTokenIam: async () => 'token-iam',
  fetchFn: fn,
  agora: () => 1000,
});

const sucessoAteToken = [
  { corpo: { signedJwt: 'jwt-assinado' } },
  { corpo: { access_token: 'token-delegado' } },
];

test('assina o JWT delegado, troca pelo token e consulta o membro', async () => {
  const { fn, chamadas } = fetchFalso([
    ...sucessoAteToken,
    { corpo: { role: 'MANAGER', status: 'ACTIVE' } },
  ]);
  const papel = await criarDiretorio(config(fn)).papelNoGrupo(
    'estagios.uff@id.uff.br',
    'ana@id.uff.br',
  );
  assert.equal(papel, 'MANAGER');
  assert.equal(chamadas.length, 3);

  // 1) assinatura: usa a conta com delegação, representa o administrador, só o escopo de leitura
  assert.match(chamadas[0].url, /iamcredentials\.googleapis\.com.*sa-diretorio%40projeto.*:signJwt/);
  assert.equal((chamadas[0].init?.headers as Record<string, string>).Authorization, 'Bearer token-iam');
  const payload = JSON.parse(JSON.parse(String(chamadas[0].init?.body)).payload);
  assert.equal(payload.iss, 'sa-diretorio@projeto.iam.gserviceaccount.com');
  assert.equal(payload.sub, 'admin-leitura@id.uff.br');
  assert.equal(
    payload.scope,
    'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  );
  assert.equal(payload.exp - payload.iat, 300);

  // 2) troca do JWT assinado pelo token
  assert.equal(chamadas[1].url, 'https://oauth2.googleapis.com/token');
  assert.match(String(chamadas[1].init?.body), /assertion=jwt-assinado/);

  // 3) consulta ao grupo, com o e-mail e o grupo codificados na URL
  assert.equal(
    chamadas[2].url,
    'https://admin.googleapis.com/admin/directory/v1/groups/estagios.uff%40id.uff.br/members/ana%40id.uff.br',
  );
  assert.equal((chamadas[2].init?.headers as Record<string, string>).Authorization, 'Bearer token-delegado');
});

test('404 significa que a pessoa não é membro', async () => {
  const { fn } = fetchFalso([...sucessoAteToken, { status: 404 }]);
  const papel = await criarDiretorio(config(fn)).papelNoGrupo('g@id.uff.br', 'x@id.uff.br');
  assert.equal(papel, null);
});

test('membro suspenso ou com papel desconhecido não conta', async () => {
  for (const corpo of [
    { role: 'MEMBER', status: 'SUSPENDED' },
    { role: 'OUTRO', status: 'ACTIVE' },
  ]) {
    const { fn } = fetchFalso([...sucessoAteToken, { corpo }]);
    const papel = await criarDiretorio(config(fn)).papelNoGrupo('g@id.uff.br', 'x@id.uff.br');
    assert.equal(papel, null);
  }
});

test('erro do Google (500) e falha na assinatura propagam, sem vazar o corpo', async () => {
  const { fn } = fetchFalso([...sucessoAteToken, { status: 500, corpo: { segredo: 'x' } }]);
  await assert.rejects(
    criarDiretorio(config(fn)).papelNoGrupo('g@id.uff.br', 'x@id.uff.br'),
    (e: Error) => /HTTP 500/.test(e.message) && !/segredo/.test(e.message),
  );

  const { fn: fn2 } = fetchFalso([{ status: 403 }]);
  await assert.rejects(
    criarDiretorio(config(fn2)).papelNoGrupo('g@id.uff.br', 'x@id.uff.br'),
    /assinatura do JWT: HTTP 403/,
  );
});
