import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { saudacao } from './saudacao.js';

setGlobalOptions({ region: 'southamerica-east1' });

// Fase 0: só prova que o pipeline de Functions funciona de ponta a ponta.
export const ola = onRequest((req, res) => {
  res.send(saudacao(req.query.nome as string | undefined));
});
