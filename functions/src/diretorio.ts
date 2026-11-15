// Lê o papel de uma pessoa num grupo do Google pela Directory API, com delegação em todo o domínio.
// Sem chave: a Function assina o JWT pela IAM Credentials, usando a conta de serviço que já tem
// a delegação autorizada no Google Admin (`saAlvo`).
import type { DiretorioGrupos, PapelNoGrupo } from './papel.js';

export interface ConfigDiretorio {
  /** E-mail da conta de serviço com a delegação em todo o domínio. */
  saAlvo: string;
  /** Administrador do Workspace que a delegação representa (só leitura). */
  subject: string;
  /** Token de acesso da conta que roda a Function (precisa de tokenCreator em saAlvo). */
  obterTokenIam: () => Promise<string>;
  fetchFn?: typeof fetch;
  agora?: () => number;
}

const ESCOPO = 'https://www.googleapis.com/auth/admin.directory.group.member.readonly';
const PAPEIS: readonly string[] = ['OWNER', 'MANAGER', 'MEMBER'];

async function json(resposta: Response, o_que: string): Promise<Record<string, unknown>> {
  // Não repassamos o corpo da resposta: só o status, para não vazar detalhes do Google.
  if (!resposta.ok) throw new Error(`${o_que}: HTTP ${resposta.status}`);
  return (await resposta.json()) as Record<string, unknown>;
}

export function criarDiretorio(c: ConfigDiretorio): DiretorioGrupos {
  const buscar = c.fetchFn ?? fetch;
  const agora = c.agora ?? (() => Math.floor(Date.now() / 1000));

  // ponytail: um token novo por login; cachear por ~50 min se o volume de logins crescer.
  async function tokenDelegado(): Promise<string> {
    const iat = agora();
    const payload = JSON.stringify({
      iss: c.saAlvo,
      sub: c.subject,
      scope: ESCOPO,
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 300,
    });
    const assinado = await json(
      await buscar(
        `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(c.saAlvo)}:signJwt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await c.obterTokenIam()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payload }),
        },
      ),
      'assinatura do JWT',
    );
    const troca = await json(
      await buscar('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: String(assinado.signedJwt),
        }),
      }),
      'troca do token',
    );
    return String(troca.access_token);
  }

  return {
    async papelNoGrupo(grupo, email): Promise<PapelNoGrupo | null> {
      const resposta = await buscar(
        `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(grupo)}/members/${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${await tokenDelegado()}` } },
      );
      if (resposta.status === 404) return null; // não é membro
      const membro = await json(resposta, 'consulta ao grupo');
      if (membro.status !== undefined && membro.status !== 'ACTIVE') return null;
      return PAPEIS.includes(String(membro.role)) ? (membro.role as PapelNoGrupo) : null;
    },
  };
}
