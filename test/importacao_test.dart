// RF07: tela de importação (XML do Drupal e planilhas da Divisão), com a Function
// substituída por um falso.
import 'dart:convert';
import 'dart:typed_data';

import 'package:estagios_uff/dados/importacao.dart';
import 'package:estagios_uff/telas/importacao.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

class ImportadorFalso implements Importador {
  final chamadas = <bool>[];
  List<String> arquivosRecebidos = const [];
  ErroImportacao? erro;
  Map<String, int> situacoes = const {};

  @override
  Future<ResultadoImportacao> importar(
    List<ArquivoImportacao> arquivos, {
    required bool simular,
  }) async {
    chamadas.add(simular);
    arquivosRecebidos = [for (final a in arquivos) a.nome];
    if (erro case final e?) throw e;
    return ResultadoImportacao(
      lidos: 3,
      criados: 2,
      atualizados: 0,
      rejeitados: 1,
      avisos: 0,
      simulado: simular,
      csv: '﻿situação;origem;concedente;motivo\r\n',
      situacoes: situacoes,
    );
  }
}

final xml = ArquivoImportacao(
  'conveniosestagio.xml',
  Uint8List.fromList(utf8.encode('﻿<nodes><node/></nodes>')),
);

ArquivoImportacao planilha(String nome, [int bytes = 10]) =>
    ArquivoImportacao(nome, Uint8List(bytes));

Future<(ImportadorFalso, List<String>, List<List<String>>)> abrir(
  WidgetTester tester, {
  FonteImportacao? fonte,
  List<ArquivoImportacao>? escolhidos,
}) async {
  final importador = ImportadorFalso();
  final salvos = <String>[];
  final pedidos = <List<String>>[];
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: ImportacaoPage(
        fonte: fonte ?? FonteImportacao.site,
        importador: importador,
        escolherArquivos: (extensoes, {required varios}) async {
          pedidos.add([...extensoes, if (varios) 'vários']);
          return escolhidos ?? [xml];
        },
        salvarRelatorio: (nome, _) async => salvos.add(nome),
      ),
    ),
  );
  return (importador, salvos, pedidos);
}

bool habilitado(WidgetTester tester, String texto) =>
    tester
        .widget<ButtonStyleButton>(
          find.ancestor(
            of: find.text(texto),
            matching: find.byWidgetPredicate((w) => w is ButtonStyleButton),
          ),
        )
        .onPressed !=
    null;

ResultadoImportacao contagem(int criados, int atualizados, int rejeitados) =>
    ResultadoImportacao(
      lidos: criados + atualizados + rejeitados,
      criados: criados,
      atualizados: atualizados,
      rejeitados: rejeitados,
      avisos: 0,
      simulado: true,
      csv: '',
    );

