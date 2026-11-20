import 'dart:convert';
import 'dart:typed_data';

import 'package:material_ui/material_ui.dart';

import '../dados/importacao.dart';

/// O que se importa: textos da tela e a conferência dos arquivos antes de enviar.
class FonteImportacao {
  const FonteImportacao({
    required this.titulo,
    required this.explicacao,
    required this.rotuloEscolher,
    required this.extensoes,
    required this.validar,
    this.varios = false,
  });

  /// RF07: XML exportado do estagio.uff.br (Drupal).
  static final site = FonteImportacao(
    titulo: 'Importar do estagio.uff.br',
    explicacao:
        'Envie o XML exportado do Drupal. Primeiro o sistema simula, '
        'sem gravar nada; confira o resultado e só então importe. '
        'Pode importar de novo: convênio já importado é atualizado, '
        'sem duplicar.',
    rotuloEscolher: 'Escolher arquivo XML',
    extensoes: const ['xml'],
    validar: _validarXml,
  );

  /// RF07: planilhas internas da Divisão (privados e públicos), de 2022 em diante.
  static final planilhas = FonteImportacao(
    titulo: 'Importar as planilhas da Divisão',
    explicacao:
        'Envie as planilhas de convênios privados e públicos (.xlsx ou '
        '.xlsm), juntas ou uma de cada vez. Entram as abas de 2022 em '
        'diante. Primeiro o sistema simula, sem gravar nada; confira o '
        'resultado e o relatório e só então importe. Pode importar de novo: '
        'o convênio é achado pelo código, pelo processo SEI ou pelo CNPJ com '
        'o início, e é atualizado sem duplicar.',
    rotuloEscolher: 'Escolher planilhas',
    extensoes: const ['xlsx', 'xlsm'],
    varios: true,
    validar: _validarPlanilhas,
  );

  final String titulo;
  final String explicacao;
  final String rotuloEscolher;
  final List<String> extensoes;
  final bool varios;

  /// Mensagem de erro, ou `null` se os arquivos podem ser enviados.
  final String? Function(List<ArquivoImportacao>) validar;
}

String? _validarXml(List<ArquivoImportacao> arquivos) {
  if (arquivos.length != 1) return 'Escolha um arquivo XML.';
  try {
    final xml = utf8.decode(arquivos.single.bytes).replaceFirst('\uFEFF', '');
    return xml.trim().isEmpty ? 'O arquivo está vazio.' : null;
  } on FormatException {
    return 'O arquivo não está em UTF-8. Exporte o XML de novo do Drupal.';
  }
}

/// A Function recebe até 7 MB (o pedido vai em base64, com limite de 10 MB).
const maximoPlanilhasBytes = 7 * 1024 * 1024;

String? _validarPlanilhas(List<ArquivoImportacao> arquivos) {
  if (arquivos.isEmpty) return 'Escolha ao menos uma planilha.';
  final outros = arquivos.where(
    (a) => !RegExp(r'\.xls[xm]$', caseSensitive: false).hasMatch(a.nome),
  );
  if (outros.isNotEmpty) {
    return '${outros.first.nome} não é uma planilha .xlsx ou .xlsm.';
  }
  final total = arquivos.fold<int>(0, (n, a) => n + a.bytes.length);
  return total > maximoPlanilhasBytes
      ? 'As planilhas passam de 7 MB juntas.'
      : null;
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

/// Rótulos das situações no resumo da importação das planilhas.
const _rotulosSituacao = {
  'finalizado': 'Finalizados',
  'em_tramitacao': 'Em tramitação',
  'cancelado': 'Cancelados',
};

/// RF07: a Divisão envia o XML do estagio.uff.br ou as planilhas internas.
/// Primeiro simula, confere o resultado e só então grava.
class ImportacaoPage extends StatefulWidget {
  const ImportacaoPage({
    required this.fonte,
    required this.importador,
    required this.escolherArquivos,
    required this.salvarRelatorio,
    super.key,
  });

  final FonteImportacao fonte;
  final Importador importador;

  /// Recebe as extensões aceitas e se pode escolher vários; vazio se cancelou.
  final Future<List<ArquivoImportacao>> Function(
    List<String> extensoes, {
    required bool varios,
  })
  escolherArquivos;
  final Future<void> Function(String nome, Uint8List bytes) salvarRelatorio;

  @override
  State<ImportacaoPage> createState() => _ImportacaoPageState();
}

class _ImportacaoPageState extends State<ImportacaoPage> {
  List<ArquivoImportacao> _arquivos = const [];
  bool _validos = false;
  ResultadoImportacao? _resultado;
  String? _erro;
  bool _ocupado = false;

  Future<void> _escolher() async {
    final arquivos = await widget.escolherArquivos(
      widget.fonte.extensoes,
      varios: widget.fonte.varios,
    );
    if (arquivos.isEmpty || !mounted) return;
    final erro = widget.fonte.validar(arquivos);
    setState(() {
      _arquivos = arquivos;
      _validos = erro == null;
      _resultado = null;
      _erro = erro;
    });
  }

  Future<void> _rodar({required bool simular}) async {
    if (!_validos) return;
    if (!simular && !await _confirmar()) return;
    setState(() {
      _ocupado = true;
      _erro = null;
    });
    try {
      final r = await widget.importador.importar(_arquivos, simular: simular);
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
      appBar: AppBar(title: Text(widget.fonte.titulo)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(widget.fonte.explicacao),
          const SizedBox(height: 16),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: _ocupado ? null : _escolher,
                icon: const Icon(Icons.upload_file),
                label: Text(widget.fonte.rotuloEscolher),
              ),
              const SizedBox(width: 12),
              if (_arquivos.isNotEmpty)
                Expanded(
                  child: Text(
                    [
                      for (final a in _arquivos)
                        '${a.nome} · ${(a.bytes.length / 1024).ceil()} KB',
                    ].join('\n'),
                    overflow: TextOverflow.ellipsis,
                    maxLines: _arquivos.length,
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
                onPressed: _ocupado || !_validos
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
            for (final MapEntry(:key, :value) in r.situacoes.entries)
              if (_rotulosSituacao[key] case final rotulo?)
                linha('  $rotulo', value),
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
