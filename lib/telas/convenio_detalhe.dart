import 'package:material_ui/material_ui.dart';

import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';
import 'convenio_form.dart';
import 'tema.dart';

class ConvenioDetalhe extends StatelessWidget {
  const ConvenioDetalhe({
    required this.repo,
    required this.id,
    required this.agora,
    super.key,
  });

  final Repositorio repo;
  final String id;
  final DateTime Function() agora;

  @override
  Widget build(BuildContext context) => StreamBuilder<Convenio?>(
    stream: repo.convenio(id),
    builder: (context, snap) {
      final c = snap.data;
      return Scaffold(
        appBar: AppBar(
          title: Text(c?.concedenteNome ?? 'Convênio'),
          actions: [
            if (c != null)
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: IconButton(
                  tooltip: 'Editar',
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ConvenioForm(repo: repo, convenio: c),
                    ),
                  ),
                ),
              ),
          ],
        ),
        body: c == null
            ? const Center(child: CircularProgressIndicator())
            : LayoutBuilder(
                builder: (context, restricoes) {
                  final hoje = agora();
                  final principal = [
                    _Etapas(repo: repo, convenioId: id),
                    const SizedBox(height: 24),
                    _Dados(c: c),
                  ];
                  final lateral = [
                    _Alertas(repo: repo, convenioId: id),
                    const SizedBox(height: 24),
                    _Historico(repo: repo, convenioId: id),
                  ];
                  return Centralizado(
                    larguraMaxima: 1140,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 48),
                      children: [
                        _Resumo(c: c, hoje: hoje),
                        if (c.inicioVigencia != null ||
                            c.fimVigencia != null) ...[
                          const SizedBox(height: 24),
                          _Vigencia(c: c, hoje: hoje),
                        ],
                        const SizedBox(height: 24),
                        if (restricoes.maxWidth >= larguraLarga)
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                flex: 3,
                                child: Column(children: principal),
                              ),
                              const SizedBox(width: 24),
                              Expanded(
                                flex: 2,
                                child: Column(children: lateral),
                              ),
                            ],
                          )
                        else ...[
                          ...principal,
                          const SizedBox(height: 24),
                          ...lateral,
                        ],
                      ],
                    ),
                  );
                },
              ),
      );
    },
  );
}

class _Linha extends StatelessWidget {
  const _Linha(this.rotulo, this.valor);

  final String rotulo;
  final String valor;

  @override
  Widget build(BuildContext context) => valor.isEmpty
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 150,
                child: Text(
                  rotulo,
                  style: const TextStyle(fontSize: 14, color: Cores.textoFraco),
                ),
              ),
              Expanded(child: Text(valor)),
            ],
          ),
        );
}

/// Concedente, vigência derivada (RN02), número e processo.
class _Resumo extends StatelessWidget {
  const _Resumo({required this.c, required this.hoje});

  final Convenio c;
  final DateTime hoje;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              c.numero.isEmpty ? 'Sem número' : c.numero,
              style: tema.headlineSmall,
            ),
            SeloVigencia(c.vigencia(hoje)),
          ],
        ),
        if (c.processoSei.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            'Processo SEI ${c.processoSei}',
            style: tema.bodyLarge?.copyWith(
              color: Cores.textoFraco,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ],
    );
  }
}

/// Linha do tempo da vigência: início, hoje e fim.
class _Vigencia extends StatelessWidget {
  const _Vigencia({required this.c, required this.hoje});

  final Convenio c;
  final DateTime hoje;

