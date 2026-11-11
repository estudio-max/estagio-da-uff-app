import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';
import { criarDiretorio } from './diretorio.js';
import { decidirPapel, type PapelNoGrupo } from './papel.js';
import { saudacao } from './saudacao.js';

setGlobalOptions({ region: 'southamerica-east1' });
if (!getApps().length) initializeApp();

// Fase 0: só prova que o pipeline de Functions funciona de ponta a ponta.
export const ola = onRequest((req, res) => {
  res.send(saudacao(req.query.nome as string | undefined));
});

// D26: valores (não secretos) vêm de functions/.env.<projeto>; ver docs/CONFIGURAR-GRUPO.md.
const grupoEmail = defineString('GRUPO_EMAIL');
const dominioPermitido = defineString('DOMINIO_PERMITIDO', { default: 'id.uff.br' });
const diretorioSa = defineString('DIRECTORY_SA');
const diretorioSubject = defineString('DIRECTORY_SUBJECT');
const papeisComAcesso = defineString('PAPEIS_COM_ACESSO', { default: 'OWNER,MANAGER,MEMBER' });

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

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
      dominio: dominioPermitido.value(),
      grupo: grupoEmail.value(),
      papeisComAcesso: papeisComAcesso.value().split(',').map((p) => p.trim()) as PapelNoGrupo[],
      diretorio: criarDiretorio({
        saAlvo: diretorioSa.value(),
        subject: diretorioSubject.value(),
        obterTokenIam: async () => {
          const t = await auth.getAccessToken();
          if (!t) throw new Error('sem token da conta da Function');
          return t;
        },
      }),
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
