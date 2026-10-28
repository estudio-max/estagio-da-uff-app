/// CPF e CNPJ: normalização, dígito verificador e máscara.
///
/// Aceita o CNPJ alfanumérico (IN RFB 2.229/2024): 12 caracteres [A-Z0-9]
/// mais 2 dígitos verificadores numéricos. Porta de `convenios/documentos.py`.
library;

const _pesosCnpj = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/// Remove máscara e espaços; letras em maiúsculas.
String normalizar(String valor) =>
    valor.replaceAll(RegExp(r'[\s./-]'), '').toUpperCase();

String _dvCpf(String base) {
  var soma = 0;
  for (var i = 0; i < base.length; i++) {
    soma += int.parse(base[i]) * (base.length + 1 - i);
  }
  final resto = soma * 10 % 11;
  return (resto == 10 ? 0 : resto).toString();
}

String _dvCnpj(String base, List<int> pesos) {
  // No CNPJ alfanumérico cada caractere vale ord(c) - 48.
  var soma = 0;
  for (var i = 0; i < base.length; i++) {
    soma += (base.codeUnitAt(i) - 48) * pesos[i];
  }
  final resto = soma % 11;
  return resto < 2 ? '0' : (11 - resto).toString();
}

bool _todosIguais(String s) => s.split('').toSet().length == 1;

bool cpfValido(String cpf) {
  if (!RegExp(r'^\d{11}$').hasMatch(cpf) || _todosIguais(cpf)) return false;
  final dv1 = _dvCpf(cpf.substring(0, 9));
  return cpf.substring(9) == dv1 + _dvCpf(cpf.substring(0, 9) + dv1);
}

bool cnpjValido(String cnpj) {
  if (!RegExp(r'^[A-Z0-9]{12}\d{2}$').hasMatch(cnpj) || _todosIguais(cnpj)) {
    return false;
  }
  final dv1 = _dvCnpj(cnpj.substring(0, 12), _pesosCnpj);
  return cnpj.substring(12) ==
      dv1 + _dvCnpj(cnpj.substring(0, 12) + dv1, [6, ..._pesosCnpj]);
}

/// Espera o valor já normalizado. Devolve a mensagem de erro, ou null se válido.
String? validarDocumento(String valor) {
  if ((valor.length == 11 && cpfValido(valor)) ||
      (valor.length == 14 && cnpjValido(valor))) {
    return null;
  }
  return 'CPF ou CNPJ inválido.';
}

String formatar(String valor) {
  if (valor.length == 11) {
    return '${valor.substring(0, 3)}.${valor.substring(3, 6)}.'
        '${valor.substring(6, 9)}-${valor.substring(9)}';
  }
  if (valor.length == 14) {
    return '${valor.substring(0, 2)}.${valor.substring(2, 5)}.'
        '${valor.substring(5, 8)}/${valor.substring(8, 12)}-${valor.substring(12)}';
  }
  return valor;
}
