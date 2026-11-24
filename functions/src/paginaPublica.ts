/**
 * Página pública de convênios (RF03, RF04, RN01, RN08, MS06, MS07). Porta de
 * `convenios/views.py` e dos templates `convenios/*.html` da versão Django.
 *
 * Só regras e HTML, sem Firestore (a leitura está em paginaPublicaFirestore.ts).
 * Convênios finalizados vigentes ou a iniciar (estes com selo "A partir de", D18).
 * Campos públicos: os da página atual do site (premissa da D2). Observações internas,
 * e-mail, etapas, histórico, minuta, origem e Resolução CEP nunca entram no modelo.
 */
import { diasEntre } from './alertas.js';
import { normalizar } from './documentos.js';

export const POR_PAGINA = 50;
export const CAMINHO_LISTA = '/convenios';

/** RN05: lista oficial do formulário da PROGRAD (mesma ordem e rótulos do app). */
export const TIPOS: [string, string][] = [
  ['ensino_privada', 'Instituição de Ensino Privada'],
  ['empresa_privada', 'Empresa Privada'],
  ['ong_oscip', 'ONGs e OSCIPs'],
  ['orgao_publico', 'Órgãos dos Governos Federal, Estadual e Municipal'],
  ['profissional_liberal', 'Profissional Liberal'],
  ['agente_integracao', 'Agente de Integração'],
  ['ensino_publica', 'Instituições de Ensino Públicas'],
  ['microempresa', 'Microempresas'],
  ['outros', 'Outros'],
];
const ROTULO_TIPO = new Map(TIPOS);

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

/** Só os campos que podem aparecer na página. */
export interface ConcedentePublica {
  razao_social: string;
  nome_fantasia: string;
  /** Normalizado. CPF (11 caracteres) nunca é exibido nem buscável (RN08). */
  documento: string | null;
  tipo: string;
  uf: string;
  cidade: string;
  ramo_atividade: string;
}

export interface ConvenioPublico {
  id: string;
  numero: string;
  processo_sei: string;
  objeto: string;
  situacao: string;
  inicio_vigencia: string | null;
  fim_vigencia: string | null;
  concedente: ConcedentePublica;
}

export type VigenciaPublica = 'vigente' | 'a_iniciar';

/** RN01/RN02: público = finalizado, com datas, e ainda não vencido. */
export function vigenciaPublica(c: ConvenioPublico, hoje: string): VigenciaPublica | null {
  if (c.situacao !== 'finalizado' || !c.inicio_vigencia || !c.fim_vigencia) return null;
  if (c.fim_vigencia < hoje) return null;
  return c.inicio_vigencia > hoje ? 'a_iniciar' : 'vigente';
}

const ehCpf = (documento: string | null): boolean => documento?.length === 11;

