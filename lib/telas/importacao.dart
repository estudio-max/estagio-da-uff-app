import 'dart:convert';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../dados/importacao.dart';

/// Arquivo escolhido pela Divisão: nome e conteúdo bruto.
class ArquivoXml {
  const ArquivoXml(this.nome, this.bytes);

  final String nome;
  final Uint8List bytes;
}

/// Texto da confirmação antes de gravar, com singular e plural certos.
String textoConfirmacao(ResultadoImportacao r) {
  String n(int q, String um, String varios) => '$q ${q == 1 ? um : varios}';
  final texto =
      '${n(r.criados, 'convênio será criado', 'convênios serão criados')} e '
      '${n(r.atualizados, 'atualizado', 'atualizados')}.';
  if (r.rejeitados == 0) return texto;
  return '$texto ${n(r.rejeitados, 'fica', 'ficam')} de fora '
      '(veja o relatório).';
}

/// RF07: a Divisão envia o XML exportado do estagio.uff.br. Primeiro simula,
/// confere o resultado e só então grava.
class ImportacaoPage extends StatefulWidget {
  const ImportacaoPage({
    required this.importador,
    required this.escolherArquivo,
    required this.salvarRelatorio,
    super.key,
  });

  final Importador importador;
  final Future<ArquivoXml?> Function() escolherArquivo;
  final Future<void> Function(String nome, Uint8List bytes) salvarRelatorio;

  @override
  State<ImportacaoPage> createState() => _ImportacaoPageState();
}

class _ImportacaoPageState extends State<ImportacaoPage> {
  ArquivoXml? _arquivo;
  String? _xml;
  ResultadoImportacao? _resultado;
  String? _erro;
  bool _ocupado = false;

  Future<void> _escolher() async {
    final arquivo = await widget.escolherArquivo();
    if (arquivo == null || !mounted) return;
    String? xml;
    String? erro;
    try {
      xml = utf8.decode(arquivo.bytes).replaceFirst('﻿', '');
      if (xml.trim().isEmpty) erro = 'O arquivo está vazio.';
    } on FormatException {
      erro = 'O arquivo não está em UTF-8. Exporte o XML de novo do Drupal.';
    }
    setState(() {
      _arquivo = arquivo;
      _xml = erro == null ? xml : null;
      _resultado = null;
      _erro = erro;
    });
  }

  Future<void> _rodar({required bool simular}) async {
    final xml = _xml;
    if (xml == null) return;
    if (!simular && !await _confirmar()) return;
    setState(() {
      _ocupado = true;
      _erro = null;
    });
    try {
      final r = await widget.importador.importar(xml, simular: simular);
      if (mounted) setState(() => _resultado = r);
    } on ErroImportacao catch (e) {
      if (mounted) setState(() => _erro = e.mensagem);
    } catch (_) {
      if (mounted) {
        setState(() => _erro = 'A importação falhou. Tente de novo.');
      }
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<bool> _confirmar() async {
    final r = _resultado!;
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Gravar a importação?'),
            content: Text(textoConfirmacao(r)),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Gravar'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _salvarRelatorio() async {
    final r = _resultado!;
    try {
      await widget.salvarRelatorio(
        r.simulado ? 'importacao-simulada.csv' : 'importacao.csv',
        Uint8List.fromList(utf8.encode(r.csv)),
      );
    } catch (_) {
      if (mounted) {
        setState(() => _erro = 'Não foi possível salvar o relatório.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _resultado;
    final simulado = r != null && r.simulado;
    return Scaffold(
      appBar: AppBar(title: const Text('Importar do estagio.uff.br')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Envie o XML exportado do Drupal. Primeiro o sistema simula, '
            'sem gravar nada; confira o resultado e só então importe. '
            'Pode importar de novo: convênio já importado é atualizado, '
            'sem duplicar.',
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: _ocupado ? null : _escolher,
                icon: const Icon(Icons.upload_file),
                label: const Text('Escolher arquivo XML'),
              ),
              const SizedBox(width: 12),
              if (_arquivo != null)
                Expanded(
                  child: Text(
                    '${_arquivo!.nome} · '
                    '${(_arquivo!.bytes.length / 1024).ceil()} KB',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              FilledButton.tonal(
                onPressed: _ocupado || _xml == null
                    ? null
                    : () => _rodar(simular: true),
                child: const Text('Simular (não grava)'),
              ),
              // Só depois de simular o mesmo arquivo.
              FilledButton(
                onPressed: _ocupado || !simulado
                    ? null
                    : () => _rodar(simular: false),
                child: const Text('Importar'),
              ),
            ],
          ),
          if (_ocupado) ...[
            const SizedBox(height: 16),
            const LinearProgressIndicator(),
            const SizedBox(height: 4),
            const Text('Processando. Com milhares de convênios, leva minutos.'),
          ],
          if (_erro != null) ...[
            const SizedBox(height: 16),
            Text(
              _erro!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (r != null) ...[
            const SizedBox(height: 16),
            _Resumo(resultado: r, onSalvar: _salvarRelatorio),
          ],
        ],
      ),
    );
  }
}

class _Resumo extends StatelessWidget {
  const _Resumo({required this.resultado, required this.onSalvar});

  final ResultadoImportacao resultado;
  final VoidCallback onSalvar;

  @override
  Widget build(BuildContext context) {
    final r = resultado;
    Widget linha(String rotulo, int valor) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(rotulo)),
          Text('$valor'),
        ],
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              r.simulado
                  ? 'Simulação: nada foi gravado'
                  : 'Importação concluída',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            linha('Registros lidos', r.lidos),
            linha(r.simulado ? 'Seriam criados' : 'Criados', r.criados),
            linha(
              r.simulado ? 'Seriam atualizados' : 'Atualizados',
              r.atualizados,
            ),
            linha('Rejeitados', r.rejeitados),
            linha('Avisos', r.avisos),
            if (r.rejeitados + r.avisos > 0) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: onSalvar,
                icon: const Icon(Icons.download),
                label: const Text('Salvar relatório (CSV)'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
