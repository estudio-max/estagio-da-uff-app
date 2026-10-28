/// Modelos e regras de negócio da 1a (RF01, RF02). Porta de `convenios/models.py`.
library;

import 'documentos.dart';

const vigenciaMaximaAnos = 5; // RN07 (premissa D15)

const ufs = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', //
  'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC',
  'SE', 'SP', 'TO',
];

/// RN05: lista oficial do formulário da PROGRAD.
enum TipoConcedente {
  ensinoPrivada('ensino_privada', 'Instituição de Ensino Privada'),
  empresaPrivada('empresa_privada', 'Empresa Privada'),
  ongOscip('ong_oscip', 'ONGs e OSCIPs'),
  orgaoPublico(
    'orgao_publico',
    'Órgãos dos Governos Federal, Estadual e Municipal',
  ),
  profissionalLiberal('profissional_liberal', 'Profissional Liberal'),
  agenteIntegracao('agente_integracao', 'Agente de Integração'),
  ensinoPublica('ensino_publica', 'Instituições de Ensino Públicas'),
  microempresa('microempresa', 'Microempresas'),
  outros('outros', 'Outros');

  const TipoConcedente(this.valor, this.rotulo);
  final String valor;
  final String rotulo;

  static TipoConcedente de(String? valor) => values.firstWhere(
    (t) => t.valor == valor,
    orElse: () => TipoConcedente.outros,
  );
}

enum Situacao {
  emTramitacao('em_tramitacao', 'Em tramitação'),
  finalizado('finalizado', 'Finalizado'),
  cancelado('cancelado', 'Cancelado');

  const Situacao(this.valor, this.rotulo);
  final String valor;
  final String rotulo;

  static Situacao de(String? valor) => values.firstWhere(
    (s) => s.valor == valor,
    orElse: () => Situacao.emTramitacao,
  );
}

/// RN02: derivada de situação + datas; nunca armazenada.
enum Vigencia {
  emTramitacao('Em tramitação'),
  cancelado('Cancelado'),
  aIniciar('A iniciar'),
  vigente('Vigente'),
  vencido('Vencido');

  const Vigencia(this.rotulo);
  final String rotulo;
}

enum Minuta {
  padraoUff('padrao_uff', 'Padrão UFF'),
  externa('externa', 'Externa (proposta pela concedente)');

  const Minuta(this.valor, this.rotulo);
  final String valor;
  final String rotulo;

  static Minuta de(String? valor) =>
      values.firstWhere((m) => m.valor == valor, orElse: () => padraoUff);
}

enum Origem {
  concedente('concedente', 'Concedente procurou a UFF'),
  uff('uff', 'UFF procurou a concedente');

  const Origem(this.valor, this.rotulo);
  final String valor;
  final String rotulo;

  static Origem de(String? valor) =>
      values.firstWhere((o) => o.valor == valor, orElse: () => concedente);
}

/// RF02: andamento interno do processo.
enum TipoEtapa {
  documentacaoRecebida('documentacao_recebida', 'Documentação recebida'),
  analise('analise', 'Análise da documentação'),
  termoPreparado('termo_preparado', 'Termo de convênio preparado'),
  assinaturaConcedente('assinatura_concedente', 'Assinado pela concedente'),
  assinaturaProReitor('assinatura_pro_reitor', 'Assinado pelo pró-reitor'),
  ratificacao('ratificacao', 'Ratificação'),
  extratoBs('extrato_bs', 'Extrato publicado no Boletim de Serviço'),
  outra('outra', 'Outra (descrever na observação)');

  const TipoEtapa(this.valor, this.rotulo);
  final String valor;
  final String rotulo;

  static TipoEtapa de(String? valor) =>
      values.firstWhere((e) => e.valor == valor, orElse: () => outra);
}

DateTime somarAnos(DateTime data, int anos) {
  final alvo = DateTime(data.year + anos, data.month, data.day);
  // 29/02 caindo em ano não bissexto vira 01/03.
  return alvo.month == data.month ? alvo : DateTime(data.year + anos, 3);
}

DateTime soData(DateTime d) => DateTime(d.year, d.month, d.day);

String dataIso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime? lerData(Object? iso) =>
    iso is String && iso.isNotEmpty ? DateTime.tryParse(iso) : null;

