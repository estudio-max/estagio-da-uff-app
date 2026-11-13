// D26: quem está no grupo do Google recebe o papel `divisao` (RN04). Lógica pura, testável.

export type PapelNoGrupo = 'OWNER' | 'MANAGER' | 'MEMBER';

export interface DiretorioGrupos {
  /** Papel direto da pessoa no grupo, ou null se não for membro. */
  papelNoGrupo(grupo: string, email: string): Promise<PapelNoGrupo | null>;
}

export type Motivo =
  | 'ok'
  | 'sem_email'
  | 'email_nao_verificado'
  | 'dominio'
  | 'fora_do_grupo'
  | 'papel_sem_acesso';

export interface EntradaPapel {
  email?: string;
  emailVerificado?: boolean;
  /** Ex.: id.uff.br (sem o @). */
  dominio: string;
  grupo: string;
  /** Papéis do grupo que dão acesso ao sistema. */
  papeisComAcesso: PapelNoGrupo[];
  diretorio: DiretorioGrupos;
}

export interface DecisaoPapel {
  divisao: boolean;
  papel: PapelNoGrupo | null;
  motivo: Motivo;
}

const nega = (motivo: Motivo, papel: PapelNoGrupo | null = null): DecisaoPapel => ({
  divisao: false,
  papel,
  motivo,
});

export async function decidirPapel(e: EntradaPapel): Promise<DecisaoPapel> {
  const email = e.email?.trim().toLowerCase();
  if (!email) return nega('sem_email');
  if (e.emailVerificado !== true) return nega('email_nao_verificado');
  // O filtro `hd` da tela é só uma dica: aqui é que o domínio é de fato exigido.
  if (!email.endsWith(`@${e.dominio.toLowerCase()}`)) return nega('dominio');

  const papel = await e.diretorio.papelNoGrupo(e.grupo, email);
  if (papel === null) return nega('fora_do_grupo');
  if (!e.papeisComAcesso.includes(papel)) return nega('papel_sem_acesso', papel);
  return { divisao: true, papel, motivo: 'ok' };
}
