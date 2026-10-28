// Casos portados de tests/test_documentos.py (versão Django).
import 'package:estagios_uff/dominio/documentos.dart';
import 'package:flutter_test/flutter_test.dart';

const cpfValidoEx = '52998224725';
const cnpjValidoEx = '11222333000181';
const cnpjAlfanumericoValido = '12ABC34501DE35'; // exemplo oficial da Receita

void main() {
  for (final v in [cpfValidoEx, cnpjValidoEx, cnpjAlfanumericoValido]) {
    test(
      'aceita documento válido $v',
      () => expect(validarDocumento(v), isNull),
    );
  }

  const invalidos = {
    '52998224724': 'CPF com DV errado',
    '11222333000180': 'CNPJ com DV errado',
    '12ABC34501DE36': 'CNPJ alfanumérico com DV errado',
    '11111111111': 'CPF com dígitos repetidos',
    '00000000000000': 'CNPJ com dígitos repetidos',
    '12ABC34501DEAB': 'DV do CNPJ alfanumérico tem de ser numérico',
    '5299822472': 'tamanho errado',
    '': 'vazio',
  };
  invalidos.forEach((valor, motivo) {
    test('rejeita documento inválido: $motivo', () {
      expect(validarDocumento(valor), isNotNull);
    });
  });

  test('normaliza máscara, espaços e caixa', () {
    expect(normalizar('529.982.247-25'), cpfValidoEx);
    expect(normalizar('11.222.333/0001-81'), cnpjValidoEx);
    expect(normalizar(' 12.abc.345/01de-35 '), cnpjAlfanumericoValido);
  });

  test('formata CPF e CNPJ', () {
    expect(formatar(cpfValidoEx), '529.982.247-25');
    expect(formatar(cnpjValidoEx), '11.222.333/0001-81');
    expect(formatar(cnpjAlfanumericoValido), '12.ABC.345/01DE-35');
    expect(formatar('123'), '123');
  });
}
