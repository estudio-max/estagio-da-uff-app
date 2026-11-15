/**
 * CPF e CNPJ: normalização e dígito verificador (RN03, RN06).
 *
 * Aceita o CNPJ alfanumérico (IN RFB 2.229/2024): 12 caracteres [A-Z0-9] mais 2 dígitos
 * verificadores numéricos. Porta de `lib/dominio/documentos.dart` (que porta o Django).
 */

const PESOS_CNPJ = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove máscara e espaços; letras em maiúsculas. */
export const normalizar = (valor: string): string => valor.replace(/[\s./-]/g, '').toUpperCase();

function dvCpf(base: string): string {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
  const resto = (soma * 10) % 11;
  return String(resto === 10 ? 0 : resto);
}

function dvCnpj(base: string, pesos: number[]): string {
  // No CNPJ alfanumérico cada caractere vale o código ASCII menos 48.
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += (base.charCodeAt(i) - 48) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? '0' : String(11 - resto);
}

const todosIguais = (s: string): boolean => new Set(s).size === 1;

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || todosIguais(cpf)) return false;
  const dv1 = dvCpf(cpf.slice(0, 9));
  return cpf.slice(9) === dv1 + dvCpf(cpf.slice(0, 9) + dv1);
}

export function cnpjValido(cnpj: string): boolean {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;
  const dv1 = dvCnpj(cnpj.slice(0, 12), PESOS_CNPJ);
  return cnpj.slice(12) === dv1 + dvCnpj(cnpj.slice(0, 12) + dv1, [6, ...PESOS_CNPJ]);
}

/** Espera o valor já normalizado: CPF com 11 caracteres ou CNPJ com 14. */
export const documentoValido = (valor: string): boolean =>
  (valor.length === 11 && cpfValido(valor)) || (valor.length === 14 && cnpjValido(valor));
