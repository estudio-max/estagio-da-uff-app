/**
 * RF07 pela linha de comando, só contra o emulador (para testar com volume em desenvolvimento).
 * Na nuvem, a importação é feita pela Function `importarConveniosDrupal`, que exige o papel `divisao`.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/lib/importarCli.js conveniosestagio.xml \
 *     [--simular] [--relatorio reports/importacao.csv]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { importarXml } from './importacaoFirestore.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    simular: { type: 'boolean', default: false },
    relatorio: { type: 'string', default: 'reports/importacao.csv' },
    projeto: { type: 'string', default: 'demo-estagios-uff' },
  },
});

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Defina FIRESTORE_EMULATOR_HOST: este comando só grava no emulador.');
  process.exit(2);
}
const [arquivo] = positionals;
if (!arquivo) {
  console.error('Uso: node functions/lib/importarCli.js <arquivo.xml> [--simular] [--relatorio caminho.csv]');
  process.exit(2);
}

const db = getFirestore(initializeApp({ projectId: values.projeto }));
const r = await importarXml(db, readFileSync(arquivo, 'utf8'), { uid: 'importacao-cli', email: null }, values.simular);

mkdirSync(dirname(values.relatorio), { recursive: true });
writeFileSync(values.relatorio, r.csv, 'utf8');
if (r.simulado) console.log('Simulação: nada foi gravado.');
console.log(
  `${r.lidos} registros lidos: ${r.criados} criados, ${r.atualizados} atualizados, ` +
    `${r.rejeitados} rejeitados, ${r.avisos} avisos. Relatório: ${values.relatorio}`,
);
