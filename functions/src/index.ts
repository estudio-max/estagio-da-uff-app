import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GoogleAuth } from 'google-auth-library';
import { criarDiretorio } from './diretorio.js';
import { criarDiretorioApi } from './diretorioApi.js';
import { criarDiretorioLista } from './diretorioLista.js';
import { decidirPapel, type DiretorioGrupos, type PapelNoGrupo } from './papel.js';
import { saudacao } from './saudacao.js';

setGlobalOptions({ region: 'southamerica-east1' });
if (!getApps().length) initializeApp();

// Fase 0: só prova que o pipeline de Functions funciona de ponta a ponta.
export const ola = onRequest((req, res) => {
  res.send(saudacao(req.query.nome as string | undefined));
});

// D26: valores (não secretos) vêm de functions/.env.<projeto>; ver docs/CONFIGURAR-GRUPO.md.
/** Variável de ambiente (vem de functions/.env.<projeto>), com valor padrão. */
const env = (nome: string, padrao = ''): string => (process.env[nome] ?? padrao).trim();

const grupoEmail = (): string => env('GRUPO_EMAIL');
const dominioPermitido = (): string => env('DOMINIO_PERMITIDO', 'id.uff.br');
const papeisComAcesso = (): string => env('PAPEIS_COM_ACESSO', 'OWNER,MANAGER,MEMBER');
// Ponte provisória: lista de e-mails autorizados (ex.: ana@id.uff.br, bia@id.uff.br:MANAGER).
// Se preenchida, vale no lugar do grupo; esvazie para voltar à API ou à Directory API.
const emailsAutorizados = (): string => env('EMAILS_AUTORIZADOS');
// Caminho provisório: API do grupo no Cloud Run (docs/API-GRUPO.md). Se vazio, usa a Directory API.
const diretorioApiUrl = (): string => env('DIRECTORY_API_URL');
// Caminho direto pela Directory API (delegação em todo o domínio).
const diretorioSa = (): string => env('DIRECTORY_SA');
const diretorioSubject = (): string => env('DIRECTORY_SUBJECT');

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

function diretorioConfigurado(): DiretorioGrupos {
  // Precedência: lista de e-mails, depois a API do grupo, depois a Directory API.
  if (emailsAutorizados().trim()) return criarDiretorioLista(emailsAutorizados());
  const urlApi = diretorioApiUrl().trim();
  if (urlApi) {
    return criarDiretorioApi({
      urlMembros: urlApi.replace(/\/+$/, ''),
      // Identidade da própria Function (ID token do Google); nenhuma chave é guardada.
      obterAutorizacao: async (audiencia) => {
        const cliente = await auth.getIdTokenClient(audiencia);
        const autorizacao = (await cliente.getRequestHeaders()).get('Authorization');
        if (!autorizacao) throw new Error('sem token de identidade da Function');
        return autorizacao;
      },
    });
  }
  if (!diretorioSa() || !diretorioSubject()) {
    throw new Error(
      'configure EMAILS_AUTORIZADOS, DIRECTORY_API_URL ou DIRECTORY_SA e DIRECTORY_SUBJECT',
    );
  }
  return criarDiretorio({
    saAlvo: diretorioSa(),
    subject: diretorioSubject(),
    obterTokenIam: async () => {
      const t = await auth.getAccessToken();
      if (!t) throw new Error('sem token da conta da Function');
      return t;
    },
  });
}

/**
 * Chamada pelo app logo depois do login com Google: confere o grupo e grava a claim `divisao`.
 * Se o grupo não puder ser consultado, nada muda (não concede e não revoga).
 */
export const sincronizarPapel = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre primeiro.');
  const { uid, token } = req.auth;

  let decisao;
  try {
    decisao = await decidirPapel({
      email: token.email,
      emailVerificado: token.email_verified,
      dominio: dominioPermitido(),
      grupo: grupoEmail(),
      papeisComAcesso: papeisComAcesso().split(',').map((p) => p.trim()) as PapelNoGrupo[],
      diretorio: diretorioConfigurado(),
    });
  } catch (e) {
    logger.error('consulta ao grupo falhou', { uid, erro: (e as Error).message });
    throw new HttpsError('unavailable', 'Não foi possível consultar o grupo agora. Tente de novo.');
  }

  if ((token.divisao === true) !== decisao.divisao) {
    await getAuth().setCustomUserClaims(uid, decisao.divisao ? { divisao: true } : {});
  }
  logger.info('papel sincronizado', { uid, motivo: decisao.motivo, papel: decisao.papel });
  return { divisao: decisao.divisao, motivo: decisao.motivo };
});
