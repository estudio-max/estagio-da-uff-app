// RF05: casos portados de tests/test_alertas.py (versão Django), com dados fictícios.
// Os casos "integration" de lá rodam aqui contra um armazenamento em memória; o caminho
// real (Firestore) está em alertasFirestore.emulador.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Alerta,
  type AlertaRegistrado,
  type ConvenioAlvo,
  type DependenciasAlertas,
  type Email,
  diasEntre,
  enviarAlertas,
  faixaDeAlerta,
  hojeEmBrasilia,
  idAlerta,
  lerAntecedencias,
  somarDias,
} from './alertas.js';

const HOJE = '2026-10-06';
const ANTECEDENCIAS = [365, 180, 90, 30];
const CONFIG = {
  divisaoEmail: 'divisao@exemplo.test',
  antecedencias: ANTECEDENCIAS,
  appUrl: 'https://estagios.exemplo.test',
};

test('faixa de alerta', () => {
  const casos: [number, number | null][] = [
    [400, null],
    [366, null],
    [365, 365],
    [200, 365],
    [180, 180],
    [91, 180],
    [90, 90],
    [31, 90],
    [30, 30],
    [0, 30],
  ];
  for (const [dias, esperado] of casos) {
    assert.equal(faixaDeAlerta(dias, ANTECEDENCIAS), esperado, `${dias} dias`);
  }
});

test('lê as antecedências da variável e recusa valor inválido', () => {
  assert.deepEqual(lerAntecedencias(' 365, 180,90 ,30 '), ANTECEDENCIAS);
  for (const ruim of ['', '30,x', '0', '-5', '1.5']) {
    assert.throws(() => lerAntecedencias(ruim), /ALERTA_ANTECEDENCIAS_DIAS/);
  }
});

test('datas: dias entre, soma e hoje no fuso de Brasília', () => {
  assert.equal(diasEntre('2026-10-06', '2027-10-06'), 365);
  assert.equal(diasEntre('2026-10-06', '2026-10-01'), -5);
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  // 01h UTC de 07/10 ainda é 06/10 em Brasília (UTC-3).
  assert.equal(hojeEmBrasilia(new Date('2026-10-07T01:00:00Z')), '2026-10-06');
});

/** Firestore e SMTP de mentira: guarda os convênios, os avisos e os e-mails. */
class Armazem implements DependenciasAlertas {
  convenios: ConvenioAlvo[] = [];
  registrados = new Map<string, AlertaRegistrado[]>();
  emails: Email[] = [];
  falharEnvio = false;

  convenio(numero: string, venceEmDias: number, campos: Partial<ConvenioAlvo> = {}): ConvenioAlvo {
    const fim = somarDias(HOJE, venceEmDias);
    const c: ConvenioAlvo = {
      id: `id-${numero}`,
      numero,
      concedente_nome: 'Empresa Fictícia',
      situacao: 'finalizado',
      inicio_vigencia: somarDias(fim, -1000),
      fim_vigencia: fim,
      ...campos,
    };
    this.convenios.push(c);
    return c;
  }

  async carregar(de: string, ate: string) {
    const convenios = this.convenios.filter(
      (c) => c.fim_vigencia !== null && c.fim_vigencia >= de && c.fim_vigencia <= ate,
    );
    return { convenios: structuredClone(convenios), registrados: structuredClone(this.registrados) };
  }

  async enviar(email: Email) {
    if (this.falharEnvio) throw new Error('servidor de email fora do ar');
    this.emails.push(email);
  }

  async registrar(alertas: Alerta[]) {
    for (const a of alertas) {
      const lista = this.registrados.get(a.convenioId) ?? [];
      // Mesmo id do documento no Firestore: gravar de novo não duplica.
      if (!lista.some((r) => idAlerta({ antecedencia: r.antecedencia_dias, fimVigencia: r.fim_vigencia }) === idAlerta(a))) {
        lista.push({ fim_vigencia: a.fimVigencia, antecedencia_dias: a.antecedencia });
      }
      this.registrados.set(a.convenioId, lista);
    }
  }

  get todos(): AlertaRegistrado[] {
    return [...this.registrados.values()].flat();
  }
}

