import 'package:material_ui/material_ui.dart';

import '../dados/painel.dart';
import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';
import 'convenio_detalhe.dart';
import 'tema.dart';

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
          aoAtualizar: _atualizar,
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
  const _Conteudo({
    required this.dados,
    required this.abrirConvenio,
    required this.aoAtualizar,
  });

  final Indicadores dados;
  final void Function(String id) abrirConvenio;
  final VoidCallback aoAtualizar;

  @override
  Widget build(BuildContext context) {
    final d = dados;
    final media = d.tramitacaoMedia;
    final mediana = d.tramitacaoMediana;
    final total = d.porVigencia.values.fold(0, (a, b) => a + b);
    final vigentes = d.porVigencia['vigente'] ?? 0;
    final secoes = [
      Secao(
        titulo: 'Vigentes que vencem',
        nota: 'Acumulado: cada faixa inclui as anteriores.',
        children: [
          for (final MapEntry(:key, :value) in d.vencendo.entries)
            _Barra(
              rotulo: 'nos próximos $key dias',
              valor: value,
              total: vigentes,
              cor: key <= faixasVencimento.first ? Cores.alerta : Cores.azul,
            ),
        ],
      ),
      Secao(
        titulo: 'Vigentes por tipo de concedente',
        children: [
          for (final t in TipoConcedente.values)
            _Barra(
              rotulo: t.rotulo,
              valor: d.porTipo[t.valor] ?? 0,
              total: vigentes,
              cor: Cores.azul,
            ),
        ],
      ),
      Secao(
        titulo: 'Tempo de tramitação',
        nota:
            'Da primeira etapa registrada (ou do cadastro) até a '
            'finalização, nos últimos ${d.periodoTramitacaoDias} dias.',
        children: [
          if (media == null || mediana == null)
            const Text('Nenhum convênio finalizado no período.')
          else
            Wrap(
              spacing: 32,
              runSpacing: 16,
              children: [
                _Numero('Média', _dias(media)),
                _Numero('Mediana', _dias(mediana)),
                _Numero('Convênios considerados', '${d.tramitacaoAmostra}'),
              ],
            ),
        ],
      ),
      Secao(
        titulo: 'Em tramitação há mais tempo',
        children: [
          if (d.parados.isEmpty)
            const Text('Nenhum convênio em tramitação.')
          else
            for (final p in d.parados)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: fundoVigencia(Vigencia.emTramitacao),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => abrirConvenio(p.id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  p.concedente,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  p.numero.isEmpty ? 'sem número' : p.numero,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: Cores.textoFraco,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _dias(p.dias.toDouble()),
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: corVigencia(Vigencia.emTramitacao),
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
        ],
      ),
    ];
    return LayoutBuilder(
      builder: (context, r) {
        final margem = r.maxWidth >= larguraLarga ? 32.0 : 16.0;
        final largura = (r.maxWidth - 2 * margem).clamp(0, 1200).toDouble();
        final colunas = largura >= 760 ? 2 : 1;
        final larguraSecao = (largura - 24 * (colunas - 1)) / colunas;
        return ListView(
          padding: EdgeInsets.fromLTRB(margem, 28, margem, 48),
          children: [
            Centralizado(
              larguraMaxima: 1200,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CabecalhoPagina(
                    titulo: 'Painel de convênios',
                    subtitulo: d.hoje.isEmpty
                        ? null
                        : 'Situação em ${_dataDoPainel(d.hoje)} · $total convênios',
                    acoes: [
                      OutlinedButton.icon(
                        onPressed: aoAtualizar,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Atualizar'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Secao(
                    titulo: 'Convênios por situação',
                    children: [
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          for (final MapEntry(:key, :value)
                              in _vigencias.entries)
                            _ContagemVigencia(value, d.porVigencia[key] ?? 0),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Wrap(
                    spacing: 24,
                    runSpacing: 24,
                    children: [
                      for (final s in secoes)
                        SizedBox(width: larguraSecao, child: s),
                    ],
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// A Function manda a data em ISO (aaaa-mm-dd); mostra dd/mm/aaaa.
String _dataDoPainel(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : dataBr(d);
}

class _ContagemVigencia extends StatelessWidget {
  const _ContagemVigencia(this.vigencia, this.valor);

  final Vigencia vigencia;
  final int valor;

  @override
  Widget build(BuildContext context) => Container(
    width: 160,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      border: Border.all(color: Cores.borda),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: tomVigencia(vigencia),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                vigencia.rotulo,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, color: Cores.textoFraco),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '$valor',
          style: const TextStyle(
            fontFamily: fonteTitulos,
            fontWeight: FontWeight.w700,
            fontSize: 30,
            color: Cores.marinho,
          ),
        ),
      ],
    ),
  );
}

class _Numero extends StatelessWidget {
  const _Numero(this.rotulo, this.valor);

  final String rotulo;
  final String valor;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        rotulo,
        style: const TextStyle(fontSize: 13, color: Cores.textoFraco),
      ),
      Text(
        valor,
        style: const TextStyle(
          fontFamily: fonteTitulos,
          fontWeight: FontWeight.w700,
          fontSize: 26,
          color: Cores.marinho,
        ),
      ),
    ],
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
        Expanded(child: Text(rotulo, style: const TextStyle(fontSize: 14))),
        Text(
          valor,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
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
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Linha(rotulo, '$valor'),
        const SizedBox(height: 2),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : valor / total,
            minHeight: 8,
            color: cor,
            backgroundColor: Cores.trilho,
          ),
        ),
      ],
    ),
  );
}