/** CNPJ formatado para a página; CPF não é exibido, nem cifrado (RN08, LGPD). */
export function documentoPublico(documento: string | null): string {
  if (!documento || ehCpf(documento) || documento.length !== 14) return '';
  const d = documento;
  return `CNPJ ${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Escapa o texto cadastrado antes de ir para o HTML. */
export const esc = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const minusculo = (s: string): string => s.toLocaleLowerCase('pt-BR');
const contem = (campo: string, busca: string): boolean => minusculo(campo).includes(busca);

export interface Filtros {
  q: string;
  tipo: string;
  uf: string;
}

/** RF04: busca por nome, nome fantasia, número, processo e CNPJ; filtros por tipo e UF. */
export function filtrar(convenios: ConvenioPublico[], f: Filtros): ConvenioPublico[] {
  let lista = convenios;
  const busca = f.q.trim();
  if (busca) {
    const termo = minusculo(busca);
    const documento = normalizar(busca);
    lista = lista.filter(
      (c) =>
        contem(c.concedente.razao_social, termo) ||
        contem(c.concedente.nome_fantasia, termo) ||
        contem(c.numero, termo) ||
        contem(c.processo_sei, termo) ||
        // Busca por documento só em CNPJ: CPF de pessoa física não é público.
        (documento.length >= 8 &&
          !!c.concedente.documento &&
          !ehCpf(c.concedente.documento) &&
          c.concedente.documento.includes(documento)),
    );
  }
  if (f.tipo) lista = lista.filter((c) => c.concedente.tipo === f.tipo);
  if (f.uf) lista = lista.filter((c) => c.concedente.uf === f.uf);
  return lista;
}

const ordenar = (lista: ConvenioPublico[]): ConvenioPublico[] =>
  [...lista].sort(
    (a, b) =>
      a.concedente.razao_social.localeCompare(b.concedente.razao_social, 'pt-BR') ||
      a.numero.localeCompare(b.numero, 'pt-BR'),
  );

const plural = (n: number): string => (n === 1 ? '' : 's');
const dataBr = (iso: string): string => iso.split('-').reverse().join('/');
const emDias = (n: number): string => (n === 1 ? '1 dia' : `${n} dias`);
// Nomes fixos: o Node do Firebase CLI avulso não traz o português no ICU e cairia no inglês.
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
/** Como o `date:"l, d \d\e F \d\e Y"` do Django: "terça-feira, 21 de julho de 2026". */
export function dataLonga(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  const semana = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return `${DIAS[semana]}, ${dia} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

/** Tempo até `fim`, em anos e meses de calendário (ou dias, abaixo de um mês). Como no app. */
export function tempoRestante(hoje: string, fim: string): string {
  const [ha, hm, hd] = hoje.split('-').map(Number);
  const [fa, fm, fd] = fim.split('-').map(Number);
  let meses = (fa - ha) * 12 + fm - hm;
  if (fd < hd) meses--;
  if (meses < 1) return emDias(diasEntre(hoje, fim));
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return [
    anos ? `${anos} ano${plural(anos)}` : '',
    resto ? `${resto} ${resto === 1 ? 'mês' : 'meses'}` : '',
  ]
    .filter(Boolean)
    .join(' e ');
}

/** Faixa do aviso de vencimento próximo (a primeira faixa dos alertas, como no app). */
const DIAS_URGENTE = 30;
/** Abaixo disto a lista diz quantos dias faltam; acima, só a barra (como no app). */
const DIAS_AVISO = 90;

export interface Andamento {
  /** Fração da vigência já decorrida, de 0 a 1. */
  fracao: number;
  /** "Vence em 12 dias", "Começa em 3 dias"; nulo se o fim está longe. */
  prazo: string | null;
  urgente: boolean;
}

/** Barra e frase de prazo de um convênio público (só vigente ou a iniciar). */
export function andamento(c: ConvenioPublico, hoje: string): Andamento {
  const ini = c.inicio_vigencia!;
  const fim = c.fim_vigencia!;
  const total = diasEntre(ini, fim);
  const fracao = total > 0 ? Math.min(1, Math.max(0, diasEntre(ini, hoje) / total)) : 0;
  if (ini > hoje) return { fracao: 0, prazo: `Começa em ${emDias(diasEntre(hoje, ini))}`, urgente: false };
  const faltam = diasEntre(hoje, fim);
  if (faltam > DIAS_AVISO) return { fracao, prazo: null, urgente: false };
  return { fracao, prazo: faltam === 0 ? 'Vence hoje' : `Vence em ${emDias(faltam)}`, urgente: faltam <= DIAS_URGENTE };
}

const linkDetalhe = (c: ConvenioPublico): string => `${CAMINHO_LISTA}/${encodeURIComponent(c.id)}`;
const rotuloTipo = (tipo: string): string => ROTULO_TIPO.get(tipo) ?? 'Outros';
const porcento = (fracao: number): string => `${Math.round(fracao * 1000) / 10}%`;

/** Ícones de traço (24×24), decorativos. */
const ICONES = {
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  local: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  predio: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4"/>',
  vazio: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5"/>',
  voltar: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
};
const icone = (nome: keyof typeof ICONES): string =>
  `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONES[nome]}</svg>`;

/**
 * Identidade visual da Divisão de Estágio, a mesma do app (`lib/telas/tema.dart` e
 * `lib/telas/comum.dart`): azul do logo nas ações, marinho no topo e nos títulos,
 * fundo claro, cartões brancos com borda; Inter no texto e Exo 2 nos títulos.
 */
const ESTILO_BASE = `
  :root {
    --azul: #2056ae; --azul-escuro: #163f82; --marinho: #12294f; --marinho-claro: #2a4470;
    --menu-texto: #d5deec; --menu-fraco: #b9c7de; --ceu: #e6f0fa; --fundo: #f5f8fc;
    --texto: #1b2433; --fraco: #5b6474; --borda: #dce3ee; --borda-campo: #c3cede; --trilho: #e6ebf2;
    --alerta: #c2410c; --alerta-texto: #8a2e08; --alerta-fundo: #fff4ec;
    --vigente: #18693f; --vigente-fundo: #e3f4ea; --vigente-tom: #2e9a5e;
    --iniciar: #1d4f9f; --iniciar-fundo: #e5eefb;
    --foco: #f0a500; --raio: 16px; --raio-campo: 10px;
    --texto-fonte: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --titulo-fonte: "Exo 2", var(--texto-fonte);
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    background: var(--fundo); color: var(--texto); font: 16px/1.5 var(--texto-fonte); }
  a { color: var(--azul); }
  a:hover { color: var(--azul-escuro); }
  :focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }
  .icone { width: 1.15em; height: 1.15em; flex: none; fill: none; stroke: currentColor; stroke-width: 2;
    stroke-linecap: round; stroke-linejoin: round; vertical-align: -.2em; }
  .pular { position: absolute; left: -999px; z-index: 2; }
  .pular:focus { left: 16px; top: 8px; background: #fff; padding: 8px 12px; border-radius: var(--raio-campo); }
  .conteudo { width: 100%; max-width: 1200px; margin: 0 auto; padding-inline: 32px; }
  .topo { background: var(--marinho); color: #fff; }
  .topo .conteudo { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; }
  .marca { display: flex; align-items: center; gap: 12px; color: #fff; text-decoration: none; }
  .marca:hover { color: #fff; }
  .marca img { width: 44px; height: 44px; padding: 3px; background: #fff; border-radius: 10px; }
  .marca strong { display: block; font: 700 19px/1.2 var(--titulo-fonte); }
  .marca small { display: block; font-size: 12px; color: var(--menu-fraco); }
  .topo-nota { margin: 0; font-size: 14px; color: var(--menu-texto); }
  main { flex: 1; padding-block: 28px 64px; }
  h1, h2 { font-family: var(--titulo-fonte); color: var(--marinho); }
  .cabecalho h1 { margin: 0; font-size: 2rem; font-weight: 700; line-height: 1.2; }
  .cabecalho > p { margin: 4px 0 0; font-size: 1.05rem; color: var(--fraco); }
  .cartao { background: #fff; border: 1px solid var(--borda); border-radius: var(--raio); padding: 18px 20px 20px; }
  .cartao h2 { margin: 0 0 12px; font: 600 1rem/1.4 var(--texto-fonte); color: var(--marinho); }
  .selo { display: inline-block; padding: 4px 10px; border-radius: 13px; font-size: 13px; font-weight: 600;
    line-height: 1.3; white-space: nowrap; background: var(--vigente-fundo); color: var(--vigente); }
  .selo-futuro { background: var(--iniciar-fundo); color: var(--iniciar); }
  .barra { position: relative; height: 6px; border-radius: 3px; background: var(--trilho); overflow: hidden; }
  .barra > span { position: absolute; inset: 0 auto 0 0; background: var(--vigente-tom); border-radius: 3px; }
  .barra.urgente > span { background: var(--alerta); }
  .prazo { font-size: 13px; color: var(--fraco); }
  .prazo.urgente { color: var(--alerta-texto); font-weight: 600; }
  .voltar { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; text-decoration: none; }
  .voltar:hover { text-decoration: underline; }
  .aviso { text-align: center; padding: 40px 24px; }
  .aviso .icone { width: 40px; height: 40px; color: var(--azul); background: var(--ceu); border-radius: 50%;
    padding: 9px; box-sizing: content-box; }
  .aviso p { margin: 8px auto 0; max-width: 520px; color: var(--fraco); }
  .aviso p strong { display: block; margin-top: 12px; font: 600 1.15rem/1.4 var(--titulo-fonte); color: var(--marinho); }
  .rodape { background: #fff; border-top: 1px solid var(--borda); color: var(--fraco); font-size: 14px; }
  .rodape .conteudo { display: flex; align-items: center; gap: 24px; padding-block: 24px; }
  .rodape img { width: 150px; height: auto; flex: none; }
  .rodape p { margin: 0; }
  @media (max-width: 760px) {
    .conteudo { padding-inline: 16px; }
    .topo-nota { display: none; }
    main { padding-block: 20px 48px; }
    .cabecalho h1 { font-size: 1.6rem; }
    .rodape .conteudo { flex-direction: column; align-items: flex-start; gap: 12px; }
  }`;

const ESTILO_LISTA = `
  .resumos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 24px 0; }
  .resumos div { background: #fff; border: 1px solid var(--borda); border-radius: 14px; padding: 14px 20px; }
  .resumos dt { font-size: 14px; font-weight: 500; color: var(--fraco); }
  .resumos dd { margin: 4px 0 0; font: 700 34px/1.1 var(--titulo-fonte); color: var(--marinho); }
  .resumos .vigentes dd { color: var(--vigente); }
  .resumos .iniciar dd { color: var(--iniciar); }
  .quadro { background: #fff; border: 1px solid var(--borda); border-radius: var(--raio); overflow: hidden; }
  .busca { display: grid; grid-template-columns: minmax(0, 1fr) 260px 110px auto; gap: 12px; align-items: end;
    padding: 16px; border-bottom: 1px solid var(--borda); }
  .busca label { display: block; font-size: 14px; font-weight: 500; color: var(--fraco); margin-bottom: 4px; }
  .busca input, .busca select { width: 100%; height: 48px; font: inherit; color: var(--texto); background: #fff;
    border: 1px solid var(--borda-campo); border-radius: var(--raio-campo); padding: 0 12px; }
  .busca input:focus, .busca select:focus { outline: none; border-color: var(--azul); box-shadow: inset 0 0 0 1px var(--azul); }
  .busca .campo-busca { position: relative; }
  .busca .campo-busca .icone { position: absolute; left: 14px; bottom: 14px; color: var(--fraco); }
  .busca .campo-busca input { padding-left: 42px; }
  .busca button { height: 48px; padding: 0 22px; font: 600 15px var(--texto-fonte); color: #fff; background: var(--azul);
    border: 0; border-radius: var(--raio-campo); cursor: pointer; }
  .busca button:hover { background: var(--azul-escuro); }
  .resumo { margin: 0; padding: 10px 20px; font-size: 14px; color: var(--fraco); background: var(--fundo);
    border-bottom: 1px solid var(--borda); }
  .lista { list-style: none; margin: 0; padding: 0; }
  .item { position: relative; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 3fr) 160px;
    gap: 24px; align-items: center; padding: 16px 20px; border-top: 1px solid var(--trilho); }
  .item:first-child { border-top: 0; }
  .item:hover { background: #f8fafd; }
  .item .nome { font-weight: 600; color: var(--marinho); text-decoration: none; }
  .item .nome::after { content: ""; position: absolute; inset: 0; }
  .item:hover .nome { text-decoration: underline; }
  .item .fantasia, .item .linha { display: block; }
  .item .fantasia { font-size: 14px; color: var(--texto); }
  .item .linha { margin-top: 2px; font-size: 13px; color: var(--fraco); font-variant-numeric: tabular-nums; }
  .item .linha .icone { margin-right: 2px; }
  .item .doc { white-space: nowrap; }
  .item .datas { display: block; margin-bottom: 6px; font-size: 13px; color: var(--texto); font-variant-numeric: tabular-nums; }
  .item .prazo { display: block; margin-top: 6px; }
  .item .item-selo { text-align: right; }
  .paginas { display: flex; gap: 12px; justify-content: center; align-items: center; margin-top: 20px; color: var(--fraco); }
  .paginas a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; font-weight: 500;
    text-decoration: none; color: var(--texto); background: #fff; border: 1px solid var(--borda-campo); border-radius: var(--raio-campo); }
  .paginas a:hover { border-color: var(--azul); color: var(--azul); }
  @media (max-width: 900px) {
    .busca { grid-template-columns: 1fr 110px; }
    .busca .campo-busca, .busca button { grid-column: 1 / -1; }
    .item { grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .item .item-selo { grid-row: 2; text-align: left; }
  }
  @media (max-width: 600px) {
    .resumos { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 20px 0; }
    .resumos div { padding: 10px 12px; border-radius: 12px; }
    .resumos dt { font-size: 13px; }
    .resumos dd { font-size: 26px; }
  }`;

const ESTILO_DETALHE = `
  .cabecalho { margin-top: 16px; }
  .cabecalho .fantasia { margin: 2px 0 0; font-size: 1.1rem; color: var(--texto); }
  .identificacao { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 12px;
    color: var(--fraco); font-variant-numeric: tabular-nums; }
  .grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
  .vigencia { grid-column: 1 / -1; }
  .vigencia .titulo { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; align-items: baseline; }
  .vigencia .titulo h2 { margin-bottom: 12px; }
  .vigencia .destaque { font-weight: 600; color: var(--vigente); }
  .vigencia .destaque.futuro { color: var(--iniciar); }
  .vigencia .destaque.urgente { color: var(--alerta-texto); }
  .vigencia .barra { height: 10px; border-radius: 5px; overflow: visible; }
  .vigencia .barra > span { border-radius: 5px; }
  .vigencia .barra .hoje { position: absolute; top: -6px; bottom: -6px; width: 2px; margin-left: -1px;
    background: var(--marinho); border-radius: 1px; }
  .marcos { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; }
  .marcos > div { flex: 1; }
  .marcos .meio { text-align: center; }
  .marcos div:last-child { text-align: right; }
  .marcos span { display: block; font-size: 13px; color: var(--fraco); }
  .marcos strong { display: block; font-variant-numeric: tabular-nums; }
  .marcos small { display: block; font-size: 13px; color: var(--fraco); }
  dl { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 0 16px; margin: 0; }
  dt { padding: 6px 0; font-size: 14px; color: var(--fraco); }
  dd { margin: 0; padding: 6px 0; overflow-wrap: anywhere; }
  .objeto { grid-column: 1 / -1; }
  .objeto p { margin: 0; white-space: normal; }
  @media (max-width: 760px) {
    .grade { grid-template-columns: 1fr; }
    dl { grid-template-columns: 1fr; }
    dt { padding-bottom: 0; }
    dd { padding-top: 0; margin-bottom: 6px; }
  }`;

function documentoHtml(titulo: string, estilo: string, conteudo: string): string {
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)} · Estágios UFF</title>
  <meta name="theme-color" content="#12294f">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700&family=Inter:wght@400;500;600&display=swap">
  <style>${ESTILO_BASE}${estilo}
  </style>