test('envia um e-mail só com os convênios na faixa', async () => {
  const a = new Armazem();
  a.convenio('PR-LONGE/2026', 500);
  a.convenio('PR-90D/2026', 85);
  a.convenio('PR-30D/2026', 10);
  a.convenio('PR-TRAMITANDO/2026', 10, { situacao: 'em_tramitacao' });
  a.convenio('PR-VENCIDO/2026', -5);

  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 2);
  assert.equal(a.emails.length, 1);
  const [email] = a.emails;
  assert.equal(email.para, 'divisao@exemplo.test');
  assert.ok(email.assunto.includes('2 convênio(s)'));
  assert.ok(email.texto.includes('PR-90D/2026') && email.texto.includes('faltam 85 dias'));
  assert.ok(email.texto.includes('PR-30D/2026') && email.texto.includes('faltam 10 dias'));
  for (const fora of ['LONGE', 'TRAMITANDO', 'VENCIDO']) assert.ok(!email.texto.includes(fora));
  assert.ok(email.texto.includes('https://estagios.exemplo.test'));
  // O mais urgente vem primeiro, com a data no formato brasileiro.
  assert.ok(email.texto.indexOf('PR-30D') < email.texto.indexOf('PR-90D'));
  assert.ok(email.texto.includes('Vence em 16/10/2026'));
});

test('não repete aviso da mesma faixa', async () => {
  const a = new Armazem();
  a.convenio('PR-1/2026', 85);
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 1);
  assert.equal(await enviarAlertas(somarDias(HOJE, 1), CONFIG, a), 0);
  assert.equal(a.emails.length, 1);
});

test('avisa de novo ao entrar na próxima faixa', async () => {
  const a = new Armazem();
  a.convenio('PR-1/2026', 95);
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 1); // faixa de 180
  assert.equal(await enviarAlertas(somarDias(HOJE, 5), CONFIG, a), 1); // faixa de 90
  assert.deepEqual(a.todos.map((r) => r.antecedencia_dias).sort((x, y) => x - y), [90, 180]);
});

test('job parado vários dias manda só o aviso mais urgente', async () => {
  const a = new Armazem();
  a.convenio('PR-1/2026', 20); // já passou de 365, 180, 90 e 30
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 1);
  assert.deepEqual(a.todos.map((r) => r.antecedencia_dias), [30]);
  assert.equal(await enviarAlertas(somarDias(HOJE, 1), CONFIG, a), 0);
});

test('aviso mais urgente já enviado cobre faixas maiores', async () => {
  const a = new Armazem();
  const c = a.convenio('PR-1/2026', 20);
  a.registrados.set(c.id, [{ fim_vigencia: somarDias(HOJE, 20), antecedencia_dias: 30 }]);
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 0);
});

test('renovar o convênio reinicia os avisos', async () => {
  const a = new Armazem();
  const c = a.convenio('PR-1/2026', 20);
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 1);
  // Aditivo de prazo: novo fim daqui a 80 dias (dentro de 5 anos do início).
  c.fim_vigencia = somarDias(HOJE, 80);
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 1);
  assert.equal(a.todos.length, 2);
});

test('sem alertas não envia e-mail', async () => {
  const a = new Armazem();
  a.convenio('PR-1/2026', 500);
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 0);
  assert.deepEqual(a.emails, []);
});

test('falha no envio não marca alerta como enviado', async () => {
  const a = new Armazem();
  a.convenio('PR-1/2026', 10);
  a.falharEnvio = true;
  await assert.rejects(enviarAlertas(HOJE, CONFIG, a), /fora do ar/);
  assert.deepEqual(a.todos, []);
  // No dia seguinte, com o servidor de volta, o aviso sai.
  a.falharEnvio = false;
  assert.equal(await enviarAlertas(somarDias(HOJE, 1), CONFIG, a), 1);
});

test('exige o e-mail da Divisão', async () => {
  await assert.rejects(
    enviarAlertas(HOJE, { ...CONFIG, divisaoEmail: ' ' }, new Armazem()),
    /DIVISAO_EMAIL/,
  );
});

test('sem convênios, roda e não envia nada', async () => {
  assert.equal(await enviarAlertas(HOJE, CONFIG, new Armazem()), 0);
});

test('convênio a iniciar não recebe aviso', async () => {
  const a = new Armazem();
  a.convenio('PR-FUTURO/2026', 20, { inicio_vigencia: somarDias(HOJE, 1) });
  assert.equal(await enviarAlertas(HOJE, CONFIG, a), 0);
});
