// Casos portados de tests/test_documentos.py (versão Django), os mesmos do teste em Dart.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentoValido, normalizar } from './documentos.js';

for (const valido of ['52998224725', '11222333000181', '12ABC34501DE35']) {
  test(`aceita documento válido ${valido}`, () => assert.equal(documentoValido(valido), true));
}

const invalidos: Record<string, string> = {
  '52998224724': 'CPF com DV errado',
  '11222333000180': 'CNPJ com DV errado',
  '12ABC34501DE36': 'CNPJ alfanumérico com DV errado',
  '11111111111': 'CPF com dígitos repetidos',
  '00000000000000': 'CNPJ com dígitos repetidos',
  '12ABC34501DEAB': 'DV do CNPJ alfanumérico tem de ser numérico',
  '5299822472': 'tamanho errado',
  '': 'vazio',
};
for (const [valor, motivo] of Object.entries(invalidos)) {
  test(`rejeita documento inválido: ${motivo}`, () => assert.equal(documentoValido(valor), false));
}

test('normaliza máscara, espaços e caixa', () => {
  assert.equal(normalizar('529.982.247-25'), '52998224725');
  assert.equal(normalizar('11.222.333/0001-81'), '11222333000181');
  assert.equal(normalizar(' 12.abc.345/01de-35 '), '12ABC34501DE35');
});
