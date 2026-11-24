import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:file_picker/file_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import 'auth/login_page.dart';
import 'dados/firestore_repositorio.dart';
import 'dados/importacao.dart';
import 'dados/painel.dart';
import 'dados/repositorio.dart';
import 'telas/home.dart';
import 'telas/importacao.dart';
import 'telas/tema.dart';

// Projeto fictício do Emulator Suite: nada aponta para a nuvem.
const _opcoesEmulador = FirebaseOptions(
  apiKey: 'demo-key',
  appId: '1:000000000000:web:demo',
  messagingSenderId: '000000000000',
  projectId: 'demo-estagios-uff',
);

// Demonstração na nuvem (projeto dev): a configuração vem do build, nunca do
// repositório. Ex.: flutter build web --dart-define=FIREBASE_API_KEY=... (ver docs/DEMO-NUVEM.md).
const _chaveApi = String.fromEnvironment('FIREBASE_API_KEY');
const _nuvem = _chaveApi != '';
const _opcoesNuvem = FirebaseOptions(
  apiKey: _chaveApi,
  appId: String.fromEnvironment('FIREBASE_APP_ID'),
  messagingSenderId: String.fromEnvironment('FIREBASE_SENDER_ID'),
  projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
  authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
);

/// D26: entra com o Google, restrito a `@id.uff.br` na tela. O servidor é que exige o domínio.
Future<void> _entrarComGoogle() async {
  final provedor = GoogleAuthProvider()
    ..setCustomParameters({'hd': 'id.uff.br', 'prompt': 'select_account'});
  if (kIsWeb) {
    await FirebaseAuth.instance.signInWithPopup(provedor);
  } else {
    await FirebaseAuth.instance.signInWithProvider(provedor);
  }
}

FirebaseFunctions get _functions =>
    FirebaseFunctions.instanceFor(region: 'southamerica-east1');

/// RF07: a Divisão escolhe o XML exportado do Drupal.
Future<List<ArquivoImportacao>> _escolherArquivos(
  List<String> extensoes, {
  required bool varios,
}) async {
  final arquivos = varios
      ? await FilePicker.pickFiles(
          type: FileType.custom,
          allowedExtensions: extensoes,
        )
      : [
          ?await FilePicker.pickFile(
            type: FileType.custom,
            allowedExtensions: extensoes,
          ),
        ];
  return [
    for (final f in arquivos) ArquivoImportacao(f.name, await f.readAsBytes()),
  ];
}

Future<void> _salvarRelatorio(String nome, Uint8List bytes) =>
    FilePicker.saveFile(fileName: nome, bytes: bytes, mimeType: 'text/csv');

/// D26: confere o grupo do Google e grava a claim `divisao`. Só para quem entrou com Google.
Future<void> _sincronizarPapel(User user) async {
  if (!user.providerData.any((p) => p.providerId == 'google.com')) return;
  await _functions.httpsCallable('sincronizarPapel').call<void>();
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: _nuvem ? _opcoesNuvem : _opcoesEmulador,
  );
  if (!_nuvem) {
    // No emulador Android, o host da máquina é 10.0.2.2.
    final host = !kIsWeb && defaultTargetPlatform == TargetPlatform.android
        ? '10.0.2.2'
        : '127.0.0.1';
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    _functions.useFunctionsEmulator(host, 5001);
  }
  runApp(
    App(
      auth: FirebaseAuth.instance,
      demo: _nuvem,
      // O Google só existe na nuvem; o emulador não tem o grupo para consultar.
      onGoogle: _nuvem ? _entrarComGoogle : null,
      sincronizarPapel: _sincronizarPapel,
      painel: FunctionsPainel(_functions),
      telasImportacao: {
        'Planilhas da Divisão (2022 em diante)': (_) => ImportacaoPage(
          fonte: FonteImportacao.planilhas,
          importador: FunctionsImportadorPlanilhas(_functions),
          escolherArquivos: _escolherArquivos,
          salvarRelatorio: _salvarRelatorio,
        ),
        'Página do estagio.uff.br (XML)': (_) => ImportacaoPage(
          fonte: FonteImportacao.site,
          importador: FunctionsImportador(_functions),
          escolherArquivos: _escolherArquivos,
          salvarRelatorio: _salvarRelatorio,
        ),
      },
      repo: FirestoreRepositorio(
        FirebaseFirestore.instance,
        FirebaseAuth.instance,
      ),
    ),
  );
}

