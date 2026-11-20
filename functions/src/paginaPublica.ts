/**
 * Página pública de convênios (RF03, RF04, RN01, RN08, MS06, MS07). Porta de
 * `convenios/views.py` e dos templates `convenios/*.html` da versão Django.
 *
 * Só regras e HTML, sem Firestore (a leitura está em paginaPublicaFirestore.ts).
 * Convênios finalizados vigentes ou a iniciar (estes com selo "A partir de", D18).
 * Campos públicos: os da página atual do site (premissa da D2). Observações internas,
 * e-mail, etapas, histórico, minuta, origem e Resolução CEP nunca entram no modelo.
 */
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
const linkDetalhe = (c: ConvenioPublico): string => `${CAMINHO_LISTA}/${encodeURIComponent(c.id)}`;
const rotuloTipo = (tipo: string): string => ROTULO_TIPO.get(tipo) ?? 'Outros';

const ESTILO_BASE = `
  :root {
    --cor-principal: #7366ff; --cor-principal-clara: #f1f0ff; --fundo: #f7f8f9;
    --superficie: #ffffff; --texto: #404040; --texto-forte: #222222; --suave: #52526c;
    --borda: rgba(82, 82, 108, 0.12); --sombra: 0 9px 20px rgba(46, 35, 94, 0.07);
    --raio: 15px; --raio-pequeno: 6px; --border-color: #dfe0e6; --darkened-bg: #fafafc;
    --fonte: "Rubik", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --marca: var(--cor-principal); --marca-texto: #fff; --destaque: var(--cor-principal-clara);
    --foco: #f0a500; color-scheme: light;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 16px/1.5 var(--fonte); }
  a { color: var(--marca); }
  :focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }
  .pular { position: absolute; left: -999px; }
  .pular:focus { left: 16px; top: 8px; background: var(--superficie); padding: 8px; }
  header { background: var(--superficie); color: var(--texto); box-shadow: var(--sombra); }
  header .conteudo { padding-block: 20px; }
  header h1 { margin: 0; font-size: 1.4rem; font-weight: 600; color: var(--cor-principal); }
  header p { margin: 4px 0 0; color: var(--suave); }
  header a { color: inherit; text-decoration: none; }
  .conteudo { max-width: 1100px; margin: 0 auto; padding-inline: 16px; }
  main { padding-block: 24px 48px; }
  .selo { display: inline-block; background: var(--destaque); color: var(--marca); font-weight: 600;
    font-size: .8rem; padding: 2px 10px; border-radius: 999px; }
  .selo-futuro { background: #fff4d6; color: #7a4b00; }
  footer { color: var(--suave); font-size: .875rem; padding-block: 24px; border-top: 1px solid var(--borda); }`;

const ESTILO_LISTA = `
  .busca { display: grid; grid-template-columns: 1fr 220px 110px auto; gap: 12px; align-items: end;
    background: var(--superficie); border-radius: var(--raio); box-shadow: var(--sombra); padding: 20px; }
  .busca label { display: block; font-size: .875rem; font-weight: 600; margin-bottom: 4px; }
  .busca input, .busca select, .busca button { width: 100%; font: inherit; padding: 8px 10px;
    border: 1px solid var(--border-color); border-radius: var(--raio-pequeno); background: var(--superficie); color: var(--texto); }
  .busca button { background: var(--marca); color: var(--marca-texto); border-color: var(--marca);
    font-weight: 600; cursor: pointer; }
  .resumo { color: var(--suave); margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; background: var(--superficie);
    border-radius: var(--raio); box-shadow: var(--sombra); overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--borda); vertical-align: top; }
  th { font-size: .85rem; font-weight: 500; color: var(--suave); background: var(--darkened-bg); }
  td small { color: var(--suave); display: block; }
  td[data-rotulo="Nº"] { white-space: nowrap; }
  .vazio { background: var(--superficie); border-radius: var(--raio); box-shadow: var(--sombra); padding: 32px; text-align: center; }
  .paginas { display: flex; gap: 16px; justify-content: center; align-items: center; margin-top: 20px; }
  @media (max-width: 760px) {
    .busca { grid-template-columns: 1fr 1fr; }
    .busca .campo-busca, .busca button { grid-column: 1 / -1; }
    thead { display: none; }
    table, tbody, tr, td { display: block; }
    tr { border-bottom: 1px solid var(--borda); padding: 8px 0; }
    td { border: 0; padding: 4px 12px; }
    td[data-rotulo]::before { content: attr(data-rotulo) ": "; font-weight: 600; color: var(--suave); }
  }`;

