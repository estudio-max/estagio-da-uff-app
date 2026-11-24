import 'package:material_ui/material_ui.dart';

import '../dados/painel.dart';
import '../dados/repositorio.dart';
import 'comum.dart';
import 'concedentes.dart';
import 'convenios.dart';
import 'painel.dart';
import 'tema.dart';

/// Uma seção do app: cada uma tem o próprio navegador, para o menu ficar visível
/// enquanto se abre um convênio ou uma concedente.
class _Aba {
  const _Aba(this.rotulo, this.icone, this.iconeSelecionado, this.tela);

  final String rotulo;
  final IconData icone;
  final IconData iconeSelecionado;
  final WidgetBuilder tela;
}

class Home extends StatefulWidget {
  const Home({
    required this.repo,
    required this.onSair,
    this.telasImportacao = const {},
    this.painel,
    this.usuario,
    super.key,
  });

  final Repositorio repo;
  final VoidCallback onSair;

  /// RF07: telas de importação, pelo rótulo do menu; sem elas, o item não aparece.
  final Map<String, WidgetBuilder> telasImportacao;

  /// RF06: indicadores; sem a fonte, a seção do painel não aparece.
  final FontePainel? painel;

  /// Nome (ou e-mail) de quem entrou, no pé do menu.
  final String? usuario;

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  int _aba = 0;

  /// Só monta a seção depois de aberta (o painel chama a Function ao montar).
  final _abertas = <int>{0};
  late final List<_Aba> _abas = [
    _Aba(
      'Convênios',
      Icons.description_outlined,
      Icons.description,
      (_) => ConveniosPage(repo: widget.repo),
    ),
    _Aba(
      'Concedentes',
      Icons.business_outlined,
      Icons.business,
      (_) => ConcedentesPage(repo: widget.repo),
    ),
    if (widget.painel case final fonte?)
      _Aba(
        'Painel',
        Icons.insights_outlined,
        Icons.insights,
        (_) => PainelPage(fonte: fonte, repo: widget.repo),
      ),
  ];
  late final _navegadores = [
    for (final _ in _abas) GlobalKey<NavigatorState>(),
  ];

  void _ir(int i) {
    if (i == _aba) {
      // Tocar na seção aberta volta ao começo dela.
      _navegadores[i].currentState?.popUntil((r) => r.isFirst);
      return;
    }
    setState(() {
      _aba = i;
      _abertas.add(i);
    });
  }

  void _importar(WidgetBuilder tela) => _navegadores[_aba].currentState?.push(
    MaterialPageRoute<void>(builder: tela),
  );