class App extends StatelessWidget {
  const App({
    required this.auth,
    required this.repo,
    this.demo = false,
    this.onGoogle,
    this.sincronizarPapel,
    this.telasImportacao = const {},
    this.painel,
    super.key,
  });

  final FirebaseAuth auth;
  final Repositorio repo;

  /// Demonstração publicada: avisa que os dados são fictícios.
  final bool demo;
  final Future<void> Function()? onGoogle;
  final Future<void> Function(User user)? sincronizarPapel;
  final Map<String, WidgetBuilder> telasImportacao;
  final FontePainel? painel;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Estágios UFF',
    theme: temaEstagios(),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    builder: (context, child) => Column(
      children: [
        if (demo)
          const Material(
            color: Cores.avisoFundo,
            child: SizedBox(
              width: double.infinity,
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 6, horizontal: 16),
                child: Text(
                  'Demonstração: protótipo com dados fictícios',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Cores.avisoTexto),
                ),
              ),
            ),
          ),
        Expanded(child: child ?? const SizedBox.shrink()),
      ],
    ),
    home: StreamBuilder<User?>(
      stream: auth.authStateChanges(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final user = snap.data;
        if (user == null) {
          return LoginPage(
            onEntrar: (email, senha) =>
                auth.signInWithEmailAndPassword(email: email, password: senha),
            onGoogle: onGoogle,
          );
        }
        return _ExigeDivisao(
          user: user,
          sincronizar: sincronizarPapel,
          onSair: auth.signOut,
          child: Home(
            repo: repo,
            onSair: auth.signOut,
            telasImportacao: telasImportacao,
            painel: painel,
            usuario: user.displayName ?? user.email,
          ),
        );
      },
    ),
  );
}

/// RN04: só o papel `divisao` entra; as regras do Firestore reforçam no servidor.
class _ExigeDivisao extends StatefulWidget {
  const _ExigeDivisao({
    required this.user,
    required this.onSair,
    required this.child,
    this.sincronizar,
  });

  final User user;
  final Future<void> Function(User user)? sincronizar;
  final VoidCallback onSair;
  final Widget child;

  @override
  State<_ExigeDivisao> createState() => _ExigeDivisaoState();
}

class _ExigeDivisaoState extends State<_ExigeDivisao> {
  late Future<IdTokenResult> _token = _carregar();

  // Sincroniza o papel (se houver) e só então lê a claim, já atualizada.
  Future<IdTokenResult> _carregar() async {
    await widget.sincronizar?.call(widget.user);
    return widget.user.getIdTokenResult(true);
  }

  Widget _aviso(String texto, {VoidCallback? tentarDeNovo}) => Scaffold(
    appBar: AppBar(
      title: const Text('Estágios UFF'),
      actions: [
        IconButton(
          tooltip: 'Sair',
          icon: const Icon(Icons.logout),
          onPressed: widget.onSair,
        ),
      ],
    ),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(texto, textAlign: TextAlign.center),
            if (tentarDeNovo != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                onPressed: tentarDeNovo,
                child: const Text('Tentar de novo'),
              ),
            ],
          ],
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => FutureBuilder<IdTokenResult>(
    future: _token,
    builder: (context, snap) {
      if (snap.hasError) {
        return _aviso(
          'Não foi possível confirmar seu acesso agora.',
          tentarDeNovo: () => setState(() => _token = _carregar()),
        );
      }
      if (!snap.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (snap.data!.claims?['divisao'] == true) return widget.child;
      return _aviso(
        'Este usuário não pertence à Divisão de Estágio e não tem acesso.',
      );
    },
  );
}
