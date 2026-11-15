import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDiretorioLista, lerLista } from './diretorioLista.js';

test('lê e-mails com e sem papel, ignorando espaços e itens vazios', () => {
  const m = lerLista(' ana@id.uff.br , bia@id.uff.br:manager,, cosme@id.uff.br:OWNER ,');
  assert.deepEqual([...m], [
    ['ana@id.uff.br', 'MEMBER'],
    ['bia@id.uff.br', 'MANAGER'],
    ['cosme@id.uff.br', 'OWNER'],
  ]);
});

test('lista vazia não autoriza ninguém', async () => {
  const d = criarDiretorioLista('');
  assert.equal(await d.papelNoGrupo('g', 'ana@id.uff.br'), null);
});

test('a consulta ignora a caixa do e-mail e devolve null para quem não está', async () => {
  const d = criarDiretorioLista('ana@id.uff.br:MANAGER');
  assert.equal(await d.papelNoGrupo('g', 'ANA@ID.UFF.BR'), 'MANAGER');
  assert.equal(await d.papelNoGrupo('g', 'zeca@id.uff.br'), null);
});

test('item malformado falha alto em vez de ser ignorado', () => {
  assert.throws(() => lerLista('sem-arroba'), /e-mail inválido/);
  assert.throws(() => lerLista('ana@id.uff.br:CHEFE'), /papel inválido/);
});
