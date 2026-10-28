import '../dominio/modelos.dart';

/// Erro de regra de negócio, com a mensagem por campo para o formulário.
class ErroNegocio implements Exception {
  const ErroNegocio(this.campos);

  final Map<String, String> campos;

  @override
  String toString() => campos.values.join(' ');
}

abstract class Repositorio {
  Stream<List<Concedente>> concedentes();
  Stream<List<Convenio>> convenios();
  Stream<Convenio?> convenio(String id);
  Stream<List<Etapa>> etapas(String convenioId);
  Stream<List<RegistroHistorico>> historico(String convenioId);

  /// RN03: documento único. Devolve o id.
  Future<String> salvarConcedente(Concedente concedente);

  /// Valida, grava e acrescenta ao histórico (RF08). Devolve o id.
  Future<String> salvarConvenio(Convenio convenio, {Convenio? anterior});

  Future<void> adicionarEtapa(String convenioId, Etapa etapa);
}
