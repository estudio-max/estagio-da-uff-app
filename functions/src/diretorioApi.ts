// Provisório (D26): lê o papel no grupo pela API do Cosme (Cloud Run, projeto que já tem a delegação),
// em vez de chamar a Directory API direto. Mesma interface de `DiretorioGrupos`; trocar depois é só
// escolher o outro adaptador. Contrato em docs/API-GRUPO.md.
//
// A API responde sobre a pessoa dona do token: a Function repassa o token de ID do Firebase que o
// app mandou na chamada (`/membros/me`). Quem a pessoa é sai do token, não de um parâmetro.
import type { DiretorioGrupos, PapelNoGrupo } from './papel.js';

export interface ConfigDiretorioApi {
  /** Endereço da coleção de membros, sem barra no fim. Ex.: https://.../grupos/estagios/membros */
  urlMembros: string;
  /** Cabeçalho Authorization da chamada recebida (`Bearer <token de ID do Firebase>`). */
  autorizacao: string;
  fetchFn?: typeof fetch;
}

const PAPEIS: readonly string[] = ['OWNER', 'MANAGER', 'MEMBER'];

interface RespostaMembro {
  ok?: unknown;
  member?: { email?: unknown; role?: unknown; status?: unknown };
}

async function lerJson(resposta: Response): Promise<RespostaMembro | null> {
  try {
    return (await resposta.json()) as RespostaMembro;
  } catch {
    return null;
  }
}

export function criarDiretorioApi(c: ConfigDiretorioApi): DiretorioGrupos {
  const buscar = c.fetchFn ?? fetch;
  if (!/^Bearer \S+$/.test(c.autorizacao)) {
    throw new Error('chamada sem token de ID do Firebase');
  }

  return {
    async papelNoGrupo(grupo, email): Promise<PapelNoGrupo | null> {
      if (!grupo.trim()) throw new Error('GRUPO_EMAIL não definido');
      const url = `${c.urlMembros}/me?email=${encodeURIComponent(grupo.trim())}`;
      const resposta = await buscar(url, { headers: { Authorization: c.autorizacao } });
      const corpo = await lerJson(resposta);

      // A API devolve 404 com `{ ok: false }` para "não está no grupo". Um 404 sem esse corpo é
      // rota ou URL errada: vira erro, senão uma configuração errada tiraria o acesso de todos.
      if (resposta.status === 404 && corpo?.ok === false) return null;
      // Só o status vai para o erro: o corpo pode ter dados pessoais.
      if (!resposta.ok || corpo?.ok !== true || !corpo.member) {
        throw new Error(`consulta à API do grupo: HTTP ${resposta.status}`);
      }

      const membro = corpo.member;
      // A API responde pelo dono do token; tem de ser a mesma pessoa que a Function está decidindo.
      if (String(membro.email ?? '').toLowerCase() !== email.toLowerCase()) {
        throw new Error('consulta à API do grupo: a resposta é de outra pessoa');
      }
      if (membro.status !== undefined && membro.status !== 'ACTIVE') return null;
      return PAPEIS.includes(String(membro.role)) ? (membro.role as PapelNoGrupo) : null;
    },
  };
}
