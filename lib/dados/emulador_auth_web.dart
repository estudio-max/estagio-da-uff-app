import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_core_web/firebase_core_web.dart';

/// Cria o app e o Auth do SDK JS já ligados ao emulador, antes de
/// `Firebase.initializeApp`.
///
/// Na web, `Firebase.initializeApp` cria o Auth (`initializeAuth`) e espera a
/// sessão guardada no IndexedDB ser restaurada. Restaurar valida o usuário na
/// rede (`accounts:lookup`, `securetoken`), e isso acontece antes de o
/// `useAuthEmulator` em `main.dart` rodar: com uma sessão guardada, essas
/// chamadas vão para o `googleapis.com` com a chave `demo-key`. Depois da
/// primeira chamada o SDK não aceita mais o emulador, e o plugin engole o erro
/// `auth/emulator-config-failed`, de modo que tudo segue para a nuvem.
/// O plugin só reaplica o emulador sozinho em modo debug e na mesma aba
/// (`sessionStorage`), o que não cobre `--release` nem uma aba nova.
///
/// A saída: importar os mesmos módulos que o plugin vai importar (mesma URL,
/// portanto a mesma instância de módulo no navegador), criar o app padrão e o
/// Auth com as mesmas opções que o plugin usa, e chamar `connectAuthEmulator`
/// antes de qualquer requisição. Depois, `Firebase.initializeApp` reaproveita
/// o app, e o `initializeAuth` do plugin devolve este Auth, que já está no
/// emulador quando a sessão é restaurada.
///
/// As opções de `initializeAuth` copiam `getAuthInstance` do
/// `firebase_auth_web` (6.3.2). Se o plugin as mudar, o SDK lança
/// `auth/already-initialized` na inicialização: falha visível, não silenciosa.
Future<void> prepararAuthNoEmulador(
  FirebaseOptions opcoes, {
  required String host,
  required int porta,
}) async {
  final versao =
      (globalContext['flutterfire_web_sdk_version'] as JSString?)?.toDart ??
      supportedFirebaseJsSdkVersion;
  final base = 'https://www.gstatic.com/firebasejs/$versao';
  final core = await importModule('$base/firebase-app.js'.toJS).toDart;
  final auth = await importModule('$base/firebase-auth.js'.toJS).toDart;
  // Hot restart: o app JS sobrevive e o Auth dele já está no emulador.
  if (core.callMethod<JSArray>('getApps'.toJS).toDart.isNotEmpty) return;

  final configuracao = JSObject()
    ..['apiKey'] = opcoes.apiKey.toJS
    ..['appId'] = opcoes.appId.toJS
    ..['messagingSenderId'] = opcoes.messagingSenderId.toJS
    ..['projectId'] = opcoes.projectId.toJS;
  final app = core.callMethod<JSObject>('initializeApp'.toJS, configuracao);

  final dependencias = JSObject()
    ..['errorMap'] = auth['debugErrorMap']
    ..['persistence'] = <JSAny?>[
      auth['indexedDBLocalPersistence'],
      auth['browserLocalPersistence'],
      auth['browserSessionPersistence'],
    ].toJS
    ..['popupRedirectResolver'] = auth['browserPopupRedirectResolver'];
  final instancia = auth.callMethod<JSObject>(
    'initializeAuth'.toJS,
    app,
    dependencias,
  );
  auth.callMethod<JSAny?>(
    'connectAuthEmulator'.toJS,
    instancia,
    'http://$host:$porta'.toJS,
  );
}
