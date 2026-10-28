import 'package:flutter/material.dart';

import 'convenio.dart';

class ConveniosPage extends StatelessWidget {
  const ConveniosPage({
    required this.convenios,
    required this.onSair,
    super.key,
  });

  final Stream<List<Convenio>> convenios;
  final VoidCallback onSair;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Convênios'),
      actions: [
        IconButton(
          tooltip: 'Sair',
          icon: const Icon(Icons.logout),
          onPressed: onSair,
        ),
      ],
    ),
    body: StreamBuilder<List<Convenio>>(
      stream: convenios,
      builder: (context, snap) {
        if (snap.hasError) {
          return const Center(child: Text('Não foi possível carregar.'));
        }
        final lista = snap.data;
        if (lista == null) {
          return const Center(child: CircularProgressIndicator());
        }
        if (lista.isEmpty) {
          return const Center(child: Text('Nenhum convênio cadastrado.'));
        }
        return ListView(
          children: [
            for (final c in lista)
              ListTile(
                title: Text(c.concedente),
                subtitle: Text(c.status),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ConvenioPage(convenio: c),
                  ),
                ),
              ),
          ],
        );
      },
    ),
  );
}

class ConvenioPage extends StatelessWidget {
  const ConvenioPage({required this.convenio, super.key});

  final Convenio convenio;

  @override
  Widget build(BuildContext context) {
    final fim = convenio.vigenciaFim;
    return Scaffold(
      appBar: AppBar(title: Text(convenio.concedente)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Situação: ${convenio.status}'),
            Text(
              fim == null
                  ? 'Vigência: não informada'
                  : 'Vigência até: ${fim.day.toString().padLeft(2, '0')}/'
                        '${fim.month.toString().padLeft(2, '0')}/${fim.year}',
            ),
          ],
        ),
      ),
    );
  }
}
