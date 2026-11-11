import 'package:estagios_uff/auth/login_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> abrir(WidgetTester tester, LoginPage tela) async {
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: tela));
  await tester.pumpAndSettle();
}

void main() {
  const botao = 'Entrar com Google (@id.uff.br)';

  testWidgets('sem onGoogle o botão do Google não aparece', (tester) async {
    await abrir(tester, LoginPage(onEntrar: (_, _) async {}));
    expect(find.text(botao), findsNothing);
  });

  testWidgets('com onGoogle o botão aparece e chama a entrada', (tester) async {
    var chamou = false;
    await abrir(
      tester,
      LoginPage(onEntrar: (_, _) async {}, onGoogle: () async => chamou = true),
    );
    await tester.tap(find.text(botao));
    await tester.pumpAndSettle();
    expect(chamou, isTrue);
    expect(find.textContaining('Não foi possível entrar'), findsNothing);
  });

  testWidgets('falha no Google mostra a orientação sobre a conta', (
    tester,
  ) async {
    await abrir(
      tester,
      LoginPage(
        onEntrar: (_, _) async {},
        onGoogle: () async => throw Exception('x'),
      ),
    );
    await tester.tap(find.text(botao));
    await tester.pumpAndSettle();
    expect(find.textContaining('conta @id.uff.br'), findsOneWidget);
  });

  testWidgets('login por e-mail e senha continua funcionando junto', (
    tester,
  ) async {
    String? recebido;
    await abrir(
      tester,
      LoginPage(
        onEntrar: (email, _) async => recebido = email,
        onGoogle: () async {},
      ),
    );
    await tester.enterText(find.widgetWithText(TextField, 'E-mail'), ' a@b.c ');
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pumpAndSettle();
    expect(recebido, 'a@b.c');
  });
}
