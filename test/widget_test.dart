import 'package:estagios_uff/auth/login_page.dart';
import 'package:estagios_uff/convenios/convenio.dart';
import 'package:estagios_uff/convenios/convenios_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('lista de convênios abre a tela do convênio', (tester) async {
    final convenio = Convenio.fromMap('1', {
      'concedente': 'Empresa Fictícia',
      'status': 'Vigente',
      'vigencia_fim': '2027-03-05',
    });
    await tester.pumpWidget(
      MaterialApp(
        home: ConveniosPage(convenios: Stream.value([convenio]), onSair: () {}),
      ),
    );
    await tester.pump();
    expect(find.text('Empresa Fictícia'), findsOneWidget);

    await tester.tap(find.text('Empresa Fictícia'));
    await tester.pumpAndSettle();
    expect(find.text('Situação: Vigente'), findsOneWidget);
    expect(find.text('Vigência até: 05/03/2027'), findsOneWidget);
  });

  testWidgets('lista vazia avisa o usuário', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ConveniosPage(convenios: Stream.value([]), onSair: () {}),
      ),
    );
    await tester.pump();
    expect(find.text('Nenhum convênio cadastrado.'), findsOneWidget);
  });

  testWidgets('login com falha mostra erro', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginPage(onEntrar: (_, _) async => throw Exception('x')),
      ),
    );
    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();
    expect(find.text('E-mail ou senha inválidos.'), findsOneWidget);
  });
}
