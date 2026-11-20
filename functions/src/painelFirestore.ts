/** RF06: leitura do Firestore para o painel (Admin SDK). */
import type { Firestore } from 'firebase-admin/firestore';
import { hojeEmBrasilia } from './alertas.js';
import type { ConvenioPainel } from './painel.js';

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
const data = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Lê convênios, concedentes (só o tipo) e as datas das etapas. A data do cadastro é a
 * criação do documento (`createTime`), que só o Admin SDK enxerga; por isso o painel é
 * calculado aqui e não no app. Com milhares de convênios, são alguns milhares de leituras
 * por abertura do painel; se o uso crescer, guardar o resultado em `estatisticas/painel`.
 */
export async function carregarPainel(db: Firestore): Promise<ConvenioPainel[]> {
  const [convenios, concedentes, etapas] = await Promise.all([
    db.collection('convenios').get(),
    db.collection('concedentes').select('tipo').get(),
    db.collectionGroup('etapas').select('data').get(),
  ]);

  const tipos = new Map(concedentes.docs.map((d) => [d.id, texto(d.get('tipo'))]));
  const primeiraEtapa = new Map<string, string>();
  for (const e of etapas.docs) {
    const convenio = e.ref.parent.parent;
    const dia = data(e.get('data'));
    if (!convenio || convenio.parent.id !== 'convenios' || !dia) continue;
    const atual = primeiraEtapa.get(convenio.id);
    if (!atual || dia < atual) primeiraEtapa.set(convenio.id, dia);
  }

  return convenios.docs.map((d) => ({
    id: d.id,
    numero: texto(d.get('numero')),
    concedente_nome: texto(d.get('concedente_nome')),
    tipo: tipos.get(texto(d.get('concedente_id'))) ?? '',
    situacao: texto(d.get('situacao')),
    inicio_vigencia: data(d.get('inicio_vigencia')),
    fim_vigencia: data(d.get('fim_vigencia')),
    finalizado_em: data(d.get('finalizado_em')),
    criado_em: hojeEmBrasilia(d.createTime.toDate()),
    primeira_etapa: primeiraEtapa.get(d.id) ?? null,
  }));
}
