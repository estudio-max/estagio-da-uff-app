import 'package:flutter/material.dart';

import '../dados/repositorio.dart';
import '../dominio/modelos.dart';
import 'comum.dart';
import 'convenio_form.dart';

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
              IconButton(
                tooltip: 'Editar',
                icon: const Icon(Icons.edit),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => ConvenioForm(repo: repo, convenio: c),
                  ),
                ),
              ),
          ],
        ),
        body: c == null
            ? const Center(child: CircularProgressIndicator())
            : Centralizado(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _Resumo(c: c, hoje: agora()),
                    const SizedBox(height: 24),
                    _Etapas(repo: repo, convenioId: id),
                    const SizedBox(height: 24),
                    _Historico(repo: repo, convenioId: id),
                  ],
                ),
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
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 150,
                child: Text(
                  rotulo,
                  style: TextStyle(color: Theme.of(context).hintColor),
                ),
              ),
              Expanded(child: Text(valor)),
            ],
          ),
        );
}

class _Resumo extends StatelessWidget {
  const _Resumo({required this.c, required this.hoje});

  final Convenio c;
  final DateTime hoje;

  @override
  Widget build(BuildContext context) {
    final ini = c.inicioVigencia;
    final fim = c.fimVigencia;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    c.numero.isEmpty ? 'Sem número' : c.numero,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                SeloVigencia(c.vigencia(hoje)),
              ],
            ),
            const SizedBox(height: 8),
            _Linha('Processo SEI', c.processoSei),
            _Linha(
              'Vigência',
              ini == null && fim == null
                  ? ''
                  : '${ini == null ? '—' : dataBr(ini)} a '
                        '${fim == null ? '—' : dataBr(fim)}',
            ),
            _Linha('Situação', c.situacao.rotulo),
            _Linha('Minuta', c.minuta.rotulo),
            _Linha('Origem', c.origem.rotulo),
            _Linha('Resolução CEP', c.resolucaoCep),
            _Linha('Objeto', c.objeto),
            _Linha('Observações', c.observacoesInternas),
            _Linha(
              'Finalizado em',
              c.finalizadoEm == null ? '' : dataBr(c.finalizadoEm!),
            ),
          ],
        ),
      ),
    );
  }
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
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Expanded(
            child: Text(
              'Andamento do processo',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          TextButton.icon(
            onPressed: () => _nova(context),
            icon: const Icon(Icons.add),
            label: const Text('Registrar etapa'),
          ),
        ],
      ),
      StreamBuilder<List<Etapa>>(
        stream: repo.etapas(convenioId),
        builder: (context, snap) {
          final etapas = snap.data ?? const <Etapa>[];
          if (etapas.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Nenhuma etapa registrada.'),
            );
          }
          return Column(
            children: [
              for (final e in etapas)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.check_circle_outline),
                  title: Text(e.tipo.rotulo),
                  subtitle: e.observacao.isEmpty ? null : Text(e.observacao),
                  trailing: Text(dataBr(e.data)),
                ),
            ],
          );
        },
      ),
    ],
  );
}

class _Historico extends StatelessWidget {
  const _Historico({required this.repo, required this.convenioId});

  final Repositorio repo;
  final String convenioId;

  String _descricao(RegistroHistorico r) => switch (r.acao) {
    'criado' => 'criou o convênio',
    'etapa' => 'registrou a etapa ${TipoEtapa.de(r.campos.firstOrNull).rotulo}',
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
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Histórico de alterações',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      StreamBuilder<List<RegistroHistorico>>(
        stream: repo.historico(convenioId),
        builder: (context, snap) {
          final itens = snap.data ?? const <RegistroHistorico>[];
          if (itens.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Sem registros.'),
            );
          }
          return Column(
            children: [
              for (final r in itens)
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.history),
                  title: Text('${r.por} ${_descricao(r)}'),
                  subtitle: Text(
                    '${dataBr(r.em)} ${r.em.hour.toString().padLeft(2, '0')}:'
                    '${r.em.minute.toString().padLeft(2, '0')}',
                  ),
                ),
            ],
          );
        },
      ),
    ],
  );
}