const ESTILO_DETALHE = `
  .cartao { background: var(--superficie); border-radius: var(--raio); box-shadow: var(--sombra); padding: 28px; }
  .cartao h2 { margin: 0 0 6px; font-size: 1.3rem; font-weight: 500; color: var(--texto-forte); }
  dl { display: grid; grid-template-columns: 220px 1fr; gap: 10px 16px; margin: 20px 0 0; }
  dt { color: var(--suave); font-weight: 600; }
  dd { margin: 0; }
  @media (max-width: 640px) { dl { grid-template-columns: 1fr; gap: 2px; } dd { margin-bottom: 10px; } }`;

function documentoHtml(titulo: string, estilo: string, conteudo: string): string {
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)} · UFF</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600&display=swap">
  <style>${ESTILO_BASE}${estilo}
  </style>
</head>
<body>
  <a class="pular" href="#principal">Pular para o conteúdo</a>
  <header>
    <div class="conteudo">
      <h1><a href="${CAMINHO_LISTA}">Convênios de estágio da UFF</a></h1>
      <p>Divisão de Estágio · PROGRAD</p>
    </div>
  </header>
  <main id="principal" class="conteudo">
${conteudo}
  </main>
  <footer class="conteudo">
    Lista atualizada automaticamente a partir do cadastro da Divisão de Estágio.
    Dúvidas sobre convênios: Divisão de Estágio da PROGRAD.
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