</head>
<body>
  <a class="pular" href="#principal">Pular para o conteúdo</a>
  <header class="topo">
    <div class="conteudo">
      <a class="marca" href="${CAMINHO_LISTA}">
        <img src="/icons/Icon-192.png" alt="" width="44" height="44">
        <span><strong>Estágios UFF</strong><small>Divisão de Estágio · PROGRAD</small></span>
      </a>
      <p class="topo-nota">Consulta pública de convênios</p>
    </div>
  </header>
  <main id="principal" class="conteudo">
${conteudo}
  </main>
  <footer class="rodape">
    <div class="conteudo">
      <img src="/assets/assets/identidade/prograd.png" alt="PROGRAD, Divisão de Estágio" width="150" height="40">
      <p>Lista atualizada automaticamente a partir do cadastro da Divisão de Estágio.
      Dúvidas sobre convênios: Divisão de Estágio da PROGRAD.</p>
    </div>
  </footer>
</body>
</html>
`;
}

function opcoes(valores: [string, string][], atual: string, rotuloTodos: string): string {
  const itens = valores.map(
    ([valor, rotulo]) =>
      `<option value="${esc(valor)}"${valor === atual ? ' selected' : ''}>${esc(rotulo)}</option>`,
  );
  return [`<option value="">${rotuloTodos}</option>`, ...itens].join('\n      ');
}

function seloVigencia(c: ConvenioPublico, vigencia: VigenciaPublica): string {
  return vigencia === 'a_iniciar'
    ? `<span class="selo selo-futuro">A partir de ${dataBr(c.inicio_vigencia!)}</span>`
    : '<span class="selo">Vigente</span>';
}

function barra(a: Andamento, comHoje = false): string {
  const hoje = comHoje && a.fracao > 0 && a.fracao < 1 ? `<i class="hoje" style="left:${porcento(a.fracao)}"></i>` : '';
  return `<div class="barra${a.urgente ? ' urgente' : ''}" aria-hidden="true"><span style="width:${porcento(a.fracao)}"></span>${hoje}</div>`;
}

/** Uma linha da lista, no desenho da lista de convênios do app: quem, prazo e selo. */
function linha(c: ConvenioPublico, hoje: string): string {
  const k = c.concedente;
  const doc = documentoPublico(k.documento);
  const a = andamento(c, hoje);
  // Razão social sempre, com o nome fantasia logo abaixo quando houver.
  const fantasia = k.nome_fantasia ? `\n        <span class="fantasia">${esc(k.nome_fantasia)}</span>` : '';
  const prazo = a.prazo ? `\n        <span class="prazo${a.urgente ? ' urgente' : ''}">${a.prazo}</span>` : '';
  return `    <li class="item">
      <div class="item-id">
        <a class="nome" href="${linkDetalhe(c)}">${esc(k.razao_social)}</a>${fantasia}
        <span class="linha">Nº ${esc(c.numero)}${doc ? ` · <span class="doc">${doc}</span>` : ''}</span>
        <span class="linha">${icone('local')} ${esc(k.cidade)}/${esc(k.uf)} · ${esc(rotuloTipo(k.tipo))}</span>
      </div>
      <div class="item-prazo">
        <span class="datas"><span class="sr">Vigência: </span>${dataBr(c.inicio_vigencia!)} a ${dataBr(c.fim_vigencia!)}</span>
        ${barra(a)}${prazo}
      </div>
      <div class="item-selo">${seloVigencia(c, vigenciaPublica(c, hoje)!)}</div>
    </li>`;
}

export interface Resposta {
  status: number;
  html: string;
}

const naoEncontrado = (): Resposta => ({
  status: 404,
  html: documentoHtml(
    'Convênio não encontrado',
    '',
    `<div class="cartao aviso">
  ${icone('vazio')}
  <p><strong>Convênio não encontrado.</strong></p>
  <p>O endereço pode estar errado, ou o convênio não está mais vigente.</p>
  <p><a class="voltar" href="${CAMINHO_LISTA}">${icone('voltar')} Todos os convênios</a></p>
