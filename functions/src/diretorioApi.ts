// Provisório (D26): lê o papel no grupo pela API do Cosme (Cloud Run, projeto que já tem a delegação),
// em vez de chamar a Directory API direto. Mesma interface de `DiretorioGrupos`; trocar depois é só
// escolher o outro adaptador. Contrato em docs/API-GRUPO.md.
import type { DiretorioGrupos, PapelNoGrupo } from './papel.js';

export interface ConfigDiretorioApi {
  /** Endereço da coleção de membros, sem barra no fim. Ex.: https://.../grupos/estagios/membros */
  urlMembros: string;
  /** Cabeçalho Authorization com a identidade da Function (ID token do Google, sem chave). */
  obterAutorizacao: (audiencia: string) => Promise<string>;
  fetchFn?: typeof fetch;
}

const PAPEIS: readonly string[] = ['OWNER', 'MANAGER', 'MEMBER'];

export function criarDiretorioApi(c: ConfigDiretorioApi): DiretorioGrupos {
  const buscar = c.fetchFn ?? fetch;
  const audiencia = new URL(c.urlMembros).origin; // o serviço do Cloud Run é a audiência do token

  return {
    // O serviço atende um grupo só; o parâmetro `grupo` existe para casar com a interface.
    async papelNoGrupo(_grupo, email): Promise<PapelNoGrupo | null> {
      const resposta = await buscar(`${c.urlMembros}/${encodeURIComponent(email)}`, {
        headers: { Authorization: await c.obterAutorizacao(audiencia) },
      });
      if (resposta.status === 404) return null; // não é membro
      // Só o status vai para o erro: o corpo pode ter dados pessoais.
      if (!resposta.ok) throw new Error(`consulta à API do grupo: HTTP ${resposta.status}`);
      const membro = (await resposta.json()) as { role?: unknown; status?: unknown };
      if (membro.status !== undefined && membro.status !== 'ACTIVE') return null;
      return PAPEIS.includes(String(membro.role)) ? (membro.role as PapelNoGrupo) : null;
    },
  };
}