function linha(c: ConvenioPublico, hoje: string): string {
  const k = c.concedente;
  const doc = documentoPublico(k.documento);
  const selo =
    vigenciaPublica(c, hoje) === 'a_iniciar'
      ? `<br><span class="selo selo-futuro">A partir de ${dataBr(c.inicio_vigencia!)}</span>`
      : '';
  return `    <tr>
      <td>
        <a href="${linkDetalhe(c)}">${esc(k.razao_social)}</a>${doc ? `\n        <small>${doc}</small>` : ''}
      </td>
      <td data-rotulo="Nº">${esc(c.numero)}</td>
      <td data-rotulo="Vigência">
        ${dataBr(c.inicio_vigencia!)} a ${dataBr(c.fim_vigencia!)}${selo}
      </td>
      <td data-rotulo="Local">${esc(k.cidade)}/${esc(k.uf)}</td>
      <td data-rotulo="Tipo">${esc(rotuloTipo(k.tipo))}</td>
    </tr>`;
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
    `<p><strong>Convênio não encontrado.</strong></p>
<p><a href="${CAMINHO_LISTA}">← Todos os convênios</a></p>`,
  ),
});

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

  let resumo: string;
  if (filtros.q || filtros.tipo || filtros.uf) {
    const n = achados.length;
    resumo = `${n} convênio${plural(n)} encontrado${plural(n)}
    · <a href="${CAMINHO_LISTA}">limpar busca</a>`;
  } else {
    const vigentes = publicos.filter((c) => vigenciaPublica(c, hoje) === 'vigente').length;
    const aIniciar = publicos.length - vigentes;
    resumo = `${vigentes} convênio${plural(vigentes)} vigente${plural(vigentes)}${aIniciar ? ` · ${aIniciar} a iniciar` : ''}`;
  }

  // Mantém os filtros ao trocar de página.
  const outros = new URLSearchParams(params);
  outros.delete('page');
  const parametros = esc(outros.toString());
  const link = (n: number): string => `?${parametros}${parametros ? '&amp;' : ''}page=${n}`;

  let corpo: string;
  if (desta.length) {
    const nav =
      paginas > 1
        ? `
<nav class="paginas" aria-label="Páginas">
  ${pagina > 1 ? `<a href="${link(pagina - 1)}">← Anterior</a>` : ''}
  <span>Página ${pagina} de ${paginas}</span>
  ${pagina < paginas ? `<a href="${link(pagina + 1)}">Próxima →</a>` : ''}
</nav>`
        : '';
    corpo = `<table>
  <thead>
    <tr><th scope="col">Concedente</th><th scope="col">Nº do convênio</th><th scope="col">Vigência</th>
        <th scope="col">Local</th><th scope="col">Tipo</th></tr>
  </thead>
  <tbody>
${desta.map((c) => linha(c, hoje)).join('\n')}
  </tbody>
</table>${nav}`;
  } else {
    // MS07: sem resultado, a página mostra o caminho para pedir convênio.
    corpo = `<div class="vazio">
  <p><strong>Nenhum convênio vigente encontrado.</strong></p>
  <p>Se a empresa ainda não tem convênio com a UFF, ela pode solicitar um à Divisão de Estágio da PROGRAD.</p>
</div>`;
  }

  const ufs: [string, string][] = UFS.map((uf) => [uf, uf]);
  const conteudo = `<form class="busca" method="get" role="search" aria-label="Buscar convênios">
  <div class="campo-busca">
    <label for="q">Empresa, CNPJ ou nº do convênio</label>
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

${corpo}`;
  return { status: 200, html: documentoHtml('Convênios de estágio', ESTILO_LISTA, conteudo) };
}

/** Detalhe; convênio que não é público dá 404, sem revelar que existe. */
export function renderDetalhe(c: ConvenioPublico | undefined, hoje: string): Resposta {
  const vigencia = c ? vigenciaPublica(c, hoje) : null;
  if (!c || !vigencia) return naoEncontrado();
  const k = c.concedente;
  const doc = documentoPublico(k.documento);
  const item = (rotulo: string, valor: string): string => `    <dt>${rotulo}</dt><dd>${valor}</dd>`;
  const campos = [
    k.nome_fantasia ? item('Nome fantasia', esc(k.nome_fantasia)) : '',
    item('Nº do convênio', esc(c.numero)),
    item('Início do convênio', dataLonga(c.inicio_vigencia!)),
    item('Término do convênio', dataLonga(c.fim_vigencia!)),
    c.processo_sei ? item('Nº do processo', esc(c.processo_sei)) : '',
    item('Ano', c.inicio_vigencia!.slice(0, 4)),
    doc ? item('Documento', doc) : '',
    item('Tipo da instituição', esc(rotuloTipo(k.tipo))),
    k.ramo_atividade ? item('Ramo de atividade', esc(k.ramo_atividade)) : '',
    item('Cidade', `${esc(k.cidade)}/${esc(k.uf)}`),
    c.objeto ? item('Objeto', esc(c.objeto).replace(/\r?\n/g, '<br>')) : '',
  ].filter(Boolean);
  const selo =
    vigencia === 'a_iniciar'
      ? `<span class="selo selo-futuro">A partir de ${dataBr(c.inicio_vigencia!)}</span>`
      : '<span class="selo">Vigente</span>';
  const conteudo = `<p><a href="${CAMINHO_LISTA}">← Todos os convênios</a></p>
<article class="cartao">
  <h2>${esc(k.razao_social)}</h2>
  ${selo}
  <dl>
${campos.join('\n')}
  </dl>
</article>`;
  return { status: 200, html: documentoHtml(k.razao_social, ESTILO_DETALHE, conteudo) };
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