</div>`,
  ),
});

const chaveConcedente = (c: ConvenioPublico): string =>
  `${c.concedente.documento ?? ''}|${c.concedente.razao_social}`;

/** Lista com busca, filtros e páginas de 50 (como o `ListaPublica` do Django). */
export function renderLista(todos: ConvenioPublico[], hoje: string, params: URLSearchParams): Resposta {
  const publicos = todos.filter((c) => vigenciaPublica(c, hoje) !== null);
  const filtros: Filtros = {
    q: params.get('q') ?? '',
    tipo: params.get('tipo') ?? '',
    uf: params.get('uf') ?? '',
  };
  const achados = ordenar(filtrar(publicos, filtros));
  const paginas = Math.max(1, Math.ceil(achados.length / POR_PAGINA));
  const textoPagina = params.get('page') ?? '1';
  const pagina = /^\d+$/.test(textoPagina) ? Number(textoPagina) : NaN;
  if (!(pagina >= 1 && pagina <= paginas)) return naoEncontrado();
  const desta = achados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const vigentes = publicos.filter((c) => vigenciaPublica(c, hoje) === 'vigente').length;
  const aIniciar = publicos.length - vigentes;
  const concedentes = new Set(publicos.map(chaveConcedente)).size;
  let resumo: string;
  if (filtros.q || filtros.tipo || filtros.uf) {
    const n = achados.length;
    resumo = `${n} convênio${plural(n)} encontrado${plural(n)}
    · <a href="${CAMINHO_LISTA}">limpar busca</a>`;
  } else {
    resumo = `${vigentes} convênio${plural(vigentes)} vigente${plural(vigentes)}${aIniciar ? ` · ${aIniciar} a iniciar` : ''}`;
  }

  // Mantém os filtros ao trocar de página.
  const outros = new URLSearchParams(params);
  outros.delete('page');
  const parametros = esc(outros.toString());
  const link = (n: number): string => `?${parametros}${parametros ? '&amp;' : ''}page=${n}`;

  let corpo: string;
  if (desta.length) {
    corpo = `<ul class="lista" aria-label="Convênios">
