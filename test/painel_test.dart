// RF06 e MS05: tela do painel, com a Function substituída por um falso. Porta os casos
// de tela de tests/test_painel.py (Django); o cálculo é testado em functions/src/painel.test.ts.
import 'package:estagios_uff/dados/painel.dart';
import 'package:estagios_uff/dominio/modelos.dart';
import 'package:estagios_uff/telas/home.dart';
import 'package:estagios_uff/telas/painel.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'repositorio_em_memoria.dart';

class PainelFalso implements FontePainel {
  PainelFalso(this.resposta);

  Map<String, dynamic> resposta;
  ErroPainel? erro;
  var chamadas = 0;

  @override
  Future<Indicadores> carregar() async {
    chamadas += 1;
    if (erro case final e?) throw e;
    return Indicadores.fromMap(resposta);
  }
}

Map<String, dynamic> resposta({
  List<Map<String, dynamic>> parados = const [],
  num? media = 50,
}) => {
  'hoje': '2026-10-06',
  'por_vigencia': {
    'em_tramitacao': 1,
    'cancelado': 1,
    'a_iniciar': 0,
    'vigente': 4,
    'vencido': 1,
  },
  'vencendo': {'30': 1, '90': 2, '180': 3},
  'por_tipo': {
    for (final t in TipoConcedente.values) t.valor: 0,
    'empresa_privada': 2,
    'ong_oscip': 2,
  },
  'tramitacao_media': media,
  'tramitacao_mediana': media,
  'tramitacao_amostra': media == null ? 0 : 2,
  'parados': parados,
  'periodo_tramitacao_dias': 365,
};

final repo = RepositorioEmMemoria(
  convenios: [
    const Convenio(
      id: 'v1',
      concedenteId: 'c1',
      concedenteNome: 'Empresa Fictícia Ltda',
    ),
  ],
);

Future<void> abrir(WidgetTester tester, Widget tela) async {
  tester.view.physicalSize = const Size(1200, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: tela));
  await tester.pumpAndSettle();
}

void main() {
  test('lê os indicadores da Function', () {
    final i = Indicadores.fromMap(
      resposta(
        parados: [
          {'id': 'v1', 'numero': '', 'concedente': 'Fictícia', 'dias': 110},
        ],
      ),
    );
    expect(i.porVigencia['vigente'], 4);
    expect(i.vencendo, {30: 1, 90: 2, 180: 3});
    expect(i.porTipo['ong_oscip'], 2);
    expect(i.tramitacaoMedia, 50);
    expect(i.parados.single.dias, 110);
  });

  testWidgets('a Divisão abre o painel pela tela inicial', (tester) async {
    final fonte = PainelFalso(resposta());
    await abrir(tester, Home(repo: repo, onSair: () {}, painel: fonte));
    await tester.tap(find.byTooltip('Painel'));
    await tester.pumpAndSettle();
    for (final trecho in [
      'Painel de convênios',
      'Convênios por situação',
      'nos próximos 30 dias',
      'Tempo de tramitação',
      'Vigentes por tipo de concedente',
      'Em tramitação há mais tempo',
    ]) {
      expect(find.text(trecho), findsOneWidget, reason: trecho);
    }
    expect(find.text('50 dias'), findsNWidgets(2)); // média e mediana
    expect(
      find.text('Microempresas'),
      findsOneWidget,
    ); // tipos zerados aparecem
    expect(find.text('Nenhum convênio em tramitação.'), findsOneWidget);
  });

  testWidgets('sem a fonte, o botão do painel não aparece', (tester) async {
    await abrir(tester, Home(repo: repo, onSair: () {}));
    expect(find.byTooltip('Painel'), findsNothing);
  });

  testWidgets('sem finalizados no período, não mostra média', (tester) async {
    await abrir(
      tester,
      PainelPage(fonte: PainelFalso(resposta(media: null)), repo: repo),
    );
    expect(find.text('Nenhum convênio finalizado no período.'), findsOneWidget);
    expect(find.text('Média'), findsNothing);
  });

  testWidgets('convênio parado abre o detalhe', (tester) async {
    await abrir(
      tester,
      PainelPage(
        fonte: PainelFalso(
          resposta(
            parados: [
              {
                'id': 'v1',
                'numero': '',
                'concedente': 'Empresa Fictícia Ltda',
                'dias': 110,
              },
            ],
          ),
        ),
        repo: repo,
        agora: () => DateTime(2026, 10, 6),
      ),
    );
    expect(find.text('110 dias'), findsOneWidget);
    expect(find.text('sem número'), findsOneWidget);
    await tester.tap(find.text('Empresa Fictícia Ltda'));
    await tester.pumpAndSettle();
    expect(find.text('Painel de convênios'), findsNothing);
    expect(find.text('Empresa Fictícia Ltda'), findsWidgets);
  });

  testWidgets('mostra o erro da Function e tenta de novo', (tester) async {
    final fonte = PainelFalso(resposta())
      ..erro = const ErroPainel('Só a Divisão de Estágio vê o painel.');
    await abrir(tester, PainelPage(fonte: fonte, repo: repo));
    expect(find.text('Só a Divisão de Estágio vê o painel.'), findsOneWidget);

    fonte.erro = null;
    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();
    expect(fonte.chamadas, 2);
    expect(find.text('Convênios por situação'), findsOneWidget);
  });
}
