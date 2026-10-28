import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'auth/login_page.dart';
import 'dados/firestore_repositorio.dart';
import 'dados/repositorio.dart';
import 'telas/home.dart';

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
  }
  runApp(
    App(
      auth: FirebaseAuth.instance,
      demo: _nuvem,
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
    super.key,
  });

  final FirebaseAuth auth;
  final Repositorio repo;

  /// Demonstração publicada: avisa que os dados são fictícios.
  final bool demo;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Estágios UFF',
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    builder: (context, child) => Column(
      children: [
        if (demo)
          Material(
            color: Colors.amber.shade200,
            child: const SizedBox(
              width: double.infinity,
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  'Demonstração: protótipo com dados fictícios',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Colors.black87),
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
          );
        }
        return _ExigeDivisao(
          user: user,
          onSair: auth.signOut,
          child: Home(repo: repo, onSair: auth.signOut),
        );
      },
    ),
  );
}

/// RN04: só o papel `divisao` entra; as regras do Firestore reforçam no servidor.
class _ExigeDivisao extends StatelessWidget {
  const _ExigeDivisao({
    required this.user,
    required this.onSair,
    required this.child,
  });

  final User user;
  final VoidCallback onSair;
  final Widget child;

  @override
  Widget build(BuildContext context) => FutureBuilder<IdTokenResult>(
    future: user.getIdTokenResult(true),
    builder: (context, snap) {
      if (!snap.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (snap.data!.claims?['divisao'] == true) return child;
      return Scaffold(
        appBar: AppBar(
          title: const Text('Estágios UFF'),
          actions: [
            IconButton(
              tooltip: 'Sair',
              icon: const Icon(Icons.logout),
              onPressed: onSair,
            ),
          ],
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Este usuário não pertence à Divisão de Estágio e não tem acesso.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    },
  );
}
