import 'package:flutter/material.dart';

import '../dados/repositorio.dart';
import '../dominio/documentos.dart';
import '../dominio/modelos.dart';
import 'comum.dart';

class ConcedentesPage extends StatefulWidget {
  const ConcedentesPage({required this.repo, super.key});

  final Repositorio repo;

  @override
  State<ConcedentesPage> createState() => _ConcedentesPageState();
}

class _ConcedentesPageState extends State<ConcedentesPage> {
  String _busca = '';

  @override
  Widget build(BuildContext context) => Scaffold(
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ConcedenteForm(repo: widget.repo),
        ),
      ),
      icon: const Icon(Icons.add),
      label: const Text('Nova concedente'),
    ),
    body: Centralizado(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Buscar por nome, CPF ou CNPJ',
                border: OutlineInputBorder(),
              ),
              onChanged: (v) => setState(() => _busca = v),
            ),
          ),
          Expanded(
            child: StreamBuilder<List<Concedente>>(
              stream: widget.repo.concedentes(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return const Center(
                    child: Text('Não foi possível carregar.'),
                  );
                }
                final todas = snap.data;
                if (todas == null) {
                  return const Center(child: CircularProgressIndicator());
                }
                final termo = _busca.trim().toLowerCase();
                final doc = normalizar(_busca).toLowerCase();
                final lista = todas.where((c) {
                  if (termo.isEmpty) return true;
                  return c.razaoSocial.toLowerCase().contains(termo) ||
                      c.nomeFantasia.toLowerCase().contains(termo) ||
                      (doc.isNotEmpty &&
                          (c.documento ?? '').toLowerCase().contains(doc));
                }).toList();
                if (lista.isEmpty) {
                  return const Center(child: Text('Nenhuma concedente.'));
                }
                return ListView.separated(
                  padding: const EdgeInsets.only(bottom: 88),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final c = lista[i];
                    return ListTile(
                      title: Text(c.nome),
                      subtitle: Text(
                        '${c.documentoFormatado.isEmpty ? 'sem documento' : c.documentoFormatado}'
                        ' · ${c.tipo.rotulo} · ${c.cidade}/${c.uf}',
                      ),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ConcedenteForm(repo: widget.repo, concedente: c),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    ),
  );
}

class ConcedenteForm extends StatefulWidget {
  const ConcedenteForm({required this.repo, this.concedente, super.key});

  final Repositorio repo;
  final Concedente? concedente;

  @override
  State<ConcedenteForm> createState() => _ConcedenteFormState();
}

class _ConcedenteFormState extends State<ConcedenteForm> {
  late final _documento = TextEditingController(
    text: widget.concedente?.documentoFormatado ?? '',
  );
  late final _razao = TextEditingController(
    text: widget.concedente?.razaoSocial ?? '',
  );
  late final _fantasia = TextEditingController(
    text: widget.concedente?.nomeFantasia ?? '',
  );
  late final _cidade = TextEditingController(
    text: widget.concedente?.cidade ?? '',
  );
  late final _ramo = TextEditingController(
    text: widget.concedente?.ramoAtividade ?? '',
  );
  late final _email = TextEditingController(
    text: widget.concedente?.email ?? '',
  );
  late TipoConcedente _tipo =
      widget.concedente?.tipo ?? TipoConcedente.empresaPrivada;
  late String _uf = widget.concedente?.uf ?? 'RJ';
  Map<String, String> _erros = {};
  bool _salvando = false;

  @override
  void dispose() {
    for (final c in [_documento, _razao, _fantasia, _cidade, _ramo, _email]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _salvar() async {
    final c = Concedente(
      id: widget.concedente?.id,
      documento: normalizar(_documento.text),
      razaoSocial: _razao.text.trim(),
      nomeFantasia: _fantasia.text.trim(),
      tipo: _tipo,
      uf: _uf,
      cidade: _cidade.text.trim(),
      ramoAtividade: _ramo.text.trim(),
      email: _email.text.trim(),
    );
    final erros = c.validar();
    if (erros.isNotEmpty) {
      setState(() => _erros = erros);
      return;
    }
    setState(() {
      _salvando = true;
      _erros = {};
    });
    try {
      await widget.repo.salvarConcedente(c);
      if (!mounted) return;
      Navigator.of(context).pop();
      avisar(context, 'Concedente salva.');
    } on ErroNegocio catch (e) {
      if (mounted) setState(() => _erros = e.campos);
    } on Exception {
      if (mounted) avisar(context, 'Não foi possível salvar. Tente de novo.');
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.concedente == null ? 'Nova concedente' : 'Editar concedente',
      ),
    ),
    body: Centralizado(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _documento,
            decoration: InputDecoration(
              labelText: 'CPF ou CNPJ',
              helperText: 'Com ou sem pontuação. Profissional liberal usa CPF.',
              errorText: _erros['documento'],
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _razao,
            decoration: InputDecoration(
              labelText: 'Razão social / nome',
              errorText: _erros['razao_social'],
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _fantasia,
            decoration: const InputDecoration(labelText: 'Nome fantasia'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<TipoConcedente>(
            initialValue: _tipo,
            decoration: const InputDecoration(labelText: 'Tipo'),
            isExpanded: true,
            items: [
              for (final t in TipoConcedente.values)
                DropdownMenuItem(value: t, child: Text(t.rotulo)),
            ],
            onChanged: (v) => setState(() => _tipo = v ?? _tipo),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              SizedBox(
                width: 110,
                child: DropdownButtonFormField<String>(
                  initialValue: _uf,
                  decoration: InputDecoration(
                    labelText: 'UF',
                    errorText: _erros['uf'],
                  ),
                  items: [
                    for (final u in ufs)
                      DropdownMenuItem(value: u, child: Text(u)),
                  ],
                  onChanged: (v) => setState(() => _uf = v ?? _uf),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _cidade,
                  decoration: InputDecoration(
                    labelText: 'Cidade',
                    errorText: _erros['cidade'],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _ramo,
            decoration: const InputDecoration(labelText: 'Ramo de atividade'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-mail'),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _salvando ? null : _salvar,
            child: const Text('Salvar'),
          ),
        ],
      ),
    ),
  );
}
