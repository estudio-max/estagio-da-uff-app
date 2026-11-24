import 'package:material_ui/material_ui.dart';

import '../dominio/modelos.dart';
import 'tema.dart';

/// Conteúdo centralizado e com largura máxima, para tela larga e celular.
class Centralizado extends StatelessWidget {
  const Centralizado({
    required this.child,
    this.larguraMaxima = 760,
    super.key,
  });

  final Widget child;
  final double larguraMaxima;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: larguraMaxima),
      child: child,
    ),
  );
}

/// Largura a partir da qual o app usa o menu lateral e layouts de duas colunas.
const larguraLarga = 900.0;

/// Cor do texto do selo de cada vigência (contraste de 4,5:1 sobre o fundo).
Color corVigencia(Vigencia v) => switch (v) {
  Vigencia.vigente => const Color(0xFF18693F),
  Vigencia.aIniciar => const Color(0xFF1D4F9F),
  Vigencia.vencido => const Color(0xFFB42318),
  Vigencia.emTramitacao => const Color(0xFF8A5300),
  Vigencia.cancelado => const Color(0xFF4B5563),
};

/// Fundo claro do selo de cada vigência.
Color fundoVigencia(Vigencia v) => switch (v) {
  Vigencia.vigente => const Color(0xFFE3F4EA),
  Vigencia.aIniciar => const Color(0xFFE5EEFB),
  Vigencia.vencido => const Color(0xFFFDECEA),
  Vigencia.emTramitacao => const Color(0xFFFFF3DC),
  Vigencia.cancelado => const Color(0xFFEEF0F3),
};

/// Cor de gráficos (barras e pontos) de cada vigência.
Color tomVigencia(Vigencia v) => switch (v) {
  Vigencia.vigente => const Color(0xFF2E9A5E),
  Vigencia.aIniciar => Cores.azul,
  Vigencia.vencido => const Color(0xFFD9534A),
  Vigencia.emTramitacao => const Color(0xFFC98A1B),
  Vigencia.cancelado => const Color(0xFF9AA3B2),
};

class SeloVigencia extends StatelessWidget {
  const SeloVigencia(this.vigencia, {super.key});

  final Vigencia vigencia;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: fundoVigencia(vigencia),
      borderRadius: BorderRadius.circular(13),
    ),
    child: Text(
      vigencia.rotulo,
      style: TextStyle(
        color: corVigencia(vigencia),
        fontWeight: FontWeight.w600,
        fontSize: 13,
      ),
    ),
  );
}

/// Frase curta sobre o prazo do convênio, para a lista. `urgente` marca o fim
/// em até 30 dias (a primeira faixa de [faixasVencimento]).
typedef Prazo = ({String texto, bool urgente});

String _emDias(int n) => n == 1 ? '1 dia' : '$n dias';

Prazo? prazoConvenio(Convenio c, DateTime hoje) {
  final dia = soData(hoje);
  final ini = c.inicioVigencia;
  final fim = c.fimVigencia;
  switch (c.vigencia(hoje)) {
    case Vigencia.vigente when fim != null:
      final faltam = fim.difference(dia).inDays;
      if (faltam > 90) return null;
      final texto = faltam == 0 ? 'Vence hoje' : 'Vence em ${_emDias(faltam)}';
      return (texto: texto, urgente: c.venceEm(hoje, faixasVencimento.first));
    case Vigencia.aIniciar when ini != null:
      return (
        texto: 'Começa em ${_emDias(ini.difference(dia).inDays)}',
        urgente: false,
      );
    case Vigencia.vencido when fim != null:
      return (
        texto: 'Venceu há ${_emDias(dia.difference(fim).inDays)}',
        urgente: false,
      );
    default:
      return null;
  }
}

/// Tempo até [fim], em anos e meses de calendário (ou dias, se menos de um mês).
String tempoRestante(DateTime hoje, DateTime fim) {
  final dia = soData(hoje);
  var meses = (fim.year - dia.year) * 12 + fim.month - dia.month;
  if (fim.day < dia.day) meses--;
  if (meses < 1) return _emDias(fim.difference(dia).inDays);
  final anos = meses ~/ 12;
  final resto = meses % 12;
  String plural(int n, String um, String varios) =>
      '$n ${n == 1 ? um : varios}';
  return [
    if (anos > 0) plural(anos, 'ano', 'anos'),
    if (resto > 0) plural(resto, 'mês', 'meses'),
  ].join(' e ');
}

/// Fração da vigência já decorrida (0 a 1); nulo sem as duas datas.
double? fracaoVigencia(Convenio c, DateTime hoje) {
  final ini = c.inicioVigencia;
  final fim = c.fimVigencia;
  if (ini == null || fim == null || !fim.isAfter(ini)) return null;
  final total = fim.difference(ini).inDays;
  final passou = soData(hoje).difference(ini).inDays;
  return (passou / total).clamp(0, 1).toDouble();
}

/// Título da seção, com subtítulo e ações à direita (que descem no celular).
class CabecalhoPagina extends StatelessWidget {
  const CabecalhoPagina({
    required this.titulo,
    this.subtitulo,
    this.acoes = const [],
    super.key,
  });

  final String titulo;
  final String? subtitulo;
  final List<Widget> acoes;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context).textTheme;
    return Wrap(
      spacing: 16,
      runSpacing: 12,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.end,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(titulo, style: tema.headlineMedium),
            if (subtitulo case final s?) ...[
              const SizedBox(height: 4),
              Text(s, style: tema.bodyLarge?.copyWith(color: Cores.textoFraco)),
            ],
          ],
        ),
        if (acoes.isNotEmpty) Wrap(spacing: 12, runSpacing: 8, children: acoes),
      ],
    );
  }
}

/// O ícone da corredora (EstágiosÍcone) num quadro branco, com o nome do app.
class MarcaEstagios extends StatelessWidget {
  const MarcaEstagios({this.compacta = false, super.key});

  /// Só o ícone, sem o nome.
  final bool compacta;

  @override
  Widget build(BuildContext context) {
    final icone = Container(
      width: 44,
      height: 44,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Image.asset(
        'assets/identidade/icone.png',
        semanticLabel: compacta ? 'Estágios UFF' : null,
      ),
    );
    if (compacta) return icone;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        icone,
        const SizedBox(width: 12),
        const Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Estágios UFF',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: fonteTitulos,
                  fontWeight: FontWeight.w700,
                  fontSize: 19,
                  color: Colors.white,
                ),
              ),
              Text(
                'Divisão de Estágio',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, color: Cores.menuTextoFraco),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Seção em cartão, com título e conteúdo.
class Secao extends StatelessWidget {
  const Secao({
    required this.titulo,
    required this.children,
    this.nota,
    this.acao,
    super.key,
  });

  final String titulo;
  final List<Widget> children;
  final String? nota;
  final Widget? acao;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text(titulo, style: tema.titleMedium)),
                ?acao,
              ],
            ),
            if (nota case final n?) ...[
              const SizedBox(height: 4),
              Text(n, style: tema.bodySmall?.copyWith(color: Cores.textoFraco)),
            ],
            const SizedBox(height: 12),
            ...children,
          ],
        ),
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
