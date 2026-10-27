class Convenio {
  const Convenio({
    required this.id,
    required this.concedente,
    required this.status,
    required this.vigenciaFim,
  });

  factory Convenio.fromMap(String id, Map<String, dynamic> data) => Convenio(
    id: id,
    concedente: data['concedente'] as String? ?? '',
    status: data['status'] as String? ?? '',
    vigenciaFim: DateTime.tryParse(data['vigencia_fim'] as String? ?? ''),
  );

  final String id;
  final String concedente;
  final String status;
  final DateTime? vigenciaFim;
}
