/**
 * RF05: alertas de vencimento de convênio para a Divisão de Estágio. Porta de
 * `convenios/alertas.py` (versão Django), sem Firestore nem SMTP: quem lê, envia e grava
 * entra por `DependenciasAlertas` (ver `alertasFirestore.ts`).
 *
 * Roda uma vez por dia. Cada convênio recebe no máximo um aviso por faixa de antecedência;
 * se o job ficar dias sem rodar, só sai o aviso mais urgente. Renovar o convênio (mudar o
 * fim da vigência) reinicia os avisos. Datas em texto ISO (`aaaa-mm-dd`), como no app.
 */

/** Premissa da D3 (06/10/2026), a confirmar com a PROGRAD. */
export const ANTECEDENCIAS_PADRAO = '365,180,90,30';

/** Lê `ALERTA_ANTECEDENCIAS_DIAS` (ex.: "365,180,90,30"). Recusa valor que não seja dia. */
export function lerAntecedencias(texto: string): number[] {
  const partes = texto.split(',').map((p) => p.trim()).filter(Boolean);
  const dias = partes.map(Number);
  if (!dias.length || dias.some((d) => !Number.isInteger(d) || d <= 0)) {
    throw new Error(`ALERTA_ANTECEDENCIAS_DIAS inválido: "${texto}"`);
  }
  return [...new Set(dias)];
}

/** Menor antecedência que já foi alcançada; null se ainda está longe do vencimento. */
export function faixaDeAlerta(diasRestantes: number, antecedencias: number[]): number | null {
  const alcancadas = antecedencias.filter((a) => diasRestantes <= a);
  return alcancadas.length ? Math.min(...alcancadas) : null;
}

const DIA_MS = 86_400_000;
const emMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

export const diasEntre = (de: string, ate: string): number =>
  Math.round((emMs(ate) - emMs(de)) / DIA_MS);

export const somarDias = (iso: string, dias: number): string =>
  new Date(emMs(iso) + dias * DIA_MS).toISOString().slice(0, 10);

/**
 * Data de hoje no fuso de Brasília, em ISO. Monta a data pelas partes: o formato de um
 * idioma (como o `en-CA`) muda conforme o ICU do Node, e o Node do Firebase CLI avulso
 * devolvia `mm/dd/aaaa`, o que fazia convênio vigente parecer "a iniciar".
 */
export function hojeEmBrasilia(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const parte = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

const dataBr = (iso: string): string => iso.split('-').reverse().join('/');

/** Campos do convênio que os alertas usam (como estão no Firestore). */
export interface ConvenioAlvo {
  id: string;
  numero: string;
  concedente_nome: string;
  situacao: string;
  inicio_vigencia: string | null;
  fim_vigencia: string | null;
}

/** Aviso já registrado em `convenios/{id}/alertas`. */
export interface AlertaRegistrado {
  fim_vigencia: string;
  antecedencia_dias: number;
}

export interface Alerta {
  convenioId: string;
  numero: string;
  concedente: string;
  fimVigencia: string;
  antecedencia: number;
  diasRestantes: number;
}

/** RN02: vigente = finalizado, já começou e ainda não acabou. */
export const vigente = (c: ConvenioAlvo, hoje: string): boolean =>
  c.situacao === 'finalizado' &&
  c.inicio_vigencia !== null &&
  c.fim_vigencia !== null &&
  c.inicio_vigencia <= hoje &&
  c.fim_vigencia >= hoje;

/** Id do registro: garante um aviso por (convênio, fim da vigência, antecedência). */
export const idAlerta = (a: Pick<Alerta, 'antecedencia' | 'fimVigencia'>): string =>
  `${a.antecedencia}_${a.fimVigencia}`;

export function alertasPendentes(
  hoje: string,
  antecedencias: number[],
  convenios: ConvenioAlvo[],
  registrados: Map<string, AlertaRegistrado[]>,
): Alerta[] {
  const pendentes: Alerta[] = [];
  const ordenados = convenios
    .filter((c) => vigente(c, hoje))
    .sort((a, b) => a.fim_vigencia!.localeCompare(b.fim_vigencia!) || a.id.localeCompare(b.id));
  for (const c of ordenados) {
    const fim = c.fim_vigencia!;
    const dias = diasEntre(hoje, fim);
    const faixa = faixaDeAlerta(dias, antecedencias);
    if (faixa === null) continue;
    // Aviso mais urgente (ou igual) já enviado para este fim cobre as faixas maiores.
    const jaEnviado = (registrados.get(c.id) ?? []).some(
      (r) => r.fim_vigencia === fim && r.antecedencia_dias <= faixa,
    );
    if (!jaEnviado) {
      pendentes.push({
        convenioId: c.id,
        numero: c.numero,
        concedente: c.concedente_nome,
        fimVigencia: fim,
        antecedencia: faixa,
        diasRestantes: dias,
      });
    }
  }
  return pendentes;
}

export interface Email {
  para: string;
  assunto: string;
  texto: string;
}

/**
 * Um e-mail com todos os alertas. O app não tem endereço por convênio (lá o Django ligava
 * ao admin), então vai um link para o app e o número, que a busca da lista encontra.
 */
export function montarEmail(alertas: Alerta[], para: string, appUrl: string): Email {
  const linhas = ['Convênios de estágio que entraram em período de aviso de vencimento:', ''];
  for (const a of alertas) {
    linhas.push(
      `- ${a.numero} — ${a.concedente}`,
      `  Vence em ${dataBr(a.fimVigencia)} (faltam ${a.diasRestantes} dias)`,
    );
  }
  linhas.push('');
  if (appUrl) linhas.push(`Abra o Sistema de Estágios UFF para ver os detalhes: ${appUrl}`, '');
  linhas.push('Mensagem automática do Sistema de Estágios UFF.');
  return {
    para,
    assunto: `[Estágios UFF] ${alertas.length} convênio(s) perto do vencimento`,
    texto: linhas.join('\n'),
  };
}

export interface ConfiguracaoAlertas {
  divisaoEmail: string;
  antecedencias: number[];
  appUrl: string;
}

export interface DependenciasAlertas {
  /** Convênios com fim de vigência entre `de` e `ate` (inclusive) e os avisos de cada um. */
  carregar(
    de: string,
    ate: string,
  ): Promise<{ convenios: ConvenioAlvo[]; registrados: Map<string, AlertaRegistrado[]> }>;
  enviar(email: Email): Promise<void>;
  registrar(alertas: Alerta[]): Promise<void>;
}

/**
 * Envia um único e-mail com todos os alertas novos e os registra. Retorna quantos foram.
 * Registra só depois de enviar: se o e-mail falhar, nada é marcado e o próximo dia tenta
 * de novo (no Django, a transação desfazia o registro). Se o registro falhar depois do
 * envio, o aviso se repete no dia seguinte: melhor repetido que perdido.
 */
export async function enviarAlertas(
  hoje: string,
  config: ConfiguracaoAlertas,
  deps: DependenciasAlertas,
): Promise<number> {
  if (!config.divisaoEmail.trim()) {
    throw new Error('Defina DIVISAO_EMAIL para enviar os alertas.');
  }
  const limite = somarDias(hoje, Math.max(...config.antecedencias));
  const { convenios, registrados } = await deps.carregar(hoje, limite);
  const alertas = alertasPendentes(hoje, config.antecedencias, convenios, registrados);
  if (!alertas.length) return 0;
  await deps.enviar(montarEmail(alertas, config.divisaoEmail.trim(), config.appUrl));
  await deps.registrar(alertas);
  return alertas.length;
}
