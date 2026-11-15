import 'package:material_ui/material_ui.dart';

import '../dados/repositorio.dart';
import 'concedentes.dart';
import 'convenios.dart';

class Home extends StatefulWidget {
  const Home({
    required this.repo,
    required this.onSair,
    this.telaImportacao,
    super.key,
  });

  final Repositorio repo;
  final VoidCallback onSair;

  /// RF07: tela de importação do Drupal; sem ela, o botão não aparece.
  final WidgetBuilder? telaImportacao;

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
        if (widget.telaImportacao case final tela?)
          IconButton(
            tooltip: 'Importar do estagio.uff.br',
            icon: const Icon(Icons.upload_file),
            onPressed: () =>
                Navigator.of(context)
                    .push(MaterialPageRoute<void>(builder: tela)),
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
