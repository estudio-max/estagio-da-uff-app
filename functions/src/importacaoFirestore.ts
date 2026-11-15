/** RF07: leitura do estado e gravação do plano de importação no Firestore (Admin SDK). */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  type Estado,
  type Plano,
  lerXml,
  planejarImportacao,
  relatorioCsv,
} from './importacao.js';

/** Limite do Firestore é 500 operações por lote; sobra folga. */
const OPERACOES_POR_LOTE = 450;

export async function carregarEstado(db: Firestore): Promise<Estado> {
  const [concedentes, convenios] = await Promise.all([
    db.collection('concedentes').get(),
    db.collection('convenios').get(),
  ]);
  return {
    concedentes: new Map(concedentes.docs.map((d) => [d.id, d.data()])),
    convenios: new Map(convenios.docs.map((d) => [d.id, d.data()])),
  };
}

export interface Autor {
  uid: string;
  email: string | null;
}

/**
 * Grava em lotes. As escritas de um registro vão sempre no mesmo lote: um registro entra
 * inteiro ou não entra. Se um lote falhar no meio, rodar de novo completa (idempotente).
 */
export async function gravarPlano(db: Firestore, plano: Plano, autor: Autor): Promise<void> {
  let lote = db.batch();
  let operacoes = 0;
  for (const grupo of plano.grupos) {
    const custo = grupo.reduce((n, e) => n + (e.historico ? 2 : 1), 0);
    if (operacoes + custo > OPERACOES_POR_LOTE) {
      await lote.commit();
      lote = db.batch();
      operacoes = 0;
    }
    for (const e of grupo) {
      const ref = db.collection(e.colecao).doc(e.id);
      lote.set(ref, e.dados, { merge: true });
      if (e.historico) {
        lote.set(ref.collection('historico').doc(), {
          por: autor.uid,
          por_nome: autor.email,
          em: FieldValue.serverTimestamp(),
          acao: e.historico.acao,
          campos: e.historico.campos,
        });
      }
    }
    operacoes += custo;
  }
  if (operacoes) await lote.commit();
}

export interface ResultadoImportacao {
  lidos: number;
  criados: number;
  atualizados: number;
  rejeitados: number;
  avisos: number;
  simulado: boolean;
  csv: string;
}

/** Lê o XML, planeja e (se não for simulação) grava. */
export async function importarXml(
  db: Firestore,
  xml: string,
  autor: Autor,
  simular: boolean,
): Promise<ResultadoImportacao> {
  const registros = lerXml(xml);
  const estado = await carregarEstado(db);
  const plano = planejarImportacao(registros, estado, () => db.collection('concedentes').doc().id);
  if (!simular) await gravarPlano(db, plano, autor);
  const { relatorio } = plano;
  return {
    lidos: relatorio.lidos,
    criados: relatorio.criados,
    atualizados: relatorio.atualizados,
    rejeitados: relatorio.rejeitados.length,
    avisos: relatorio.avisos.length,
    simulado: simular,
    csv: relatorioCsv(relatorio),
  };
}
