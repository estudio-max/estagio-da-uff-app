import 'package:estagios_uff/dominio/modelos.dart';
import 'package:estagios_uff/telas/comum.dart';
import 'package:estagios_uff/telas/home.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'repositorio_em_memoria.dart';

final hoje = DateTime(2026, 11, 24);

Convenio finalizado(DateTime? ini, DateTime? fim) => Convenio(
  id: 'v',
  concedenteId: 'c1',
  concedenteNome: 'Fictícia',
  numero: 'PR-001/2026',
  situacao: Situacao.finalizado,
  inicioVigencia: ini,
  fimVigencia: fim,
);

Future<void> abrir(WidgetTester tester, Widget tela, Size tamanho) async {
  tester.view.physicalSize = tamanho;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: tela));
  await tester.pumpAndSettle();
}

void main() {
  group('prazo na lista de convênios', () {
    test('vigente com fim em até 30 dias é urgente', () {
      final p = prazoConvenio(
        finalizado(DateTime(2025, 4, 3), DateTime(2026, 12, 19)),
        hoje,
      );
      expect(p, (texto: 'Vence em 25 dias', urgente: true));
    });

    test('vigente entre 31 e 90 dias avisa sem urgência', () {
      final p = prazoConvenio(
        finalizado(DateTime(2025), DateTime(2027, 1, 24)),
        hoje,
      );
      expect(p, (texto: 'Vence em 61 dias', urgente: false));
    });

    test('vigente com fim hoje', () {
      final p = prazoConvenio(finalizado(DateTime(2025), hoje), hoje);
      expect(p, (texto: 'Vence hoje', urgente: true));
    });

    test('vigente com mais de 90 dias não mostra prazo', () {
      expect(
        prazoConvenio(finalizado(DateTime(2025), DateTime(2028)), hoje),
        isNull,
      );
    });

    test('a iniciar e vencido contam os dias', () {
      expect(
        prazoConvenio(
          finalizado(DateTime(2027, 1, 8), DateTime(2031)),
          hoje,
        )?.texto,
        'Começa em 45 dias',
      );
      expect(
        prazoConvenio(
          finalizado(DateTime(2021), DateTime(2026, 9, 25)),
          hoje,
        )?.texto,
        'Venceu há 60 dias',
      );
    });

    test('em tramitação e cancelado não têm prazo', () {
      for (final s in [Situacao.emTramitacao, Situacao.cancelado]) {
        final c = finalizado(DateTime(2025), DateTime(2026, 12, 1));
        expect(prazoConvenio(c.copyWith(situacao: s), hoje), isNull);
      }
    });
  });

  group('tempo restante e fração da vigência', () {
    test('anos e meses de calendário', () {
      expect(tempoRestante(hoje, DateTime(2031, 7, 22)), '4 anos e 7 meses');
      expect(tempoRestante(hoje, DateTime(2027, 11, 24)), '1 ano');
      expect(tempoRestante(hoje, DateTime(2027, 1, 24)), '2 meses');
      expect(tempoRestante(hoje, DateTime(2026, 12, 19)), '25 dias');
    });

    test('fração decorrida fica entre 0 e 1', () {
      expect(
        fracaoVigencia(finalizado(DateTime(2026), DateTime(2027)), hoje),
        closeTo(327 / 365, 1e-9),
      );
      expect(
        fracaoVigencia(finalizado(DateTime(2027), DateTime(2028)), hoje),
        0,
      );
      expect(
        fracaoVigencia(finalizado(DateTime(2020), DateTime(2021)), hoje),
        1,
      );
      expect(fracaoVigencia(finalizado(null, DateTime(2028)), hoje), isNull);
    });
  });

  group('menu do app', () {
    final repo = RepositorioEmMemoria(
      convenios: [finalizado(DateTime(2026), DateTime(2030))],
    );

    testWidgets('na tela larga, o menu lateral fica ao abrir um convênio', (
      tester,
    ) async {
      await abrir(
        tester,
        Home(repo: repo, onSair: () {}, usuario: 'Ana Souza'),
        const Size(1280, 900),
      );
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text('AS'), findsOneWidget);
      await tester.tap(find.text('Fictícia'));
      await tester.pumpAndSettle();
      expect(find.text('Andamento do processo'), findsOneWidget);
      expect(find.text('Concedentes'), findsOneWidget);

      // Tocar na seção aberta volta à lista.
      await tester.tap(find.text('Convênios').first);
      await tester.pumpAndSettle();
      expect(find.text('Andamento do processo'), findsNothing);
    });

    testWidgets('no celular, as seções ficam na barra de baixo', (
      tester,
    ) async {
      await abrir(
        tester,
        Home(repo: repo, onSair: () {}),
        const Size(400, 800),
      );
      expect(find.byType(NavigationBar), findsOneWidget);
      await tester.tap(find.text('Concedentes'));
      await tester.pumpAndSettle();
      expect(find.text('Nova concedente'), findsOneWidget);
    });
  });
}
