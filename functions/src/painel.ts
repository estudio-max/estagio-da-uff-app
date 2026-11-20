/**
 * RF06: indicadores estratégicos de convênios. MS05: tempo de tramitação medido.
 * Porta de `convenios/painel.py` (Django). Datas em ISO (`aaaa-mm-dd`), hoje em Brasília.
 */
import { diasEntre, somarDias } from './alertas.js';

export const JANELAS_VENCIMENTO = [30, 90, 180] as const;
export const PERIODO_TRAMITACAO_DIAS = 365;
export const QUANTOS_PARADOS = 10;

/** RN05: todos os tipos aparecem no painel, mesmo zerados, na ordem do formulário. */
export const TIPOS_CONCEDENTE = [
  'ensino_privada',
  'empresa_privada',
  'ong_oscip',
  'orgao_publico',
  'profissional_liberal',
  'agente_integracao',
  'ensino_publica',
  'microempresa',
  'outros',
] as const;

/** RN02, na ordem do Django. */
export const VIGENCIAS = ['em_tramitacao', 'cancelado', 'a_iniciar', 'vigente', 'vencido'] as const;
export type Vigencia = (typeof VIGENCIAS)[number];

/** O que o painel precisa de cada convênio. */
export interface ConvenioPainel {
  id: string;
  numero: string;
  concedente_nome: string;
  /** Tipo da concedente (RN05); vazio ou desconhecido conta como `outros`. */
  tipo: string;
  situacao: string;
  inicio_vigencia: string | null;
  fim_vigencia: string | null;
  finalizado_em: string | null;
  /** Data do cadastro (criação do documento), em Brasília. */
  criado_em: string;
  /** Data da primeira etapa registrada, se houver. */
  primeira_etapa: string | null;
}

export interface Parado {
  id: string;
  numero: string;
  concedente: string;
  dias: number;
}

export interface Indicadores {
  por_vigencia: Record<Vigencia, number>;
  /** Vigentes que vencem em até N dias, por janela. */
  vencendo: Record<string, number>;
  /** Vigentes por tipo de concedente, com todos os tipos. */
  por_tipo: Record<string, number>;
  tramitacao_media: number | null;
  tramitacao_mediana: number | null;
  tramitacao_amostra: number;
  parados: Parado[];
  periodo_tramitacao_dias: number;
}

/** RN02: derivada da situação e das datas, como `Convenio.vigencia` no app. */
export function vigencia(c: Pick<ConvenioPainel, 'situacao' | 'inicio_vigencia' | 'fim_vigencia'>, hoje: string): Vigencia {
  if (c.situacao === 'cancelado') return 'cancelado';
  if (c.situacao !== 'finalizado') return 'em_tramitacao';
  if (c.inicio_vigencia && hoje < c.inicio_vigencia) return 'a_iniciar';
  if (c.fim_vigencia && hoje > c.fim_vigencia) return 'vencido';
  return 'vigente';
}

/** Primeira etapa registrada; sem etapas, a data do cadastro. */
const inicioDaTramitacao = (c: ConvenioPainel): string => c.primeira_etapa ?? c.criado_em;

const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
}

export function calcularPainel(convenios: ConvenioPainel[], hoje: string): Indicadores {
  const por_vigencia = Object.fromEntries(VIGENCIAS.map((v) => [v, 0])) as Record<Vigencia, number>;
  const vencendo = Object.fromEntries(JANELAS_VENCIMENTO.map((d) => [String(d), 0]));
  const por_tipo: Record<string, number> = Object.fromEntries(TIPOS_CONCEDENTE.map((t) => [t, 0]));
  const duracoes: number[] = [];
  const parados: Parado[] = [];
  const desde = somarDias(hoje, -PERIODO_TRAMITACAO_DIAS);

  for (const c of convenios) {
    const v = vigencia(c, hoje);
    por_vigencia[v] += 1;
    if (v === 'vigente') {
      const tipo = c.tipo in por_tipo ? c.tipo : 'outros';
      por_tipo[tipo] += 1;
      for (const dias of JANELAS_VENCIMENTO) {
        if (c.fim_vigencia && c.fim_vigencia <= somarDias(hoje, dias)) vencendo[String(dias)] += 1;
      }
    }
    if (c.situacao === 'finalizado' && c.finalizado_em && c.finalizado_em >= desde) {
      duracoes.push(diasEntre(inicioDaTramitacao(c), c.finalizado_em));
    }
    if (c.situacao === 'em_tramitacao') {
      parados.push({
        id: c.id,
        numero: c.numero,
        concedente: c.concedente_nome,
        dias: diasEntre(inicioDaTramitacao(c), hoje),
      });
    }
  }

  parados.sort((a, b) => b.dias - a.dias);
  return {
    por_vigencia,
    vencendo,
    por_tipo,
    tramitacao_media: duracoes.length ? media(duracoes) : null,
    tramitacao_mediana: duracoes.length ? mediana(duracoes) : null,
    tramitacao_amostra: duracoes.length,
    parados: parados.slice(0, QUANTOS_PARADOS),
    periodo_tramitacao_dias: PERIODO_TRAMITACAO_DIAS,
  };
}