void main() {
  test('confirmação concorda singular e plural', () {
    expect(
      textoConfirmacao(contagem(1, 0, 1)),
      '1 convênio será criado e 0 atualizados. 1 fica de fora '
      '(veja o relatório).',
    );
    expect(
      textoConfirmacao(contagem(2, 1, 0)),
      '2 convênios serão criados e 1 atualizado.',
    );
  });

  test('resultado lê as situações da importação das planilhas', () {
    final r = ResultadoImportacao.fromMap({
      'lidos': 2,
      'situacoes': {'finalizado': 1, 'em_tramitacao': 1, 'cancelado': 0},
    });
    expect(r.situacoes, {'finalizado': 1, 'em_tramitacao': 1, 'cancelado': 0});
    expect(ResultadoImportacao.fromMap({}).situacoes, isEmpty);
  });

  testWidgets('só importa depois de simular, e pede confirmação', (
    tester,
  ) async {
    final (importador, salvos, pedidos) = await abrir(tester);
    expect(habilitado(tester, 'Simular (não grava)'), isFalse);

    await tester.tap(find.text('Escolher arquivo XML'));
    await tester.pumpAndSettle();
    expect(pedidos, [
      ['xml'],
    ]);
    expect(find.textContaining('conveniosestagio.xml'), findsOneWidget);
    expect(habilitado(tester, 'Importar'), isFalse);

    await tester.tap(find.text('Simular (não grava)'));
    await tester.pumpAndSettle();
    expect(importador.chamadas, [true]);
    expect(importador.arquivosRecebidos, ['conveniosestagio.xml']);
    expect(find.text('Simulação: nada foi gravado'), findsOneWidget);
    expect(find.text('Seriam criados'), findsOneWidget);

    await tester.tap(find.text('Salvar relatório (CSV)'));
    await tester.pumpAndSettle();
    expect(salvos, ['importacao-simulada.csv']);

    await tester.tap(find.text('Importar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(importador.chamadas, [true]);

    await tester.tap(find.text('Importar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gravar'));
    await tester.pumpAndSettle();
    expect(importador.chamadas, [true, false]);
    expect(find.text('Importação concluída'), findsOneWidget);
    // Importar de novo exige nova simulação.
    expect(habilitado(tester, 'Importar'), isFalse);
  });

  testWidgets('mostra o erro da Function', (tester) async {
    final (importador, _, _) = await abrir(tester);
    importador.erro = const ErroImportacao(
      'Só a Divisão de Estágio importa convênios.',
    );
    await tester.tap(find.text('Escolher arquivo XML'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Simular (não grava)'));
    await tester.pumpAndSettle();
    expect(
      find.text('Só a Divisão de Estágio importa convênios.'),
      findsOneWidget,
    );
    expect(habilitado(tester, 'Importar'), isFalse);
  });

  testWidgets('arquivo que não é UTF-8 é recusado antes de enviar', (
    tester,
  ) async {
    final (importador, _, _) = await abrir(
      tester,
      escolhidos: [
        ArquivoImportacao('latin1.xml', Uint8List.fromList([0x3c, 0xe7])),
      ],
    );
    await tester.tap(find.text('Escolher arquivo XML'));
    await tester.pumpAndSettle();
    expect(find.textContaining('não está em UTF-8'), findsOneWidget);
    expect(habilitado(tester, 'Simular (não grava)'), isFalse);
    expect(importador.chamadas, isEmpty);
  });

  group('planilhas da Divisão', () {
    testWidgets('aceita as duas planilhas juntas e mostra as situações', (
      tester,
    ) async {
      final (importador, _, pedidos) = await abrir(
        tester,
        fonte: FonteImportacao.planilhas,
        escolhidos: [
          planilha('CONVÊNIOS PRIVADOS 2022-2026.xlsx'),
          planilha('CONVÊNIOS PÚBLICOS 2023-2026.xlsm'),
        ],
      );
      importador.situacoes = {
        'finalizado': 5,
        'em_tramitacao': 2,
        'cancelado': 1,
      };
      expect(find.text('Importar as planilhas da Divisão'), findsOneWidget);
      await tester.tap(find.text('Escolher planilhas'));
      await tester.pumpAndSettle();
      expect(pedidos, [
        ['xlsx', 'xlsm', 'vários'],
      ]);
      expect(find.textContaining('PRIVADOS'), findsOneWidget);
      expect(find.textContaining('PÚBLICOS'), findsOneWidget);

      await tester.tap(find.text('Simular (não grava)'));
      await tester.pumpAndSettle();
      expect(importador.arquivosRecebidos, hasLength(2));
      expect(find.text('  Finalizados'), findsOneWidget);
      expect(find.text('  Em tramitação'), findsOneWidget);
      expect(find.text('  Cancelados'), findsOneWidget);
    });

    testWidgets('recusa arquivo que não é planilha', (tester) async {
      final (importador, _, _) = await abrir(
        tester,
        fonte: FonteImportacao.planilhas,
        escolhidos: [planilha('convenios.xlsx'), planilha('notas.pdf')],
      );
      await tester.tap(find.text('Escolher planilhas'));
      await tester.pumpAndSettle();
      expect(
        find.text('notas.pdf não é uma planilha .xlsx ou .xlsm.'),
        findsOneWidget,
      );
      expect(habilitado(tester, 'Simular (não grava)'), isFalse);
      expect(importador.chamadas, isEmpty);
    });

    testWidgets('recusa planilhas acima de 7 MB juntas', (tester) async {
      final (importador, _, _) = await abrir(
        tester,
        fonte: FonteImportacao.planilhas,
        escolhidos: [
          planilha('a.xlsx', 4 * 1024 * 1024),
          planilha('b.xlsm', 4 * 1024 * 1024),
        ],
      );
      await tester.tap(find.text('Escolher planilhas'));
      await tester.pumpAndSettle();
      expect(find.text('As planilhas passam de 7 MB juntas.'), findsOneWidget);
      expect(habilitado(tester, 'Simular (não grava)'), isFalse);
      expect(importador.chamadas, isEmpty);
    });
  });
}
