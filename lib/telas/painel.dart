import 'package:material_ui/material_ui.dart';

import '../dados/painel.dart';
import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';
import 'convenio_detalhe.dart';

/// Chave da vigência na resposta da Function (RN02), na ordem do Django.
const _vigencias = {
  'em_tramitacao': Vigencia.emTramitacao,
  'cancelado': Vigencia.cancelado,
  'a_iniciar': Vigencia.aIniciar,
  'vigente': Vigencia.vigente,
  'vencido': Vigencia.vencido,
};

String _dias(double d) => '${d.round()} ${d.round() == 1 ? 'dia' : 'dias'}';

/// RF06 e MS05: painel de convênios da Divisão. Premissa da D4: só a Divisão vê.
class PainelPage extends StatefulWidget {
  const PainelPage({
    required this.fonte,
    required this.repo,
    this.agora = DateTime.now,
    super.key,
  });

  final FontePainel fonte;

  /// Para abrir o convênio parado na tela de detalhe.
  final Repositorio repo;
  final DateTime Function() agora;

  @override
  State<PainelPage> createState() => _PainelPageState();
}

class _PainelPageState extends State<PainelPage> {
  late Future<Indicadores> _dados = widget.fonte.carregar();

  void _atualizar() => setState(() {
    _dados = widget.fonte.carregar();
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Painel de convênios'),
      actions: [
        IconButton(
          tooltip: 'Atualizar',
          icon: const Icon(Icons.refresh),
          onPressed: _atualizar,
        ),
      ],
    ),
    body: FutureBuilder<Indicadores>(
      future: _dados,
      builder: (context, snap) {
        if (snap.hasError) {
          final erro = snap.error;
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    erro is ErroPainel
                        ? erro.mensagem
                        : 'Não foi possível carregar o painel.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _atualizar,
                    child: const Text('Tentar de novo'),
                  ),
                ],
              ),
            ),
          );
        }
        if (snap.connectionState != ConnectionState.done || !snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        return _Conteudo(
          dados: snap.data!,
          abrirConvenio: (id) => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ConvenioDetalhe(
                repo: widget.repo,
                id: id,
                agora: widget.agora,
              ),
            ),
          ),
        );
      },
    ),
  );
}

class _Conteudo extends StatelessWidget {
  const _Conteudo({required this.dados, required this.abrirConvenio});

  final Indicadores dados;
  final void Function(String id) abrirConvenio;

  @override
  Widget build(BuildContext context) {
    final d = dados;
    final media = d.tramitacaoMedia;
    final mediana = d.tramitacaoMediana;
    final secoes = [
      _Secao(
        titulo: 'Convênios por situação',
        children: [
          for (final MapEntry(:key, :value) in _vigencias.entries)
            _Barra(
              rotulo: value.rotulo,
              valor: d.porVigencia[key] ?? 0,
              total: d.porVigencia.values.fold(0, (a, b) => a + b),
              cor: corVigencia(value),
            ),
        ],
      ),
      _Secao(
        titulo: 'Vigentes que vencem',
        children: [
          for (final MapEntry(:key, :value) in d.vencendo.entries)
            _Linha('nos próximos $key dias', '$value'),
        ],
      ),
      _Secao(
        titulo: 'Tempo de tramitação',
        nota:
            'Da primeira etapa registrada (ou do cadastro) até a '
            'finalização, nos últimos ${d.periodoTramitacaoDias} dias.',
        children: [
          if (media == null || mediana == null)
            const Text('Nenhum convênio finalizado no período.')
          else ...[
            _Linha('Média', _dias(media)),
            _Linha('Mediana', _dias(mediana)),
            _Linha('Convênios considerados', '${d.tramitacaoAmostra}'),
          ],
        ],
      ),
      _Secao(
        titulo: 'Vigentes por tipo de concedente',
        children: [
          for (final t in TipoConcedente.values)
            _Barra(
              rotulo: t.rotulo,
              valor: d.porTipo[t.valor] ?? 0,
              total: d.porVigencia['vigente'] ?? 0,
              cor: Theme.of(context).colorScheme.primary,
            ),
        ],
      ),
    ];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: [for (final s in secoes) SizedBox(width: 360, child: s)],
        ),
        const SizedBox(height: 16),
        _Secao(
          titulo: 'Em tramitação há mais tempo',
          children: [
            if (d.parados.isEmpty)
              const Text('Nenhum convênio em tramitação.')
            else
              for (final p in d.parados)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(p.concedente),
                  subtitle: Text(p.numero.isEmpty ? 'sem número' : p.numero),
                  trailing: Text(
                    _dias(p.dias.toDouble()),
                    style: const TextStyle(
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                  onTap: () => abrirConvenio(p.id),
                ),
          ],
        ),
      ],
    );
  }
}

class _Secao extends StatelessWidget {
  const _Secao({required this.titulo, required this.children, this.nota});

  final String titulo;
  final List<Widget> children;
  final String? nota;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...children,
          if (nota case final n?) ...[
            const SizedBox(height: 8),
            Text(n, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    ),
  );
}

class _Linha extends StatelessWidget {
  const _Linha(this.rotulo, this.valor);

  final String rotulo;
  final String valor;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(child: Text(rotulo)),
        Text(
          valor,
          style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()]),
        ),
      ],
    ),
  );
}

/// Rótulo, número e uma barra proporcional ao total (o gráfico do painel).
class _Barra extends StatelessWidget {
  const _Barra({
    required this.rotulo,
    required this.valor,
    required this.total,
    required this.cor,
  });

  final String rotulo;
  final int valor;
  final int total;
  final Color cor;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Linha(rotulo, '$valor'),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : valor / total,
            minHeight: 6,
            color: cor,
            backgroundColor: cor.withValues(alpha: 0.12),
          ),
        ),
      ],
    ),
  );
}
