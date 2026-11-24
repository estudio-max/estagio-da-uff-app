import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';
import 'convenio_detalhe.dart';
import 'convenio_form.dart';
import 'tema.dart';

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
  int? _venceEm;

  void _novo() => Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => ConvenioForm(repo: widget.repo)),
  );

  void _abrir(Convenio c) => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) =>
          ConvenioDetalhe(repo: widget.repo, id: c.id!, agora: widget.agora),
    ),
  );

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, restricoes) {
      final largo = restricoes.maxWidth >= larguraLarga;
      final margem = math.max(
        largo ? 32.0 : 16.0,
        (restricoes.maxWidth - 1200) / 2,
      );
      return Scaffold(
        floatingActionButton: largo
            ? null
            : FloatingActionButton.extended(
                // As seções ficam montadas: cada botão precisa de tag própria.
                heroTag: 'novo-convenio',
                onPressed: _novo,
                icon: const Icon(Icons.add),
                label: const Text('Novo convênio'),
              ),
        body: StreamBuilder<List<Convenio>>(
          stream: widget.repo.convenios(),
          builder: (context, snap) {
            if (snap.hasError) {
              return const Center(child: Text('Não foi possível carregar.'));
            }
            final todos = snap.data;
            if (todos == null) {
              return const Center(child: CircularProgressIndicator());
            }
            final hoje = widget.agora();
            final contagem = <Vigencia, int>{
              for (final v in Vigencia.values) v: 0,
            };
            for (final c in todos) {
              contagem.update(c.vigencia(hoje), (n) => n + 1);
            }
            final vencendo = todos
                .where((c) => c.venceEm(hoje, faixasVencimento.first))
                .length;
            final termo = _busca.trim().toLowerCase();
            final lista =
                todos.where((c) {
                  if (_filtro != null && c.vigencia(hoje) != _filtro) {
                    return false;
                  }
                  if (_venceEm != null && !c.venceEm(hoje, _venceEm!)) {
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

            Widget resumo(
              String rotulo,
              int valor,
              Color cor, {
              required bool selecionado,
              required VoidCallback aoTocar,
              bool alerta = false,
            }) => _CartaoResumo(
              rotulo: rotulo,
              valor: valor,
              cor: cor,
              selecionado: selecionado,
              alerta: alerta,
              aoTocar: aoTocar,
            );

            return CustomScrollView(
              slivers: [
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(margem, 28, margem, 0),
                  sliver: SliverList.list(
                    children: [
                      CabecalhoPagina(
                        titulo: 'Convênios',
                        subtitulo:
                            'Convênios de estágio da UFF com as concedentes.',
                        acoes: [
                          if (largo)
                            FilledButton.icon(
                              onPressed: _novo,
                              icon: const Icon(Icons.add),
                              label: const Text('Novo convênio'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      _Grade(
                        children: [
                          resumo(
                            'Vigentes',
                            contagem[Vigencia.vigente]!,
                            corVigencia(Vigencia.vigente),
                            selecionado:
                                _filtro == Vigencia.vigente && _venceEm == null,
                            aoTocar: () => setState(() {
                              _filtro = Vigencia.vigente;
                              _venceEm = null;
                            }),
                          ),
                          resumo(
                            'Vencem em ${faixasVencimento.first} dias',
                            vencendo,
                            Cores.alertaTexto,
                            alerta: vencendo > 0,
                            selecionado:
                                _venceEm == faixasVencimento.first &&
                                _filtro == null,
                            aoTocar: () => setState(() {
                              _filtro = null;
                              _venceEm = faixasVencimento.first;
                            }),
                          ),
                          resumo(
                            'Em tramitação',
                            contagem[Vigencia.emTramitacao]!,
                            corVigencia(Vigencia.emTramitacao),
                            selecionado: _filtro == Vigencia.emTramitacao,
                            aoTocar: () => setState(() {
                              _filtro = Vigencia.emTramitacao;
                              _venceEm = null;
                            }),
                          ),
                          resumo(
                            'Vencidos',
                            contagem[Vigencia.vencido]!,
                            corVigencia(Vigencia.vencido),
                            selecionado: _filtro == Vigencia.vencido,
                            aoTocar: () => setState(() {
                              _filtro = Vigencia.vencido;
                              _venceEm = null;
                            }),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      _Filtros(
                        total: todos.length,
                        contagem: contagem,
                        filtro: _filtro,
                        venceEm: _venceEm,
                        aoBuscar: (v) => setState(() => _busca = v),
                        aoFiltrar: (v) => setState(() => _filtro = v),
                        aoVencer: (d) => setState(() => _venceEm = d),
                      ),
                    ],
                  ),
                ),
                if (lista.isEmpty)
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: margem),
                    sliver: const SliverToBoxAdapter(
                      child: _Moldura(
                        ultimo: true,
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(child: Text('Nenhum convênio.')),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: margem),
                    sliver: SliverList.builder(
                      itemCount: lista.length,
                      itemBuilder: (context, i) => _Moldura(
                        ultimo: i == lista.length - 1,
                        child: _LinhaConvenio(
                          c: lista[i],
                          hoje: hoje,
                          largo: largo,
                          aoTocar: () => _abrir(lista[i]),
                        ),
                      ),
                    ),
                  ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(margem, 12, margem, 96),
                    child: Text(
                      lista.length == 1
                          ? '1 convênio'
                          : '${lista.length} convênios',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Cores.textoFraco,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      );
    },
  );
}

/// Bordas laterais (e a de baixo, no último) do cartão que abraça a lista.
class _Moldura extends StatelessWidget {
  const _Moldura({required this.child, required this.ultimo});

  final Widget child;
  final bool ultimo;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      border: const Border(
        left: BorderSide(color: Cores.borda),
        right: BorderSide(color: Cores.borda),
        bottom: BorderSide(color: Cores.borda),
      ),
      borderRadius: ultimo
          ? const BorderRadius.vertical(bottom: Radius.circular(16))
          : null,
    ),
    child: child,
  );
}

class _CartaoResumo extends StatelessWidget {
  const _CartaoResumo({
    required this.rotulo,
    required this.valor,
    required this.cor,
    required this.selecionado,
    required this.aoTocar,
    this.alerta = false,
  });

  final String rotulo;
  final int valor;
  final Color cor;
  final bool selecionado;
  final bool alerta;
  final VoidCallback aoTocar;

  @override
  Widget build(BuildContext context) {
    final borda = selecionado
        ? Cores.azul
        : alerta
        ? Cores.alerta
        : Cores.borda;
    return Semantics(
      button: true,
      selected: selecionado,
      child: Material(
        color: alerta ? Cores.alertaFundo : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: borda, width: selecionado || alerta ? 2 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: aoTocar,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    if (alerta) ...[
                      const Icon(
                        Icons.schedule,
                        size: 16,
                        color: Cores.alertaTexto,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Flexible(
                      child: Text(
                        rotulo,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: alerta
                              ? FontWeight.w600
                              : FontWeight.w500,
                          color: alerta ? Cores.alertaTexto : Cores.textoFraco,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '$valor',
                  style: TextStyle(
                    fontFamily: fonteTitulos,
                    fontWeight: FontWeight.w700,
                    fontSize: 34,
                    color: cor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Busca e filtros, no topo do cartão da lista.
class _Filtros extends StatelessWidget {
  const _Filtros({
    required this.total,
    required this.contagem,
    required this.filtro,
    required this.venceEm,
    required this.aoBuscar,
    required this.aoFiltrar,
    required this.aoVencer,
  });

  final int total;
  final Map<Vigencia, int> contagem;
  final Vigencia? filtro;
  final int? venceEm;
  final ValueChanged<String> aoBuscar;
  final ValueChanged<Vigencia?> aoFiltrar;
  final ValueChanged<int?> aoVencer;

  /// Do mais comum ao menos comum no dia a dia da Divisão.
  static const _ordemFiltros = [
    Vigencia.vigente,
    Vigencia.aIniciar,
    Vigencia.emTramitacao,
    Vigencia.vencido,
    Vigencia.cancelado,
  ];

  // O tema do chip não pinta o texto do selecionado no Material 3: vai aqui.
  static TextStyle _estiloChip(bool selecionado) => TextStyle(
    fontWeight: FontWeight.w500,
    fontSize: 14,
    color: selecionado ? Colors.white : Cores.texto,
  );

  static Widget _rotulo(String texto, int n) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [Text(texto), Text(' · $n')],
  );

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: Cores.borda),
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
    ),
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Buscar por concedente, número ou processo SEI',
          ),
          onChanged: aoBuscar,
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: _rotulo('Todos', total),
              selected: filtro == null,
              showCheckmark: false,
              labelStyle: _estiloChip(filtro == null),
              onSelected: (_) => aoFiltrar(null),
            ),
            for (final v in _ordemFiltros)
              ChoiceChip(
                label: _rotulo(v.rotulo, contagem[v] ?? 0),
                selected: filtro == v,
                showCheckmark: false,
                labelStyle: _estiloChip(filtro == v),
                onSelected: (_) => aoFiltrar(v),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            const Padding(
              padding: EdgeInsets.only(right: 4),
              child: Text(
                'Vence em:',
                style: TextStyle(fontSize: 14, color: Cores.textoFraco),
              ),
            ),
            for (final dias in faixasVencimento)
              FilterChip(
                label: Text('até $dias dias'),
                selected: venceEm == dias,
                labelStyle: _estiloChip(venceEm == dias),
                onSelected: (marcado) => aoVencer(marcado ? dias : null),
              ),
          ],
        ),
      ],
    ),
  );
}

class _LinhaConvenio extends StatelessWidget {
  const _LinhaConvenio({
    required this.c,
    required this.hoje,
    required this.largo,
    required this.aoTocar,
  });

  final Convenio c;
  final DateTime hoje;
  final bool largo;
  final VoidCallback aoTocar;

  @override
  Widget build(BuildContext context) {
    final vigencia = c.vigencia(hoje);
    final fim = c.fimVigencia;
    final prazo = prazoConvenio(c, hoje);
    final fracao = fracaoVigencia(c, hoje);
    final identificacao = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          c.concedenteNome,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: Cores.marinho,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          '${c.numero.isEmpty ? 'sem número' : c.numero}'
          '${fim == null ? '' : ' · até ${dataBr(fim)}'}',
          style: const TextStyle(fontSize: 14, color: Cores.texto),
        ),
        if (c.processoSei.isNotEmpty)
          Text(
            'SEI ${c.processoSei}',
            style: const TextStyle(
              fontSize: 13,
              color: Cores.textoFraco,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
      ],
    );
    final andamento = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (fracao != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: fracao,
              minHeight: 6,
              color: prazo?.urgente ?? false
                  ? Cores.alerta
                  : tomVigencia(vigencia),
              backgroundColor: Cores.trilho,
            ),
          ),
        if (prazo != null) ...[
          const SizedBox(height: 6),
          Text(
            prazo.texto,
            style: TextStyle(
              fontSize: 13,
              fontWeight: prazo.urgente ? FontWeight.w600 : FontWeight.w400,
              color: prazo.urgente ? Cores.alertaTexto : Cores.textoFraco,
            ),
          ),
        ] else if (vigencia == Vigencia.emTramitacao &&
            c.observacoesInternas.isNotEmpty) ...[
          Text(
            c.observacoesInternas,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13, color: Cores.textoFraco),
          ),
        ],
      ],
    );
    return InkWell(
      onTap: aoTocar,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Cores.trilho)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: largo
            ? Row(
                children: [
                  Expanded(flex: 5, child: identificacao),
                  const SizedBox(width: 24),
                  Expanded(flex: 3, child: andamento),
                  const SizedBox(width: 24),
                  SizedBox(
                    width: 120,
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: SeloVigencia(vigencia),
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: identificacao),
                      const SizedBox(width: 12),
                      SeloVigencia(vigencia),
                    ],
                  ),
                  if (fracao != null || prazo != null) ...[
                    const SizedBox(height: 10),
                    andamento,
                  ],
                ],
              ),
      ),
    );
  }
}

/// Grade que mede a largura e põe de 1 a 4 cartões por linha, de altura livre.
class _Grade extends StatelessWidget {
  const _Grade({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, r) {
      const espaco = 16.0;
      final colunas = ((r.maxWidth + espaco) / (200 + espaco)).floor().clamp(
        1,
        4,
      );
      final largura = (r.maxWidth - espaco * (colunas - 1)) / colunas;
      return Wrap(
        spacing: espaco,
        runSpacing: espaco,
        children: [
          for (final c in children) SizedBox(width: largura, child: c),
        ],
      );
    },
  );
}
