import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'auth/login_page.dart';
import 'convenios/convenio.dart';
import 'convenios/convenios_page.dart';

// Projeto fictício do Emulator Suite (Fase 0): nada aponta para a nuvem.
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
  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Estágios UFF',
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
    home: StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.data == null) {
          return LoginPage(
            onEntrar: (email, senha) => FirebaseAuth.instance
                .signInWithEmailAndPassword(email: email, password: senha),
          );
        }
        return ConveniosPage(
          convenios: FirebaseFirestore.instance
              .collection('convenios')
              .orderBy('concedente')
              .snapshots()
              .map(
                (s) => [
                  for (final d in s.docs) Convenio.fromMap(d.id, d.data()),
                ],
              ),
          onSair: FirebaseAuth.instance.signOut,
        );
      },
    ),
  );
}