  @override
  Widget build(BuildContext context) {
    final ini = c.inicioVigencia;
    final fim = c.fimVigencia;
    final vigencia = c.vigencia(hoje);
    final fracao = fracaoVigencia(c, hoje);
    final prazo = prazoConvenio(c, hoje);
    final destaque = switch (vigencia) {
      Vigencia.vigente when fim != null =>
        prazo?.texto ?? 'Faltam ${tempoRestante(hoje, fim)}',
      _ => prazo?.texto,
    };
    Widget marco(String rotulo, String valor, CrossAxisAlignment alinhamento) =>
        Column(
          crossAxisAlignment: alinhamento,
          children: [
            Text(
              rotulo,
              style: const TextStyle(fontSize: 13, color: Cores.textoFraco),
            ),
            Text(
              valor,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ],
        );
    return Secao(
      titulo: 'Vigência',
      acao: destaque == null
          ? null
          : Text(
              destaque,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: prazo?.urgente ?? false
                    ? Cores.alertaTexto
                    : corVigencia(vigencia),
              ),
            ),
      children: [
        if (fracao != null) ...[
          LayoutBuilder(
            builder: (context, r) => SizedBox(
              height: 22,
              child: Stack(
                alignment: Alignment.centerLeft,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(5),
                    child: LinearProgressIndicator(
                      value: fracao,
                      minHeight: 10,
                      color: prazo?.urgente ?? false
                          ? Cores.alerta
                          : tomVigencia(vigencia),
                      backgroundColor: Cores.trilho,
                    ),
                  ),
                  if (fracao > 0 && fracao < 1)
                    Positioned(
                      left: r.maxWidth * fracao - 1,
                      top: 0,
                      bottom: 0,
                      child: Container(width: 2, color: Cores.marinho),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            marco(
              'Início',
              ini == null ? '—' : dataBr(ini),
              CrossAxisAlignment.start,
            ),
            if (fracao != null && fracao > 0 && fracao < 1)
              marco('Hoje', dataBr(hoje), CrossAxisAlignment.center),
            marco(
              'Fim',
              fim == null ? '—' : dataBr(fim),
              CrossAxisAlignment.end,
            ),
          ],
        ),
      ],
    );
  }
}

class _Dados extends StatelessWidget {
  const _Dados({required this.c});

  final Convenio c;

  @override
  Widget build(BuildContext context) => Secao(
    titulo: 'Dados do convênio',
    children: [
      _Linha('Situação', c.situacao.rotulo),
      _Linha(
        'Finalizado em',
        c.finalizadoEm == null ? '' : dataBr(c.finalizadoEm!),
      ),
      _Linha('Minuta', c.minuta.rotulo),
      _Linha('Origem', c.origem.rotulo),
      _Linha('Resolução CEP', c.resolucaoCep),
      _Linha('Objeto', c.objeto),
      _Linha('Observações', c.observacoesInternas),
    ],
  );
}

class _Etapas extends StatelessWidget {
  const _Etapas({required this.repo, required this.convenioId});

  final Repositorio repo;
  final String convenioId;

  Future<void> _nova(BuildContext context) async {
    var tipo = TipoEtapa.documentacaoRecebida;
    var data = soData(DateTime.now());
    final obs = TextEditingController();
    final etapa = await showDialog<Etapa>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Registrar etapa'),
          content: SizedBox(
            width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<TipoEtapa>(
                  initialValue: tipo,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Etapa'),
                  items: [
                    for (final t in TipoEtapa.values)
                      DropdownMenuItem(value: t, child: Text(t.rotulo)),
                  ],
                  onChanged: (v) => setState(() => tipo = v ?? tipo),
                ),
                const SizedBox(height: 12),
                CampoData(
                  rotulo: 'Data',
                  valor: data,
                  aoMudar: (d) => setState(() => data = d ?? data),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: obs,
                  decoration: const InputDecoration(labelText: 'Observação'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                Etapa(tipo: tipo, data: data, observacao: obs.text.trim()),
              ),
              child: const Text('Registrar'),
            ),
          ],
        ),
      ),
    );
    obs.dispose();
    if (etapa == null || !context.mounted) return;
    try {
      await repo.adicionarEtapa(convenioId, etapa);
    } on Exception {
      if (context.mounted) {
        avisar(context, 'Não foi possível registrar a etapa.');
      }
    }
  }

  @override
  Widget build(BuildContext context) => StreamBuilder<List<Etapa>>(
    stream: repo.etapas(convenioId),
    builder: (context, snap) {
      final etapas = snap.data ?? const <Etapa>[];
      return Secao(
        titulo: 'Andamento do processo',
        acao: FilledButton.tonalIcon(
          onPressed: () => _nova(context),
          icon: const Icon(Icons.add),
          label: const Text('Registrar etapa'),
        ),
        children: [
          if (etapas.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Nenhuma etapa registrada.'),
            )
          else
            for (var i = 0; i < etapas.length; i++)
              _PassoEtapa(etapas[i], ultimo: i == etapas.length - 1),
        ],
      );
    },
  );
}

