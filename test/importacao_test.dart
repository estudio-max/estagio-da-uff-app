// RF07: tela de importação do XML do Drupal, com a Function substituída por um falso.
import 'dart:convert';
import 'dart:typed_data';

import 'package:estagios_uff/dados/importacao.dart';
import 'package:estagios_uff/telas/importacao.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

class ImportadorFalso implements Importador {
  final chamadas = <bool>[];
  String? xmlRecebido;
  ErroImportacao? erro;

  @override
  Future<ResultadoImportacao> importar(
    String xml, {
    required bool simular,
  }) async {
    chamadas.add(simular);
    xmlRecebido = xml;
    if (erro case final e?) throw e;
    return ResultadoImportacao(
      lidos: 3,
      criados: 2,
      atualizados: 0,
      rejeitados: 1,
      avisos: 0,
      simulado: simular,
      csv: '﻿situação;nó no Drupal;título;motivo\r\n',
    );
  }
}

final arquivo = ArquivoXml(
  'conveniosestagio.xml',
  Uint8List.fromList(utf8.encode('﻿<nodes><node/></nodes>')),
);

Future<(ImportadorFalso, List<String>)> abrir(
  WidgetTester tester, {
  ArquivoXml? escolhido,
}) async {
  final importador = ImportadorFalso();
  final salvos = <String>[];
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: ImportacaoPage(
        importador: importador,
        escolherArquivo: () async => escolhido ?? arquivo,
        salvarRelatorio: (nome, _) async => salvos.add(nome),
      ),
    ),
  );
  return (importador, salvos);
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

  testWidgets('só importa depois de simular, e pede confirmação', (
    tester,
  ) async {
    final (importador, salvos) = await abrir(tester);
    expect(habilitado(tester, 'Simular (não grava)'), isFalse);

    await tester.tap(find.text('Escolher arquivo XML'));
    await tester.pumpAndSettle();
    expect(find.textContaining('conveniosestagio.xml'), findsOneWidget);
    expect(habilitado(tester, 'Importar'), isFalse);

    await tester.tap(find.text('Simular (não grava)'));
    await tester.pumpAndSettle();
    expect(importador.chamadas, [true]);
    expect(importador.xmlRecebido, '<nodes><node/></nodes>'); // sem o BOM
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
    final (importador, _) = await abrir(tester);
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
    final (importador, _) = await abrir(
      tester,
      escolhido: ArquivoXml('latin1.xml', Uint8List.fromList([0x3c, 0xe7])),
    );
    await tester.tap(find.text('Escolher arquivo XML'));
    await tester.pumpAndSettle();
    expect(find.textContaining('não está em UTF-8'), findsOneWidget);
    expect(habilitado(tester, 'Simular (não grava)'), isFalse);
    expect(importador.chamadas, isEmpty);
  });
}
