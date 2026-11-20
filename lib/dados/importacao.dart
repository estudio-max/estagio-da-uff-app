import 'dart:convert';
import 'dart:typed_data';

import 'package:cloud_functions/cloud_functions.dart';

/// Arquivo escolhido pela Divisão: nome e conteúdo bruto.
class ArquivoImportacao {
  const ArquivoImportacao(this.nome, this.bytes);

  final String nome;
  final Uint8List bytes;
}

/// RF07: resultado das Functions de importação.
class ResultadoImportacao {
  const ResultadoImportacao({
    required this.lidos,
    required this.criados,
    required this.atualizados,
    required this.rejeitados,
    required this.avisos,
    required this.simulado,
    required this.csv,
    this.situacoes = const {},
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
        situacoes: {
          for (final e in (m['situacoes'] as Map? ?? {}).entries)
            '${e.key}': (e.value as num).toInt(),
        },
      );

  final int lidos;
  final int criados;
  final int atualizados;
  final int rejeitados;
  final int avisos;
  final bool simulado;

  /// Rejeitados e avisos, separados por `;`, com BOM (abre direto no Excel).
  final String csv;

  /// Planilhas: quantos convênios ficaram em cada situação (finalizado etc.).
  final Map<String, int> situacoes;
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
  Future<ResultadoImportacao> importar(
    List<ArquivoImportacao> arquivos, {
    required bool simular,
  });
}

/// Chama uma Function de importação e traduz o erro para a tela.
Future<ResultadoImportacao> _chamar(
  FirebaseFunctions functions,
  String nome,
  Map<String, dynamic> dados,
) async {
  // A Function aceita até 9 minutos; o padrão do cliente é 1.
  final chamada = functions.httpsCallable(
    nome,
    options: HttpsCallableOptions(timeout: const Duration(minutes: 9)),
  );
  try {
    final r = await chamada.call<Map<String, dynamic>>(dados);
    return ResultadoImportacao.fromMap(r.data);
  } on FirebaseFunctionsException catch (e) {
    throw ErroImportacao(e.message ?? 'A importação falhou (${e.code}).');
  }
}

/// RF07: XML exportado do estagio.uff.br (Drupal); um arquivo, em UTF-8.
class FunctionsImportador implements Importador {
  FunctionsImportador(this._functions);

  final FirebaseFunctions _functions;

  @override
  Future<ResultadoImportacao> importar(
    List<ArquivoImportacao> arquivos, {
    required bool simular,
  }) => _chamar(_functions, 'importarConveniosDrupal', {
    'xml': utf8.decode(arquivos.single.bytes).replaceFirst('\uFEFF', ''),
    'simular': simular,
  });
}

/// RF07: planilhas internas da Divisão (.xlsx ou .xlsm), uma ou mais.
class FunctionsImportadorPlanilhas implements Importador {
  FunctionsImportadorPlanilhas(this._functions);

  final FirebaseFunctions _functions;

  @override
  Future<ResultadoImportacao> importar(
    List<ArquivoImportacao> arquivos, {
    required bool simular,
  }) => _chamar(_functions, 'importarConveniosPlanilhas', {
    'arquivos': [
      for (final a in arquivos)
        {'nome': a.nome, 'conteudo': base64Encode(a.bytes)},
    ],
    'simular': simular,
  });
}