  Widget _conteudo() => IndexedStack(
    index: _aba,
    children: [
      for (var i = 0; i < _abas.length; i++)
        if (_abertas.contains(i))
          NavigatorPopHandler<Object?>(
            enabled: i == _aba,
            onPopWithResult: (_) => _navegadores[i].currentState?.maybePop(),
            child: Navigator(
              key: _navegadores[i],
              onGenerateRoute: (_) =>
                  MaterialPageRoute<void>(builder: _abas[i].tela),
            ),
          )
        else
          const SizedBox.shrink(),
    ],
  );

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      if (c.maxWidth >= larguraLarga) {
        return Scaffold(
          body: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _MenuLateral(
                abas: _abas,
                selecionada: _aba,
                aoEscolher: _ir,
                importacoes: widget.telasImportacao,
                aoImportar: _importar,
                usuario: widget.usuario,
                onSair: widget.onSair,
              ),
              Expanded(child: _conteudo()),
            ],
          ),
        );
      }
      return Scaffold(
        appBar: AppBar(
          backgroundColor: Cores.marinho,
          foregroundColor: Colors.white,
          titleSpacing: 12,
          title: const Row(
            children: [
              MarcaEstagios(compacta: true),
              SizedBox(width: 10),
              Flexible(
                child: Text(
                  'Estágios UFF',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: fonteTitulos,
                    fontWeight: FontWeight.w700,
                    fontSize: 20,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            if (widget.telasImportacao.isNotEmpty)
              PopupMenuButton<WidgetBuilder>(
                tooltip: 'Importar convênios',
                icon: const Icon(Icons.upload_file),
                onSelected: _importar,
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
        body: _conteudo(),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _aba,
          onDestinationSelected: _ir,
          destinations: [
            for (final a in _abas)
              NavigationDestination(
                icon: Icon(a.icone),
                selectedIcon: Icon(a.iconeSelecionado),
                label: a.rotulo,
              ),
          ],
        ),
      );
    },
  );
}

class _MenuLateral extends StatelessWidget {
  const _MenuLateral({
    required this.abas,
    required this.selecionada,
    required this.aoEscolher,
    required this.importacoes,
    required this.aoImportar,
    required this.onSair,
    this.usuario,
  });

  final List<_Aba> abas;
  final int selecionada;
  final ValueChanged<int> aoEscolher;
  final Map<String, WidgetBuilder> importacoes;
  final ValueChanged<WidgetBuilder> aoImportar;
  final String? usuario;
  final VoidCallback onSair;

  String get _iniciais {
    final partes = (usuario ?? '')
        .split('@')
        .first
        .split(RegExp(r'[\s._-]+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (partes.isEmpty) return '?';
    final letras = partes.length == 1
        ? partes.first.substring(0, 1)
        : '${partes.first[0]}${partes.last[0]}';
    return letras.toUpperCase();
  }

  @override
  Widget build(BuildContext context) => Material(
    color: Cores.marinho,
    child: SizedBox(
      width: 248,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: MarcaEstagios(),
              ),
              const SizedBox(height: 32),
              Expanded(
                child: ListView(
                  children: [
                    for (var i = 0; i < abas.length; i++)
                      _ItemMenu(
                        rotulo: abas[i].rotulo,
                        icone: i == selecionada
                            ? abas[i].iconeSelecionado
                            : abas[i].icone,
                        selecionado: i == selecionada,
                        aoTocar: () => aoEscolher(i),
                      ),
                    if (importacoes.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.fromLTRB(12, 24, 12, 8),
                        child: Text(
                          'IMPORTAR CONVÊNIOS',
                          style: TextStyle(
                            fontSize: 12,
                            letterSpacing: 0.6,
                            fontWeight: FontWeight.w600,
                            color: Cores.menuTextoFraco,
                          ),
                        ),
                      ),
                      for (final MapEntry(:key, :value) in importacoes.entries)
                        _ItemMenu(
                          rotulo: key,
                          icone: Icons.upload_file_outlined,
                          selecionado: false,
                          aoTocar: () => aoImportar(value),
                        ),
                    ],
                  ],
                ),
              ),
              const Divider(color: Cores.marinhoClaro, height: 1),
              const SizedBox(height: 12),
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: Cores.marinhoClaro,
                    child: Text(
                      _iniciais,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          usuario ?? 'Divisão de Estágio',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w500,
                            fontSize: 14,
                          ),
                        ),
                        if (usuario != null)
                          const Text(
                            'Divisão de Estágio',
                            style: TextStyle(
                              color: Cores.menuTextoFraco,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Sair',
                    color: Cores.menuTexto,
                    icon: const Icon(Icons.logout),
                    onPressed: onSair,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _ItemMenu extends StatelessWidget {
  const _ItemMenu({
    required this.rotulo,
    required this.icone,
    required this.selecionado,
    required this.aoTocar,
  });

  final String rotulo;
  final IconData icone;
  final bool selecionado;
  final VoidCallback aoTocar;

  @override
  Widget build(BuildContext context) {
    final cor = selecionado ? Colors.white : Cores.menuTexto;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Semantics(
        selected: selecionado,
        button: true,
        child: Material(
          color: selecionado ? Cores.azul : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: aoTocar,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    Icon(icone, size: 20, color: cor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        rotulo,
                        style: TextStyle(
                          color: cor,
                          fontSize: 15,
                          fontWeight: selecionado
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
