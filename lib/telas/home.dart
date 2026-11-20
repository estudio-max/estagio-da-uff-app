import 'package:material_ui/material_ui.dart';

import '../dados/repositorio.dart';
import 'concedentes.dart';
import 'convenios.dart';

class Home extends StatefulWidget {
  const Home({
    required this.repo,
    required this.onSair,
    this.telasImportacao = const {},
    super.key,
  });

  final Repositorio repo;
  final VoidCallback onSair;

  /// RF07: telas de importação, pelo rótulo do menu; sem elas, o botão não aparece.
  final Map<String, WidgetBuilder> telasImportacao;

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  int _aba = 0;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Estágios UFF · Divisão de Estágio'),
      actions: [
        if (widget.telasImportacao.isNotEmpty)
          PopupMenuButton<WidgetBuilder>(
            tooltip: 'Importar convênios',
            icon: const Icon(Icons.upload_file),
            onSelected: (tela) =>
                Navigator.of(context)
                    .push(MaterialPageRoute<void>(builder: tela)),
            itemBuilder: (_) => [
              for (final MapEntry(:key, :value)
                  in widget.telasImportacao.entries)
                PopupMenuItem(value: value, child: Text(key)),
            ],
          ),
        IconButton(
          tooltip: 'Sair',
          icon: const Icon(Icons.logout),
          onPressed: widget.onSair,
        ),
      ],
    ),
    body: IndexedStack(
      index: _aba,
      children: [
        ConveniosPage(repo: widget.repo),
        ConcedentesPage(repo: widget.repo),
      ],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: _aba,
      onDestinationSelected: (i) => setState(() => _aba = i),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.description_outlined),
          selectedIcon: Icon(Icons.description),
          label: 'Convênios',
        ),
        NavigationDestination(
          icon: Icon(Icons.business_outlined),
          selectedIcon: Icon(Icons.business),
          label: 'Concedentes',
        ),
      ],
    ),
  );
}
