import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../dominio/modelos.dart';
import 'repositorio.dart';

class FirestoreRepositorio implements Repositorio {
  FirestoreRepositorio(this._db, this._auth);

  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _concedentes =>
      _db.collection('concedentes');
  CollectionReference<Map<String, dynamic>> get _convenios =>
      _db.collection('convenios');

  @override
  Stream<List<Concedente>> concedentes() => _concedentes
      .orderBy('razao_social')
      .snapshots()
      .map((s) => [for (final d in s.docs) Concedente.fromMap(d.id, d.data())]);

  @override
  Stream<List<Convenio>> convenios() => _convenios.snapshots().map(
    (s) => [for (final d in s.docs) Convenio.fromMap(d.id, d.data())],
  );

  @override
  Stream<Convenio?> convenio(String id) => _convenios
      .doc(id)
      .snapshots()
      .map((d) => d.exists ? Convenio.fromMap(d.id, d.data()!) : null);

  @override
  Stream<List<Etapa>> etapas(String convenioId) => _convenios
      .doc(convenioId)
      .collection('etapas')
      .orderBy('data')
      .snapshots()
      .map((s) => [for (final d in s.docs) Etapa.fromMap(d.data())]);

  @override
  Stream<List<RegistroHistorico>> historico(String convenioId) => _convenios
      .doc(convenioId)
      .collection('historico')
      .orderBy('em', descending: true)
      .snapshots()
      .map(
        (s) => [
          for (final d in s.docs)
            RegistroHistorico(
              por: d['por_nome'] as String? ?? d['por'] as String? ?? '',
              // Timestamp do servidor ainda é nulo no eco local da própria escrita.
              em: (d['em'] as Timestamp?)?.toDate() ?? DateTime.now(),
              acao: d['acao'] as String? ?? '',
              campos: List<String>.from(d['campos'] as List? ?? const []),
            ),
        ],
      );

  @override
  Future<String> salvarConcedente(Concedente concedente) async {
    final erros = concedente.validar();
    if (erros.isNotEmpty) throw ErroNegocio(erros);

    // ponytail: checagem fora de transação; corrida entre duas pessoas é improvável
    // com a Divisão de Estágio. Garantia total: documento como id (ver ARCHITECTURE §3).
    final igual = await _concedentes
        .where('documento', isEqualTo: concedente.documento)
        .limit(1)
        .get();
    if (igual.docs.any((d) => d.id != concedente.id)) {
      throw const ErroNegocio({
        'documento': 'Já existe concedente com este CPF/CNPJ.',
      });
    }

    final ref = concedente.id == null
        ? _concedentes.doc()
        : _concedentes.doc(concedente.id);
    final batch = _db.batch()..set(ref, concedente.toMap());
    if (concedente.id != null) {
      // Cópia do nome nos convênios (a Function de sincronia entra depois).
      final afetados = await _convenios
          .where('concedente_id', isEqualTo: concedente.id)
          .get();
      for (final d in afetados.docs) {
        batch.update(d.reference, {'concedente_nome': concedente.nome});
      }
    }
    await batch.commit();
    return ref.id;
  }

  @override
  Future<String> salvarConvenio(Convenio convenio, {Convenio? anterior}) async {
    final erros = convenio.validar();
    if (erros.isNotEmpty) throw ErroNegocio(erros);

    if (convenio.numero.isNotEmpty) {
      final igual = await _convenios
          .where('numero', isEqualTo: convenio.numero)
          .limit(1)
          .get();
      if (igual.docs.any((d) => d.id != convenio.id)) {
        throw const ErroNegocio({
          'numero': 'Já existe convênio com este número.',
        });
      }
    }

    final ref = convenio.id == null
        ? _convenios.doc()
        : _convenios.doc(convenio.id);
    final campos = anterior == null
        ? <String>[]
        : camposAlterados(anterior, convenio);
    if (anterior != null && campos.isEmpty) return ref.id;

    await (_db.batch()
          ..set(ref, convenio.toMap())
          ..set(ref.collection('historico').doc(), {
            'por': _auth.currentUser!.uid,
            'por_nome': _auth.currentUser!.email,
            'em': FieldValue.serverTimestamp(),
            'acao': anterior == null ? 'criado' : 'alterado',
            'campos': campos,
          }))
        .commit();
    return ref.id;
  }

  @override
  Future<void> adicionarEtapa(String convenioId, Etapa etapa) async {
    final ref = _convenios.doc(convenioId);
    await (_db.batch()
          ..set(ref.collection('etapas').doc(), etapa.toMap())
          ..set(ref.collection('historico').doc(), {
            'por': _auth.currentUser!.uid,
            'por_nome': _auth.currentUser!.email,
            'em': FieldValue.serverTimestamp(),
            'acao': 'etapa',
            'campos': [etapa.tipo.valor],
          }))
        .commit();
  }
}
