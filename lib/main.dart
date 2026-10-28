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

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: _opcoesEmulador);
  // No emulador Android, o host da máquina é 10.0.2.2.
  final host = !kIsWeb && defaultTargetPlatform == TargetPlatform.android
      ? '10.0.2.2'
      : '127.0.0.1';
  await FirebaseAuth.instance.useAuthEmulator(host, 9099);
  FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
  runApp(
    App(
      auth: FirebaseAuth.instance,
      repo: FirestoreRepositorio(
        FirebaseFirestore.instance,
        FirebaseAuth.instance,
      ),
    ),
  );
}

class App extends StatelessWidget {
  const App({required this.auth, required this.repo, super.key});

  final FirebaseAuth auth;
  final Repositorio repo;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Estágios UFF',
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
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
