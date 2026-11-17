/** RF05: leitura dos convênios e registro dos avisos no Firestore (Admin SDK). */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createTransport } from 'nodemailer';
import {
  type Alerta,
  type AlertaRegistrado,
  type ConvenioAlvo,
  type DependenciasAlertas,
  type Email,
  idAlerta,
} from './alertas.js';

/** Folga sob o limite do lote; os ids são fixos, então rodar de novo completa. */
const OPERACOES_POR_LOTE = 450;

/**
 * Lê só os convênios cujo fim cai na janela dos avisos (filtro de um campo: dispensa índice
 * composto) e, de cada um, os avisos já registrados em `convenios/{id}/alertas`.
 */
async function carregar(db: Firestore, de: string, ate: string) {
  const snap = await db
    .collection('convenios')
    .where('fim_vigencia', '>=', de)
    .where('fim_vigencia', '<=', ate)
    .get();
  const convenios: ConvenioAlvo[] = snap.docs.map((d) => ({
    id: d.id,
    numero: d.get('numero') ?? '',
    concedente_nome: d.get('concedente_nome') ?? '',
    situacao: d.get('situacao') ?? '',
    inicio_vigencia: d.get('inicio_vigencia') ?? null,
    fim_vigencia: d.get('fim_vigencia') ?? null,
  }));
  const registrados = new Map<string, AlertaRegistrado[]>();
  await Promise.all(
    snap.docs.map(async (d) => {
      const alertas = await d.ref.collection('alertas').get();
      registrados.set(
        d.id,
        alertas.docs.map((a) => ({
          fim_vigencia: a.get('fim_vigencia'),
          antecedencia_dias: a.get('antecedencia_dias'),
        })),
      );
    }),
  );
  return { convenios, registrados };
}

async function registrar(db: Firestore, alertas: Alerta[]): Promise<void> {
  for (let i = 0; i < alertas.length; i += OPERACOES_POR_LOTE) {
    const lote = db.batch();
    for (const a of alertas.slice(i, i + OPERACOES_POR_LOTE)) {
      lote.set(db.collection('convenios').doc(a.convenioId).collection('alertas').doc(idAlerta(a)), {
        fim_vigencia: a.fimVigencia,
        antecedencia_dias: a.antecedencia,
        enviado_em: FieldValue.serverTimestamp(),
      });
    }
    await lote.commit();
  }
}

export type Enviador = (email: Email) => Promise<void>;

/** Envio por SMTP. `smtpUrl` no formato do nodemailer (ex.: smtps://usuario:senha@host:465). */
export function enviadorSmtp(smtpUrl: string, remetente: string): Enviador {
  const transporte = createTransport(smtpUrl);
  return async (email) => {
    await transporte.sendMail({
      from: remetente,
      to: email.para,
      subject: email.assunto,
      text: email.texto,
    });
  };
}

export function dependenciasFirestore(db: Firestore, enviar: Enviador): DependenciasAlertas {
  return {
    carregar: (de, ate) => carregar(db, de, ate),
    enviar,
    registrar: (alertas) => registrar(db, alertas),
  };
}
