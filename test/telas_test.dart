import 'package:estagios_uff/auth/login_page.dart';
import 'package:estagios_uff/dominio/modelos.dart';
import 'package:estagios_uff/telas/concedentes.dart';
import 'package:estagios_uff/telas/convenios.dart';
import 'package:estagios_uff/telas/convenio_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'repositorio_em_memoria.dart';

final hoje = DateTime(2026, 10, 6);

const empresa = Concedente(
  id: 'c1',
  documento: '11222333000181',
  razaoSocial: 'Empresa Fictícia Ltda',
  nomeFantasia: 'Fictícia',
  tipo: TipoConcedente.empresaPrivada,
  uf: 'RJ',
  cidade: 'Niterói',
);

Convenio convenio(String id, String numero, DateTime ini, DateTime fim) =>
    Convenio(
      id: id,
      concedenteId: 'c1',
      concedenteNome: 'Fictícia',
      numero: numero,
      situacao: Situacao.finalizado,
      inicioVigencia: ini,
      fimVigencia: fim,
    );

Future<void> abrir(WidgetTester tester, Widget tela) async {
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: tela));
  await tester.pumpAndSettle();
}

/// Abre a tela por uma rota (como no app), para o `pop` ao salvar funcionar.
Future<void> abrirEmRota(WidgetTester tester, Widget tela) async {
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () =>
                Navigator.of(context)
                    .push(MaterialPageRoute<void>(builder: (_) => tela)),
            child: const Text('abrir'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

void main() {
  group('lista de convênios', () {
    final repo = RepositorioEmMemoria(
      concedentes: [empresa],
      convenios: [
        convenio('1', 'PR-001/2026', DateTime(2026), DateTime(2030)),
        convenio('2', 'PR-002/2021', DateTime(2021), DateTime(2025)),
        convenio('3', 'PR-003/2027', DateTime(2027), DateTime(2031, 12)),
      ],
    );

    testWidgets('mostra a vigência derivada (RN02)', (tester) async {
      await abrir(
        tester,
        Scaffold(
          body: ConveniosPage(repo: repo, agora: () => hoje),
        ),
      );
      expect(find.text('Vigente'), findsWidgets);
      expect(find.text('Vencido'), findsWidgets);
      expect(find.text('A iniciar'), findsWidgets);
    });

    testWidgets('o filtro de vigência e a busca por número funcionam', (
      tester,
    ) async {
      await abrir(
        tester,
        Scaffold(
          body: ConveniosPage(repo: repo, agora: () => hoje),
        ),
      );
      final vencido = find.widgetWithText(ChoiceChip, 'Vencido');
      await tester.ensureVisible(vencido);
      await tester.tap(vencido);
      await tester.pumpAndSettle();
      expect(find.text('PR-002/2021 · até 01/01/2025'), findsOneWidget);
      expect(find.textContaining('PR-001'), findsNothing);

      final todos = find.widgetWithText(ChoiceChip, 'Todos');
      await tester.ensureVisible(todos);
      await tester.tap(todos);
      await tester.enterText(find.byType(TextField), 'PR-003');
      await tester.pumpAndSettle();
      expect(find.textContaining('PR-003/2027'), findsOneWidget);
      expect(find.textContaining('PR-001'), findsNothing);
    });
  });

  group('concedentes', () {
    testWidgets('CNPJ inválido mostra o erro e não salva (RN03)', (
      tester,
    ) async {
      final repo = RepositorioEmMemoria();
      await abrir(tester, ConcedenteForm(repo: repo));
      await tester.enterText(
        find.widgetWithText(TextField, 'CPF ou CNPJ'),
        '11.222.333/0001-80',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Razão social / nome'),
        'X',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Cidade'),
        'Niterói',
      );
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      expect(find.text('CPF ou CNPJ inválido.'), findsOneWidget);
      expect(await repo.concedentes().first, isEmpty);
    });

    Future<void> preencherEsalvar(WidgetTester tester) async {
      await tester.enterText(
        find.widgetWithText(TextField, 'CPF ou CNPJ'),
        '11.222.333/0001-81',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Razão social / nome'),
        'Empresa Fictícia Ltda',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Cidade'),
        'Niterói',
      );
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
    }

    testWidgets('cadastra com máscara e grava o documento normalizado', (
      tester,
    ) async {
      final repo = RepositorioEmMemoria();
      await abrirEmRota(tester, ConcedenteForm(repo: repo));
      await preencherEsalvar(tester);
      expect(find.text('Concedente salva.'), findsOneWidget);
      expect(
        (await repo.concedentes().first).single.documento,
        '11222333000181',
      );
    });

    testWidgets('barra o documento duplicado (RN03)', (tester) async {
      final repo = RepositorioEmMemoria(concedentes: [empresa]);
      await abrirEmRota(tester, ConcedenteForm(repo: repo));
      await preencherEsalvar(tester);
      expect(
        find.text('Já existe concedente com este CPF/CNPJ.'),
        findsOneWidget,
      );
      expect(await repo.concedentes().first, hasLength(1));
    });
  });

  group('cadastro de convênio', () {
    testWidgets('finalizado sem número e datas mostra o erro', (tester) async {
      final repo = RepositorioEmMemoria(concedentes: [empresa]);
      await abrirEmRota(tester, ConvenioForm(repo: repo));
      await tester.tap(
        find.widgetWithText(DropdownButtonFormField<String>, 'Concedente'),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Fictícia ·').last);
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(DropdownButtonFormField<Situacao>, 'Situação'),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Finalizado').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      expect(
        find.text('Finalizado exige número e datas de vigência.'),
        findsWidgets,
      );
      expect(await repo.convenios().first, isEmpty);
    });

    testWidgets('em tramitação salva e entra no histórico (RF08)', (
      tester,
    ) async {
      final repo = RepositorioEmMemoria(concedentes: [empresa]);
      await abrirEmRota(tester, ConvenioForm(repo: repo));
      await tester.tap(
        find.widgetWithText(DropdownButtonFormField<String>, 'Concedente'),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Fictícia ·').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      final salvo = (await repo.convenios().first).single;
      expect(salvo.situacao, Situacao.emTramitacao);
      expect(salvo.concedenteNome, 'Fictícia');
      final historico = await repo.historico(salvo.id!).first;
      expect(historico.single.acao, 'criado');
    });
  });

  testWidgets('login com falha mostra erro', (tester) async {
    await abrir(
      tester,
      LoginPage(onEntrar: (_, _) async => throw Exception('x')),
    );
    await tester.tap(find.text('Entrar'));
    await tester.pumpAndSettle();
    expect(find.text('E-mail ou senha inválidos.'), findsOneWidget);
  });
}