${desta.map((c) => linha(c, hoje)).join('\n')}
  </ul>`;
  } else {
    // MS07: sem resultado, a página mostra o caminho para pedir convênio.
    corpo = `<div class="aviso vazio">
  ${icone('vazio')}
  <p><strong>Nenhum convênio vigente encontrado.</strong></p>
  <p>Se a empresa ainda não tem convênio com a UFF, ela pode solicitar um à Divisão de Estágio da PROGRAD.</p>
</div>`;
  }
  const nav =
    paginas > 1
      ? `
<nav class="paginas" aria-label="Páginas">
  ${pagina > 1 ? `<a href="${link(pagina - 1)}" rel="prev">← Anterior</a>` : ''}
  <span>Página ${pagina} de ${paginas}</span>
  ${pagina < paginas ? `<a href="${link(pagina + 1)}" rel="next">Próxima →</a>` : ''}
</nav>`
      : '';

  const ufs: [string, string][] = UFS.map((uf) => [uf, uf]);
  const conteudo = `<div class="cabecalho">
  <h1>Convênios de estágio</h1>
  <p>Empresas e instituições com convênio de estágio com a UFF, vigente ou a iniciar.</p>
</div>

<dl class="resumos">
  <div class="vigentes"><dt>Vigentes</dt><dd>${vigentes}</dd></div>
  <div class="iniciar"><dt>A iniciar</dt><dd>${aIniciar}</dd></div>
  <div class="total"><dt>Concedentes</dt><dd>${concedentes}</dd></div>
