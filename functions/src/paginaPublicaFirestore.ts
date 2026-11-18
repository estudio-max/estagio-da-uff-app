/** Página pública: leitura dos convênios publicáveis no Firestore (Admin SDK). */
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { ConvenioPublico } from './paginaPublica.js';

/** Limite de documentos por chamada do `getAll`, com folga. */
const POR_LEITURA = 300;

const textoOuVazio = (v: unknown): string => (typeof v === 'string' ? v : '');
const textoOuNulo = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Lê só os convênios finalizados que ainda não venceram (filtro de um campo: dispensa
 * índice composto) e as concedentes deles. Copia **só os campos públicos**: o que é
 * interno (observações, e-mail, Resolução CEP, etapas, histórico) não sai daqui.
 */
export async function carregarPublicos(db: Firestore, hoje: string): Promise<ConvenioPublico[]> {
  const snap = await db.collection('convenios').where('fim_vigencia', '>=', hoje).get();
  const docs = snap.docs.filter((d) => d.get('situacao') === 'finalizado');

  const ids = [...new Set(docs.map((d) => textoOuVazio(d.get('concedente_id'))).filter(Boolean))];
  const concedentes = new Map<string, DocumentSnapshot>();
  for (let i = 0; i < ids.length; i += POR_LEITURA) {
    const refs = ids.slice(i, i + POR_LEITURA).map((id) => db.collection('concedentes').doc(id));
    for (const s of await db.getAll(...refs)) if (s.exists) concedentes.set(s.id, s);
  }

  return docs.flatMap((d): ConvenioPublico[] => {
    const k = concedentes.get(textoOuVazio(d.get('concedente_id')));
    if (!k) return [];
    return [
      {
        id: d.id,
        numero: textoOuVazio(d.get('numero')),
        processo_sei: textoOuVazio(d.get('processo_sei')),
        objeto: textoOuVazio(d.get('objeto')),
        situacao: textoOuVazio(d.get('situacao')),
        inicio_vigencia: textoOuNulo(d.get('inicio_vigencia')),
        fim_vigencia: textoOuNulo(d.get('fim_vigencia')),
        concedente: {
          razao_social: textoOuVazio(k.get('razao_social')),
          nome_fantasia: textoOuVazio(k.get('nome_fantasia')),
          documento: textoOuNulo(k.get('documento')),
          tipo: textoOuVazio(k.get('tipo')),
          uf: textoOuVazio(k.get('uf')),
          cidade: textoOuVazio(k.get('cidade')),
          ramo_atividade: textoOuVazio(k.get('ramo_atividade')),
        },
      },
    ];
  });
}
