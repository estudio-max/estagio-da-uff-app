import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saudacao } from './saudacao.js';

test('saúda pelo nome', () => assert.equal(saudacao(' Ana '), 'Olá, Ana!'));
test('sem nome', () => assert.equal(saudacao(), 'Olá!'));