/// Um passo da linha do tempo das etapas: marca, traço até o próximo e texto.
class _PassoEtapa extends StatelessWidget {
  const _PassoEtapa(this.e, {required this.ultimo});

  final Etapa e;
  final bool ultimo;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 28,
          child: Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: Cores.azul,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, size: 16, color: Colors.white),
              ),
              if (!ultimo)
                Expanded(
                  child: Container(width: 2, color: const Color(0xFFB9CDEB)),
                ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: 4, bottom: ultimo ? 0 : 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        e.tipo.rotulo,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      dataBr(e.data),
                      style: const TextStyle(
                        fontSize: 14,
                        color: Cores.textoFraco,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
                if (e.observacao.isNotEmpty)
                  Text(
                    e.observacao,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Cores.textoFraco,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _Historico extends StatelessWidget {
  const _Historico({required this.repo, required this.convenioId});

  final Repositorio repo;
  final String convenioId;

  String _descricao(RegistroHistorico r) => switch (r.acao) {
    'criado' => 'criou o convênio',
    'etapa' => 'registrou a etapa ${TipoEtapa.de(r.campos.firstOrNull).rotulo}',
    'importado' => 'importou do estagio.uff.br (Drupal)',
    'reimportado' =>
      'atualizou pela importação do Drupal: '
          '${r.campos.map(_rotuloCampo).join(', ')}',
    'importado_planilha' => 'importou das planilhas da Divisão',
    'reimportado_planilha' =>
      'atualizou pela importação das planilhas: '
          '${r.campos.map(_rotuloCampo).join(', ')}',
    _ => 'alterou: ${r.campos.map(_rotuloCampo).join(', ')}',
  };

  String _rotuloCampo(String campo) =>
      const {
        'numero': 'número',
        'processo_sei': 'processo SEI',
        'resolucao_cep': 'Resolução CEP',
        'resolucao_cep_url': 'link da Resolução CEP',
        'objeto': 'objeto',
        'minuta': 'minuta',
        'origem': 'origem',
        'inicio_vigencia': 'início da vigência',
        'fim_vigencia': 'fim da vigência',
        'situacao': 'situação',
        'observacoes_internas': 'observações internas',
        'finalizado_em': 'data de finalização',
        'concedente_id': 'concedente',
      }[campo] ??
      campo;

  @override
  Widget build(BuildContext context) => StreamBuilder<List<RegistroHistorico>>(
    stream: repo.historico(convenioId),
    builder: (context, snap) {
      final itens = snap.data ?? const <RegistroHistorico>[];
      return Secao(
        titulo: 'Histórico de alterações',
        children: [
          if (itens.isEmpty)
            const Text('Sem registros.')
          else
            for (final r in itens)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${r.por} ${_descricao(r)}'),
                    Text(
                      '${dataBr(r.em)} ${r.em.hour.toString().padLeft(2, '0')}:'
                      '${r.em.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Cores.textoFraco,
                      ),
                    ),
                  ],
                ),
              ),
        ],
      );
    },
  );
}

/// RF05: avisos que a Function mandou à Divisão (só leitura).
class _Alertas extends StatelessWidget {
  const _Alertas({required this.repo, required this.convenioId});

  final Repositorio repo;
  final String convenioId;

  @override
  Widget build(BuildContext context) => StreamBuilder<List<AlertaEnviado>>(
    stream: repo.alertas(convenioId),
    builder: (context, snap) {
      final itens = snap.data ?? const <AlertaEnviado>[];
      return Secao(
        titulo: 'Alertas de vencimento enviados',
        children: [
          if (itens.isEmpty)
            const Row(
              children: [
                Icon(
                  Icons.notifications_none,
                  size: 20,
                  color: Cores.textoFraco,
                ),
                SizedBox(width: 10),
                Expanded(child: Text('Nenhum alerta enviado.')),
              ],
            )
          else
            for (final a in itens)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.notifications_outlined,
                      size: 20,
                      color: Cores.textoFraco,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Aviso de ${a.antecedenciaDias} dias '
                            '(vencimento em ${dataBr(a.fimVigencia)})',
                          ),
                          if (a.enviadoEm != null)
                            Text(
                              'Enviado em ${dataBr(a.enviadoEm!)}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Cores.textoFraco,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
        ],
      );
    },
  );
}
