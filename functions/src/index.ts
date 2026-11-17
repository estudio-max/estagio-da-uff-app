import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { GoogleAuth } from 'google-auth-library';
import { ANTECEDENCIAS_PADRAO, enviarAlertas, hojeEmBrasilia, lerAntecedencias } from './alertas.js';
import { type Enviador, dependenciasFirestore, enviadorSmtp } from './alertasFirestore.js';
import { criarDiretorio } from './diretorio.js';
import { criarDiretorioApi } from './diretorioApi.js';
import { criarDiretorioLista } from './diretorioLista.js';
import { importarXml } from './importacaoFirestore.js';
import { claimsComDivisao, decidirPapel, lerPapeisComAcesso, type DiretorioGrupos } from './papel.js';
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
      papeisComAcesso: lerPapeisComAcesso(papeisComAcesso()),
      diretorio: diretorioConfigurado(),
    });
  } catch (e) {
    logger.error('consulta ao grupo falhou', { uid, erro: (e as Error).message });
    throw new HttpsError('unavailable', 'Não foi possível consultar o grupo agora. Tente de novo.');
  }

  // Lê as claims gravadas (o token pode estar até 1 hora atrasado) e só mexe na `divisao`.
  const { customClaims } = await getAuth().getUser(uid);
  const novas = claimsComDivisao(customClaims, decisao.divisao);
  if (novas !== null) await getAuth().setCustomUserClaims(uid, novas);
  logger.info('papel sincronizado', { uid, motivo: decisao.motivo, papel: decisao.papel });
  return { divisao: decisao.divisao, motivo: decisao.motivo };
});

/**
 * RF07: importa o XML exportado do estagio.uff.br (Drupal). Só a Divisão (RN04).
 * Recebe `{ xml, simular }`; com `simular`, nada é gravado. Devolve as contagens e o
 * relatório CSV de rejeitados e avisos. Pode rodar de novo: a chave é o nó do Drupal.
 */
export const importarConveniosDrupal = onCall(
  { timeoutSeconds: 540, memory: '1GiB' },
  async (req) => {
    if (req.auth?.token.divisao !== true) {
      throw new HttpsError('permission-denied', 'Só a Divisão de Estágio importa convênios.');
    }
    const { xml, simular } = (req.data ?? {}) as { xml?: unknown; simular?: unknown };
    if (typeof xml !== 'string' || !xml.trim()) {
      throw new HttpsError('invalid-argument', 'Envie o conteúdo do XML exportado do Drupal.');
    }
    const autor = { uid: req.auth.uid, email: (req.auth.token.email as string | undefined) ?? null };
    let resultado;
    try {
      resultado = await importarXml(getFirestore(), xml, autor, simular === true);
    } catch (e) {
      logger.error('importação falhou', { uid: autor.uid, erro: (e as Error).message });
      throw new HttpsError('internal', 'A importação falhou. Rodar de novo completa o que faltou.');
    }
    // Só contagens no log: o relatório tem nomes e CNPJs das concedentes.
    const { csv: _csv, ...contagens } = resultado;
    logger.info('importação do Drupal', { uid: autor.uid, ...contagens });
    return resultado;
  },
);

// RF05: SMTP no Secret Manager (`firebase functions:secrets:set SMTP_URL`); o resto vem do .env.
const smtpUrl = defineSecret('SMTP_URL');

/** No emulador, sem SMTP configurado, o e-mail sai no log (como o console do Django em debug). */
function enviadorConfigurado(): Enviador {
  const url = smtpUrl.value().trim();
  if (url) return enviadorSmtp(url, env('EMAIL_REMETENTE', 'nao-responda@id.uff.br'));
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return async (email) => {
      logger.info('e-mail (emulador, não enviado)', email);
    };
  }
  throw new Error('Defina o segredo SMTP_URL para enviar os alertas.');
}

/**
 * RF05: alertas de vencimento para a Divisão, uma vez por dia (D3: antecedências em
 * ALERTA_ANTECEDENCIAS_DIAS). Um único e-mail com os avisos novos; cada aviso fica
 * registrado em `convenios/{id}/alertas` e não se repete. Se falhar, o dia seguinte reenvia.
 */
export const enviarAlertasVencimento = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', secrets: [smtpUrl] },
  async () => {
    const enviados = await enviarAlertas(
      hojeEmBrasilia(),
      {
        divisaoEmail: env('DIVISAO_EMAIL'),
        antecedencias: lerAntecedencias(env('ALERTA_ANTECEDENCIAS_DIAS', ANTECEDENCIAS_PADRAO)),
        appUrl: env('APP_URL'),
      },
      dependenciasFirestore(getFirestore(), enviadorConfigurado()),
    );
    // Só a contagem: o e-mail tem nomes de concedentes.
    logger.info('alertas de vencimento', { enviados });
  },
);
