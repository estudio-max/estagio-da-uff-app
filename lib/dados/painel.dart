import 'package:cloud_functions/cloud_functions.dart';

/// Convênio em tramitação há mais tempo (MS05).
class Parado {
  const Parado({
    required this.id,
    required this.numero,
    required this.concedente,
    required this.dias,
  });

  final String id;
  final String numero;
  final String concedente;
  final int dias;
}

/// RF06 e MS05: indicadores calculados pela Function `painelConvenios`.
class Indicadores {
  const Indicadores({
    required this.hoje,
    required this.porVigencia,
    required this.vencendo,
    required this.porTipo,
    required this.tramitacaoMedia,
    required this.tramitacaoMediana,
    required this.tramitacaoAmostra,
    required this.parados,
    required this.periodoTramitacaoDias,
  });

  factory Indicadores.fromMap(Map<String, dynamic> m) {
    Map<String, int> contagens(Object? v) => {
      for (final e in (v as Map? ?? {}).entries)
        '${e.key}': (e.value as num).toInt(),
    };
    return Indicadores(
      hoje: m['hoje'] as String? ?? '',
      porVigencia: contagens(m['por_vigencia']),
      vencendo: {
        for (final MapEntry(:key, :value) in contagens(m['vencendo']).entries)
          int.parse(key): value,
      },
      porTipo: contagens(m['por_tipo']),
      tramitacaoMedia: (m['tramitacao_media'] as num?)?.toDouble(),
      tramitacaoMediana: (m['tramitacao_mediana'] as num?)?.toDouble(),
      tramitacaoAmostra: (m['tramitacao_amostra'] as num?)?.toInt() ?? 0,
      parados: [
        for (final p in m['parados'] as List? ?? const [])
          Parado(
            id: p['id'] as String,
            numero: p['numero'] as String? ?? '',
            concedente: p['concedente'] as String? ?? '',
            dias: (p['dias'] as num).toInt(),
          ),
      ],
      periodoTramitacaoDias:
          (m['periodo_tramitacao_dias'] as num?)?.toInt() ?? 365,
    );
  }

  /// Data em que foi calculado (ISO, Brasília).
  final String hoje;

  /// Pelo valor da vigência (RN02): `em_tramitacao`, `vigente` etc.
  final Map<String, int> porVigencia;

  /// Vigentes que vencem em até N dias, pela janela (30, 90, 180).
  final Map<int, int> vencendo;

  /// Vigentes pelo valor do tipo de concedente (RN05), com todos os tipos.
  final Map<String, int> porTipo;
  final double? tramitacaoMedia;
  final double? tramitacaoMediana;
  final int tramitacaoAmostra;
  final List<Parado> parados;
  final int periodoTramitacaoDias;
}

/// Erro ao carregar o painel, com a mensagem para a tela.
class ErroPainel implements Exception {
  const ErroPainel(this.mensagem);

  final String mensagem;

  @override
  String toString() => mensagem;
}

abstract class FontePainel {
  Future<Indicadores> carregar();
}

class FunctionsPainel implements FontePainel {
  FunctionsPainel(this._functions);

  final FirebaseFunctions _functions;

  @override
  Future<Indicadores> carregar() async {
    try {
      final r = await _functions
          .httpsCallable('painelConvenios')
          .call<Map<String, dynamic>>();
      return Indicadores.fromMap(r.data);
    } on FirebaseFunctionsException catch (e) {
      throw ErroPainel(e.message ?? 'Não foi possível carregar o painel.');
    }
  }
}
