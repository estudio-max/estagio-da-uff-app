// Ponte provisória (D26): quem pode entrar vem de uma lista de e-mails na configuração da Function,
// até a consulta ao grupo do Google (API do Cosme ou Directory API) estar pronta e segura.
// O resto da regra não muda: e-mail verificado e do domínio é exigido em `decidirPapel`.
import type { DiretorioGrupos, PapelNoGrupo } from './papel.js';

const PAPEIS: readonly string[] = ['OWNER', 'MANAGER', 'MEMBER'];

/**
 * Formato: `ana@id.uff.br, bia@id.uff.br:MANAGER, cosme@id.uff.br:OWNER`.
 * Sem papel, vale MEMBER. Papel desconhecido é erro, para não passar despercebido.
 */
export function lerLista(texto: string): Map<string, PapelNoGrupo> {
  const mapa = new Map<string, PapelNoGrupo>();
  for (const bruto of texto.split(',')) {
    const item = bruto.trim();
    if (!item) continue;
    const [email, papel = 'MEMBER'] = item.split(':').map((p) => p.trim());
    const papelNormal = papel.toUpperCase();
    if (!email.includes('@')) throw new Error(`e-mail inválido na lista: ${email}`);
    if (!PAPEIS.includes(papelNormal)) throw new Error(`papel inválido na lista: ${papel}`);
    mapa.set(email.toLowerCase(), papelNormal as PapelNoGrupo);
  }
  return mapa;
}

export function criarDiretorioLista(texto: string): DiretorioGrupos {
  const mapa = lerLista(texto);
  return { papelNoGrupo: async (_grupo, email) => mapa.get(email.toLowerCase()) ?? null };
}
