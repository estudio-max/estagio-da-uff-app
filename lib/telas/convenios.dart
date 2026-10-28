import 'package:flutter/material.dart';

import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';
import 'convenio_detalhe.dart';
import 'convenio_form.dart';

class ConveniosPage extends StatefulWidget {
  const ConveniosPage({
    required this.repo,
    DateTime Function()? agora,
    super.key,
  }) : agora = agora ?? DateTime.now;

  final Repositorio repo;
  final DateTime Function() agora;

  @override
  State<ConveniosPage> createState() => _ConveniosPageState();
}

class _ConveniosPageState extends State<ConveniosPage> {
  String _busca = '';
  Vigencia? _filtro;

  @override
  Widget build(BuildContext context) => Scaffold(
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ConvenioForm(repo: widget.repo),
        ),
      ),
      icon: const Icon(Icons.add),
      label: const Text('Novo convênio'),
    ),
    body: Centralizado(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Buscar por concedente, número ou processo SEI',
                border: OutlineInputBorder(),
              ),
              onChanged: (v) => setState(() => _busca = v),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: const Text('Todos'),
                    selected: _filtro == null,
                    onSelected: (_) => setState(() => _filtro = null),
                  ),
                ),
                for (final v in Vigencia.values)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(v.rotulo),
                      selected: _filtro == v,
                      onSelected: (_) => setState(() => _filtro = v),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: StreamBuilder<List<Convenio>>(
              stream: widget.repo.convenios(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return const Center(
                    child: Text('Não foi possível carregar.'),
                  );
                }
                final todos = snap.data;
                if (todos == null) {
                  return const Center(child: CircularProgressIndicator());
                }
                final hoje = widget.agora();
                final termo = _busca.trim().toLowerCase();
                final lista =
                    todos.where((c) {
                      if (_filtro != null && c.vigencia(hoje) != _filtro) {
                        return false;
                      }
                      return termo.isEmpty ||
                          c.concedenteNome.toLowerCase().contains(termo) ||
                          c.numero.toLowerCase().contains(termo) ||
                          c.processoSei.toLowerCase().contains(termo);
                    }).toList()..sort(
                      (a, b) => (b.inicioVigencia ?? DateTime(1900)).compareTo(
                        a.inicioVigencia ?? DateTime(1900),
                      ),
                    );
                if (lista.isEmpty) {
                  return const Center(child: Text('Nenhum convênio.'));
                }
                return ListView.separated(
                  padding: const EdgeInsets.only(bottom: 88),
                  itemCount: lista.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final c = lista[i];
                    final fim = c.fimVigencia;
                    return ListTile(
                      title: Text(c.concedenteNome),
                      subtitle: Text(
                        '${c.numero.isEmpty ? 'sem número' : c.numero}'
                        '${fim == null ? '' : ' · até ${dataBr(fim)}'}',
                      ),
                      trailing: SeloVigencia(c.vigencia(hoje)),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ConvenioDetalhe(
                            repo: widget.repo,
                            id: c.id!,
                            agora: widget.agora,
                          ),
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