</dl>

<div class="quadro">
<form class="busca" method="get" role="search" aria-label="Buscar convênios">
  <div class="campo-busca">
    <label for="q">Empresa, CNPJ ou nº do convênio</label>
    ${icone('busca')}
    <input id="q" name="q" type="search" value="${esc(filtros.q)}" placeholder="Ex.: nome da empresa ou PR-212/2026">
  </div>
  <div>
    <label for="tipo">Tipo</label>
    <select id="tipo" name="tipo">
      ${opcoes(TIPOS, filtros.tipo, 'Todos')}
    </select>
  </div>
  <div>
    <label for="uf">UF</label>
    <select id="uf" name="uf">
      ${opcoes(ufs, filtros.uf, 'Todas')}
    </select>
  </div>
  <button type="submit">Buscar</button>
</form>

<p class="resumo" aria-live="polite">
  ${resumo}
</p>

${corpo}
</div>${nav}`;
  return { status: 200, html: documentoHtml('Convênios de estágio', ESTILO_LISTA + ESTILO_SR, conteudo) };
}

/** Texto só para leitor de tela. */
const ESTILO_SR = `
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }`;

/** Detalhe; convênio que não é público dá 404, sem revelar que existe. */
export function renderDetalhe(c: ConvenioPublico | undefined, hoje: string): Resposta {
  const vigencia = c ? vigenciaPublica(c, hoje) : null;
  if (!c || !vigencia) return naoEncontrado();
  const k = c.concedente;
  const doc = documentoPublico(k.documento);
  const ini = c.inicio_vigencia!;
  const fim = c.fim_vigencia!;
  const a = andamento(c, hoje);
  const destaque = a.prazo ?? `Faltam ${tempoRestante(hoje, fim)}`;
  const classeDestaque = vigencia === 'a_iniciar' ? ' futuro' : a.urgente ? ' urgente' : '';
  const item = (rotulo: string, valor: string): string => `      <dt>${rotulo}</dt><dd>${valor}</dd>`;
  const dadosConvenio = [
    item('Nº do convênio', esc(c.numero)),
    c.processo_sei ? item('Nº do processo', esc(c.processo_sei)) : '',
    item('Ano', ini.slice(0, 4)),
  ].filter(Boolean);
  const dadosConcedente = [
    doc ? item('Documento', doc) : '',
    item('Tipo da instituição', esc(rotuloTipo(k.tipo))),
    k.ramo_atividade ? item('Ramo de atividade', esc(k.ramo_atividade)) : '',
    item('Cidade', `${esc(k.cidade)}/${esc(k.uf)}`),
  ].filter(Boolean);
  const marco = (rotulo: string, iso: string): string =>
    `<div><span>${rotulo}</span><strong>${dataBr(iso)}</strong><small>${dataLonga(iso)}</small></div>`;
  const hojeNoMeio = a.fracao > 0 && a.fracao < 1;
  const objeto = c.objeto
    ? `
  <section class="cartao objeto" aria-labelledby="t-objeto">
    <h2 id="t-objeto">Objeto</h2>
    <p>${esc(c.objeto).replace(/\r?\n/g, '<br>')}</p>
  </section>`
    : '';
  const conteudo = `<a class="voltar" href="${CAMINHO_LISTA}">${icone('voltar')} Todos os convênios</a>
