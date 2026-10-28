import 'dart:async';

import 'package:estagios_uff/dados/repositorio.dart';
import 'package:estagios_uff/dominio/modelos.dart';

/// Repositório em memória para os testes de tela (sem Firebase).
class RepositorioEmMemoria implements Repositorio {
  RepositorioEmMemoria({
    List<Concedente> concedentes = const [],
    List<Convenio> convenios = const [],
  }) : _concedentes = [...concedentes],
       _convenios = [...convenios];

  final List<Concedente> _concedentes;
  final List<Convenio> _convenios;
  final Map<String, List<Etapa>> _etapas = {};
  final Map<String, List<RegistroHistorico>> _historico = {};
  final _mudou = StreamController<void>.broadcast();
  var _seq = 0;

  Stream<T> _observa<T>(T Function() ler) async* {
    yield ler();
    await for (final _ in _mudou.stream) {
      yield ler();
    }
  }

  @override
  Stream<List<Concedente>> concedentes() => _observa(() => [..._concedentes]);

  @override
  Stream<List<Convenio>> convenios() => _observa(() => [..._convenios]);

  @override
  Stream<Convenio?> convenio(String id) =>
      _observa(() => _convenios.where((c) => c.id == id).firstOrNull);

  @override
  Stream<List<Etapa>> etapas(String id) => _observa(() => [...?_etapas[id]]);

  @override
  Stream<List<RegistroHistorico>> historico(String id) =>
      _observa(() => [...?_historico[id]]);

  @override
  Future<String> salvarConcedente(Concedente c) async {
    final erros = c.validar();
    if (erros.isNotEmpty) throw ErroNegocio(erros);
    if (_concedentes.any((o) => o.documento == c.documento && o.id != c.id)) {
      throw const ErroNegocio({
        'documento': 'Já existe concedente com este CPF/CNPJ.',
      });
    }
    final id = c.id ?? 'c${++_seq}';
    _concedentes
      ..removeWhere((o) => o.id == id)
      ..add(
        Concedente(
          id: id,
          documento: c.documento,
          razaoSocial: c.razaoSocial,
          nomeFantasia: c.nomeFantasia,
          tipo: c.tipo,
          uf: c.uf,
          cidade: c.cidade,
          ramoAtividade: c.ramoAtividade,
          email: c.email,
        ),
      );
    _mudou.add(null);
    return id;
  }

  @override
  Future<String> salvarConvenio(Convenio c, {Convenio? anterior}) async {
    final erros = c.validar();
    if (erros.isNotEmpty) throw ErroNegocio(erros);
    if (c.numero.isNotEmpty &&
        _convenios.any((o) => o.numero == c.numero && o.id != c.id)) {
      throw const ErroNegocio({
        'numero': 'Já existe convênio com este número.',
      });
    }
    final id = c.id ?? 'v${++_seq}';
    final campos = anterior == null ? <String>[] : camposAlterados(anterior, c);
    _convenios
      ..removeWhere((o) => o.id == id)
      ..add(c.copyWith(id: id));
    (_historico[id] ??= []).insert(
      0,
      RegistroHistorico(
        por: 'divisao@exemplo.test',
        em: DateTime.now(),
        acao: anterior == null ? 'criado' : 'alterado',
        campos: campos,
      ),
    );
    _mudou.add(null);
    return id;
  }

  @override
  Future<void> adicionarEtapa(String convenioId, Etapa etapa) async {
    (_etapas[convenioId] ??= []).add(etapa);
    _mudou.add(null);
  }
}
