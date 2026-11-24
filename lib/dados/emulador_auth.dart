// Na web, liga o Auth ao emulador antes de o plugin restaurar a sessão guardada.
// Fora da web não há nada a fazer: o SDK nativo aceita `useAuthEmulator` depois.
export 'emulador_auth_stub.dart'
    if (dart.library.js_interop) 'emulador_auth_web.dart';