<article>
  <div class="cabecalho">
    <h1>${esc(k.razao_social)}</h1>${k.nome_fantasia ? `\n    <p class="fantasia">${esc(k.nome_fantasia)}</p>` : ''}
    <div class="identificacao">${seloVigencia(c, vigencia)} <span>Convênio nº ${esc(c.numero)}</span></div>
  </div>
  <div class="grade">
  <section class="cartao vigencia" aria-labelledby="t-vigencia">
    <div class="titulo"><h2 id="t-vigencia">Vigência</h2><span class="destaque${classeDestaque}">${destaque}</span></div>
    ${barra(a, true)}
    <div class="marcos">
      ${marco('Início do convênio', ini)}${hojeNoMeio ? `\n      <div class="meio"><span>Hoje</span><strong>${dataBr(hoje)}</strong></div>` : ''}
      ${marco('Término do convênio', fim)}
    </div>
  </section>
  <section class="cartao" aria-labelledby="t-convenio">
    <h2 id="t-convenio">Dados do convênio</h2>
    <dl>
${dadosConvenio.join('\n')}
    </dl>
  </section>
  <section class="cartao" aria-labelledby="t-concedente">
    <h2 id="t-concedente">Concedente</h2>
    <dl>
${dadosConcedente.join('\n')}
    </dl>
  </section>${objeto}
  </div>
</article>`;
  return { status: 200, html: documentoHtml(k.razao_social, ESTILO_DETALHE + ESTILO_SR, conteudo) };
}

/** Roteia `/convenios` e `/convenios/<id>`; o resto dá 404. */
export function responder(
  convenios: ConvenioPublico[],
  hoje: string,
  caminho: string,
  params: URLSearchParams,
): Resposta {
  const partes = caminho.split('/').filter(Boolean);
  if (partes[0] !== CAMINHO_LISTA.slice(1) || partes.length > 2) return naoEncontrado();
  if (partes.length === 1) return renderLista(convenios, hoje, params);
  let id: string;
  try {
    id = decodeURIComponent(partes[1]);
  } catch {
    return naoEncontrado();
  }
  return renderDetalhe(
    convenios.find((c) => c.id === id),
    hoje,
  );
}
