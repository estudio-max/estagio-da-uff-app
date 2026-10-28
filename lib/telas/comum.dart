import 'package:flutter/material.dart';

import '../dominio/modelos.dart';

/// Conteúdo centralizado e com largura máxima, para tela larga e celular.
class Centralizado extends StatelessWidget {
  const Centralizado({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 760),
      child: child,
    ),
  );
}

Color corVigencia(Vigencia v) => switch (v) {
  Vigencia.vigente => Colors.green.shade700,
  Vigencia.aIniciar => Colors.blue.shade700,
  Vigencia.vencido => Colors.red.shade700,
  Vigencia.emTramitacao => Colors.orange.shade800,
  Vigencia.cancelado => Colors.grey.shade700,
};

class SeloVigencia extends StatelessWidget {
  const SeloVigencia(this.vigencia, {super.key});

  final Vigencia vigencia;

  @override
  Widget build(BuildContext context) {
    final cor = corVigencia(vigencia);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: cor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cor.withValues(alpha: 0.5)),
      ),
      child: Text(
        vigencia.rotulo,
        style: TextStyle(color: cor, fontWeight: FontWeight.w600, fontSize: 12),
      ),
    );
  }
}

/// Campo de data que abre o seletor; mostra dd/mm/aaaa.
class CampoData extends StatelessWidget {
  const CampoData({
    required this.rotulo,
    required this.valor,
    required this.aoMudar,
    this.erro,
    super.key,
  });

  final String rotulo;
  final DateTime? valor;
  final ValueChanged<DateTime?> aoMudar;
  final String? erro;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () async {
      final escolhida = await showDatePicker(
        context: context,
        initialDate: valor ?? DateTime.now(),
        firstDate: DateTime(1990),
        lastDate: DateTime(2100),
        locale: const Locale('pt', 'BR'),
      );
      if (escolhida != null) aoMudar(soData(escolhida));
    },
    child: InputDecorator(
      decoration: InputDecoration(
        labelText: rotulo,
        errorText: erro,
        suffixIcon: valor == null
            ? const Icon(Icons.calendar_today, size: 18)
            : IconButton(
                tooltip: 'Limpar',
                icon: const Icon(Icons.clear, size: 18),
                onPressed: () => aoMudar(null),
              ),
      ),
      child: Text(valor == null ? '' : dataBr(valor!)),
    ),
  );
}

void avisar(BuildContext context, String mensagem) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(content: Text(mensagem), behavior: SnackBarBehavior.floating),
    );
}
