export function saudacao(nome?: string): string {
  const limpo = nome?.trim();
  return limpo ? `Olá, ${limpo}!` : 'Olá!';
}
