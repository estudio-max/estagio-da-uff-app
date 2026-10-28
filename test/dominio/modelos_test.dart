// Casos portados de tests/test_convenios.py (versão Django).
import 'package:estagios_uff/dominio/documentos.dart';
import 'package:estagios_uff/dominio/modelos.dart';
import 'package:flutter_test/flutter_test.dart';

final hoje = DateTime(2026, 10, 6);

Convenio novoConvenio({
  String numero = 'PR-001/2026',
  Situacao situacao = Situacao.finalizado,
  DateTime? inicio,
  DateTime? fim,
  bool semInicio = false,
  bool semFim = false,
}) => Convenio(
  concedenteId: 'c1',
  concedenteNome: 'Empresa Fictícia Ltda',
  numero: numero,
  situacao: situacao,
  inicioVigencia: semInicio ? null : inicio ?? DateTime(2026),
  fimVigencia: semFim ? null : fim ?? DateTime(2030, 12, 31),
);

void main() {
  group('RN02: vigência derivada', () {
    final casos = <String, (Convenio, Vigencia)>{
      'em tramitação': (
        novoConvenio(situacao: Situacao.emTramitacao),
        Vigencia.emTramitacao,
      ),
      'cancelado': (
        novoConvenio(situacao: Situacao.cancelado),
        Vigencia.cancelado,
      ),
      'início amanhã': (
        novoConvenio(inicio: DateTime(2026, 10, 7)),
        Vigencia.aIniciar,
      ),
      'início hoje': (novoConvenio(inicio: hoje), Vigencia.vigente),
      'fim hoje': (novoConvenio(fim: hoje), Vigencia.vigente),
      'fim ontem': (novoConvenio(fim: DateTime(2026, 10, 5)), Vigencia.vencido),
    };
    casos.forEach((nome, caso) {
      test(nome, () => expect(caso.$1.vigencia(hoje), caso.$2));
    });

    test('a hora do dia não muda a vigência', () {
      final c = novoConvenio(fim: hoje);
      expect(c.vigencia(DateTime(2026, 10, 6, 23, 59)), Vigencia.vigente);
    });
  });

  group('RN07: vigência máxima de 5 anos', () {
    test('somarAnos trata 29 de fevereiro', () {
      expect(somarAnos(DateTime(2028, 2, 29), 5), DateTime(2033, 3));
      expect(somarAnos(DateTime(2026, 9, 8), 5), DateTime(2031, 9, 8));
    });

    test('cinco anos menos um dia é aceito (PR-212/2026)', () {
      final c = novoConvenio(
        inicio: DateTime(2026, 9, 8),
        fim: DateTime(2031, 9, 7),
      );
      expect(c.validar(), isEmpty);
    });

    test('cinco anos completos é rejeitado', () {
      final c = novoConvenio(
        inicio: DateTime(2026, 9, 8),
        fim: DateTime(2031, 9, 8),
      );
      expect(c.validar()['fim_vigencia'], contains('vigência máxima é de 5'));
    });
  });

  group('regras que no Django ficam no banco', () {
    test('fim antes do início é barrado', () {
      final c = novoConvenio(inicio: DateTime(2026, 5), fim: DateTime(2026, 4));
      expect(c.validar().keys, contains('fim_vigencia'));
    });

    for (final (campo, convenio) in [
      ('numero', novoConvenio(numero: '')),
      ('inicio_vigencia', novoConvenio(semInicio: true)),
      ('fim_vigencia', novoConvenio(semFim: true)),
    ]) {
      test('finalizado exige $campo', () {
        expect(convenio.validar().keys, contains(campo));
      });
    }

    test('em tramitação pode ficar sem número e datas', () {
      final c = Convenio(concedenteId: 'c1', concedenteNome: 'X');
      expect(c.validar(), isEmpty);
    });
  });

  group('finalizado_em', () {
    test('a transição para finalizado registra a data', () {
      final c = novoConvenio(situacao: Situacao.emTramitacao)
          .comSituacao(Situacao.finalizado, hoje);
      expect(c.finalizadoEm, hoje);
    });

    test('convênio já finalizado sem data não ganha hoje ao ser editado', () {
      final c = novoConvenio().comSituacao(Situacao.finalizado, hoje);
      expect(c.finalizadoEm, isNull);
    });

    test('sair de finalizado apaga a data', () {
      final c = novoConvenio()
          .copyWith(finalizadoEm: hoje)
          .comSituacao(Situacao.cancelado, hoje);
      expect(c.finalizadoEm, isNull);
    });
  });

  group('Concedente (RN03/RN06)', () {
    Concedente concedente(String documento, TipoConcedente tipo) => Concedente(
      documento: normalizar(documento),
      razaoSocial: 'Empresa Fictícia Ltda',
      tipo: tipo,
      uf: 'RJ',
      cidade: 'Niterói',
    );

    test('documento com máscara é normalizado e validado', () {
      final c = concedente('11.222.333/0001-81', TipoConcedente.empresaPrivada);
      expect(c.documento, '11222333000181');
      expect(c.validar(), isEmpty);
    });

    test('profissional liberal entra com CPF', () {
      final c = concedente(
        '529.982.247-25',
        TipoConcedente.profissionalLiberal,
      );
      expect(c.validar(), isEmpty);
      expect(c.documentoFormatado, '529.982.247-25');
    });

    test('documento obrigatório e válido no cadastro', () {
      expect(
        concedente('', TipoConcedente.outros).validar().keys,
        contains('documento'),
      );
      expect(
        concedente('11222333000180', TipoConcedente.outros).validar().keys,
        contains('documento'),
      );
    });

    test('nome de exibição prefere o nome fantasia', () {
      final c = Concedente(
        razaoSocial: 'Empresa Fictícia Ltda',
        nomeFantasia: 'Fictícia',
        tipo: TipoConcedente.outros,
        uf: 'RJ',
        cidade: 'Niterói',
      );
      expect(c.nome, 'Fictícia');
    });
  });

  test('camposAlterados lista só o que mudou', () {
    final antes = novoConvenio();
    final depois = antes.copyWith(numero: 'PR-002/2026', objeto: 'Estágio');
    expect(camposAlterados(antes, depois), ['numero', 'objeto']);
  });
}