String dataBr(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/'
    '${d.year}';

class Concedente {
  const Concedente({
    required this.razaoSocial,
    required this.tipo,
    required this.uf,
    required this.cidade,
    this.id,
    this.documento,
    this.nomeFantasia = '',
    this.ramoAtividade = '',
    this.email = '',
  });

  factory Concedente.fromMap(String id, Map<String, dynamic> m) => Concedente(
    id: id,
    documento: m['documento'] as String?,
    razaoSocial: m['razao_social'] as String? ?? '',
    nomeFantasia: m['nome_fantasia'] as String? ?? '',
    tipo: TipoConcedente.de(m['tipo'] as String?),
    uf: m['uf'] as String? ?? '',
    cidade: m['cidade'] as String? ?? '',
    ramoAtividade: m['ramo_atividade'] as String? ?? '',
    email: m['email'] as String? ?? '',
  );

  final String? id;

  /// Normalizado (sem máscara). Vazio só em registro importado do Drupal (D20).
  final String? documento;
  final String razaoSocial;
  final String nomeFantasia;
  final TipoConcedente tipo;
  final String uf;
  final String cidade;
  final String ramoAtividade;
  final String email;

  String get nome => nomeFantasia.isNotEmpty ? nomeFantasia : razaoSocial;
  String get documentoFormatado => formatar(documento ?? '');

  Map<String, dynamic> toMap() => {
    'documento': documento,
    'razao_social': razaoSocial,
    'nome_fantasia': nomeFantasia,
    'tipo': tipo.valor,
    'uf': uf,
    'cidade': cidade,
    'ramo_atividade': ramoAtividade,
    'email': email,
  };

  /// RN03/RN06: documento obrigatório, com dígito verificador. Devolve campo → erro.
  Map<String, String> validar() {
    final erros = <String, String>{};
    final erroDoc = validarDocumento(documento ?? '');
    if (erroDoc != null) erros['documento'] = erroDoc;
    if (razaoSocial.trim().isEmpty) erros['razao_social'] = 'Informe o nome.';
    if (!ufs.contains(uf)) erros['uf'] = 'Escolha a UF.';
    if (cidade.trim().isEmpty) erros['cidade'] = 'Informe a cidade.';
    return erros;
  }
}

class Convenio {
  const Convenio({
    required this.concedenteId,
    required this.concedenteNome,
    this.id,
    this.numero = '',
    this.processoSei = '',
    this.resolucaoCep = '',
    this.resolucaoCepUrl = '',
    this.objeto = '',
    this.minuta = Minuta.padraoUff,
    this.origem = Origem.concedente,
    this.inicioVigencia,
    this.fimVigencia,
    this.situacao = Situacao.emTramitacao,
    this.observacoesInternas = '',
    this.finalizadoEm,
  });

  factory Convenio.fromMap(String id, Map<String, dynamic> m) => Convenio(
    id: id,
    concedenteId: m['concedente_id'] as String? ?? '',
    concedenteNome: m['concedente_nome'] as String? ?? '',
    numero: m['numero'] as String? ?? '',
    processoSei: m['processo_sei'] as String? ?? '',
    resolucaoCep: m['resolucao_cep'] as String? ?? '',
    resolucaoCepUrl: m['resolucao_cep_url'] as String? ?? '',
    objeto: m['objeto'] as String? ?? '',
    minuta: Minuta.de(m['minuta'] as String?),
    origem: Origem.de(m['origem'] as String?),
    inicioVigencia: lerData(m['inicio_vigencia']),
    fimVigencia: lerData(m['fim_vigencia']),
    situacao: Situacao.de(m['situacao'] as String?),
    observacoesInternas: m['observacoes_internas'] as String? ?? '',
    finalizadoEm: lerData(m['finalizado_em']),
  );

  final String? id;
  final String concedenteId;

  /// Cópia do nome da concedente, para listas e filtros sem junção.
  final String concedenteNome;
  final String numero;
  final String processoSei;
  final String resolucaoCep;
  final String resolucaoCepUrl;
  final String objeto;
  final Minuta minuta;
  final Origem origem;
  final DateTime? inicioVigencia;
  final DateTime? fimVigencia;
  final Situacao situacao;
  final String observacoesInternas;

  /// Preenchido ao marcar como finalizado; base do tempo de tramitação (MS05).
  final DateTime? finalizadoEm;

  Convenio copyWith({
    String? id,
    String? concedenteId,
    String? concedenteNome,
    String? numero,
    String? processoSei,
    String? resolucaoCep,
    String? resolucaoCepUrl,
    String? objeto,
    Minuta? minuta,
    Origem? origem,
    DateTime? inicioVigencia,
    DateTime? fimVigencia,
    Situacao? situacao,
    String? observacoesInternas,
    DateTime? finalizadoEm,
    bool limparFinalizadoEm = false,
  }) => Convenio(
    id: id ?? this.id,
    concedenteId: concedenteId ?? this.concedenteId,
    concedenteNome: concedenteNome ?? this.concedenteNome,
    numero: numero ?? this.numero,
    processoSei: processoSei ?? this.processoSei,
    resolucaoCep: resolucaoCep ?? this.resolucaoCep,
    resolucaoCepUrl: resolucaoCepUrl ?? this.resolucaoCepUrl,
    objeto: objeto ?? this.objeto,
    minuta: minuta ?? this.minuta,
    origem: origem ?? this.origem,
    inicioVigencia: inicioVigencia ?? this.inicioVigencia,
    fimVigencia: fimVigencia ?? this.fimVigencia,
    situacao: situacao ?? this.situacao,
    observacoesInternas: observacoesInternas ?? this.observacoesInternas,
    finalizadoEm: limparFinalizadoEm ? null : finalizadoEm ?? this.finalizadoEm,
  );

  Map<String, dynamic> toMap() => {
    'concedente_id': concedenteId,
    'concedente_nome': concedenteNome,
    'numero': numero,
    'processo_sei': processoSei,
    'resolucao_cep': resolucaoCep,
    'resolucao_cep_url': resolucaoCepUrl,
    'objeto': objeto,
    'minuta': minuta.valor,
    'origem': origem.valor,
    'inicio_vigencia': inicioVigencia == null ? null : dataIso(inicioVigencia!),
    'fim_vigencia': fimVigencia == null ? null : dataIso(fimVigencia!),
    'situacao': situacao.valor,
    'observacoes_internas': observacoesInternas,
    'finalizado_em': finalizadoEm == null ? null : dataIso(finalizadoEm!),
  };

  /// RN02: a vigência é sempre calculada, nunca editada.
  Vigencia vigencia(DateTime hoje) {
    switch (situacao) {
      case Situacao.emTramitacao:
        return Vigencia.emTramitacao;
      case Situacao.cancelado:
        return Vigencia.cancelado;
      case Situacao.finalizado:
        final dia = soData(hoje);
        final ini = inicioVigencia;
        final fim = fimVigencia;
        if (ini != null && dia.isBefore(ini)) return Vigencia.aIniciar;
        if (fim != null && dia.isAfter(fim)) return Vigencia.vencido;
        return Vigencia.vigente;
    }
  }

  /// Transição para finalizado registra a data; sair de finalizado a apaga.
  /// Convênio já finalizado (ex.: importado sem data, D19) não ganha "hoje".
  Convenio comSituacao(Situacao nova, DateTime hoje) {
    if (nova == Situacao.finalizado) {
      final jaFinalizado = situacao == Situacao.finalizado;
      return copyWith(
        situacao: nova,
        finalizadoEm: jaFinalizado ? finalizadoEm : soData(hoje),
      );
    }
    return copyWith(situacao: nova, limparFinalizadoEm: true);
  }

  /// Regras do banco (fim depois do início, finalizado completo) e RN07.
  Map<String, String> validar() {
    final erros = <String, String>{};
    final ini = inicioVigencia;
    final fim = fimVigencia;
    if (ini != null && fim != null) {
      if (!fim.isAfter(ini)) {
        erros['fim_vigencia'] = 'O fim da vigência deve ser depois do início.';
      } else if (!fim.isBefore(somarAnos(ini, vigenciaMaximaAnos))) {
        erros['fim_vigencia'] =
            'A vigência máxima é de $vigenciaMaximaAnos anos.';
      }
    }
    if (situacao == Situacao.finalizado) {
      if (numero.trim().isEmpty) {
        erros['numero'] = 'Finalizado exige número e datas de vigência.';
      }
      if (ini == null) {
        erros['inicio_vigencia'] =
            'Finalizado exige número e datas de vigência.';
      }
      if (fim == null) {
        erros['fim_vigencia'] ??=
            'Finalizado exige número e datas de vigência.';
      }
    }
    return erros;
  }
}

class Etapa {
  const Etapa({required this.tipo, required this.data, this.observacao = ''});

  factory Etapa.fromMap(Map<String, dynamic> m) => Etapa(
    tipo: TipoEtapa.de(m['etapa'] as String?),
    data: lerData(m['data']) ?? DateTime.now(),
    observacao: m['observacao'] as String? ?? '',
  );

  final TipoEtapa tipo;
  final DateTime data;
  final String observacao;

  Map<String, dynamic> toMap() => {
    'etapa': tipo.valor,
    'data': dataIso(data),
    'observacao': observacao,
  };
}

/// RF08: quem, quando e quais campos (D17, opção a: sem o valor anterior).
class RegistroHistorico {
  const RegistroHistorico({
    required this.por,
    required this.em,
    required this.acao,
    this.campos = const [],
  });

  final String por;
  final DateTime em;
  final String acao;
  final List<String> campos;
}

/// Campos que mudaram entre dois convênios (para o histórico).
List<String> camposAlterados(Convenio antes, Convenio depois) {
  final a = antes.toMap();
  final d = depois.toMap();
  return [
    for (final k in d.keys)
      if (k != 'concedente_nome' && a[k] != d[k]) k,
  ];
}
