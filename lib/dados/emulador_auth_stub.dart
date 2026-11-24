import 'package:firebase_core/firebase_core.dart';

/// Ver `emulador_auth_web.dart`. No Android e no iOS, `useAuthEmulator` basta.
Future<void> prepararAuthNoEmulador(
  FirebaseOptions opcoes, {
  required String host,
  required int porta,
}) async {}
