import 'package:cloud_functions/cloud_functions.dart';

/// RF07: resultado da Function `importarConveniosDrupal`.
class ResultadoImportacao {
  const ResultadoImportacao({
    required this.lidos,
    required this.criados,
    required this.atualizados,
    required this.rejeitados,
    required this.avisos,
    required this.simulado,
    required this.csv,
  });

  factory ResultadoImportacao.fromMap(Map<String, dynamic> m) =>
      ResultadoImportacao(
        lidos: m['lidos'] as int? ?? 0,
        criados: m['criados'] as int? ?? 0,
        atualizados: m['atualizados'] as int? ?? 0,
        rejeitados: m['rejeitados'] as int? ?? 0,
        avisos: m['avisos'] as int? ?? 0,
        simulado: m['simulado'] as bool? ?? true,
        csv: m['csv'] as String? ?? '',
      );

  final int lidos;
  final int criados;
  final int atualizados;
  final int rejeitados;
  final int avisos;
  final bool simulado;

  /// Rejeitados e avisos, separados por `;`, com BOM (abre direto no Excel).
  final String csv;
}

/// Erro da importação, com a mensagem para mostrar na tela.
class ErroImportacao implements Exception {
  const ErroImportacao(this.mensagem);

  final String mensagem;

  @override
  String toString() => mensagem;
}

abstract class Importador {
  /// Com [simular], nada é gravado.
  Future<ResultadoImportacao> importar(String xml, {required bool simular});
}

class FunctionsImportador implements Importador {
  FunctionsImportador(this._functions);

  final FirebaseFunctions _functions;

  @override
  Future<ResultadoImportacao> importar(
    String xml, {
    required bool simular,
  }) async {
    // A Function aceita até 9 minutos; o padrão do cliente é 1.
    final chamada = _functions.httpsCallable(
      'importarConveniosDrupal',
      options: HttpsCallableOptions(timeout: const Duration(minutes: 9)),
    );
    try {
      final r = await chamada.call<Map<String, dynamic>>({
        'xml': xml,
        'simular': simular,
      });
      return ResultadoImportacao.fromMap(r.data);
    } on FirebaseFunctionsException catch (e) {
      throw ErroImportacao(e.message ?? 'A importação falhou (${e.code}).');
    }
  }
}
