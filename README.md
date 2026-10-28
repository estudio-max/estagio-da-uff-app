# Sistema de Estágios UFF — app Flutter + Firebase

Versão multiplataforma (Android, iOS, web) do sistema de convênios de estágio da PROGRAD/UFF, sobre Firebase.

**Situação (07/10/2026):** só documentação; a plataforma ainda está em decisão. Comece por:

- [docs/DECISAO-PLATAFORMA.md](docs/DECISAO-PLATAFORMA.md): as opções (Firestore, Data Connect, Django como API) e a recomendação;
- [REQUIREMENTS.md](REQUIREMENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [STEPS.md](STEPS.md).

A versão Django em funcionamento, que é a referência funcional e de testes, está em [estudio-max/estagio-da-uff](https://github.com/estudio-max/estagio-da-uff).

## Ferramentas (Fase 0)

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (canal estável) no PATH;
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`;
- Java 21 (Firebase Emulator Suite) e Node.js (Cloud Functions).

Os comandos de instalação, emuladores e pipeline entram aqui na Fase 0.

### Estado na máquina de desenvolvimento (07/10/2026)

| Ferramenta | Situação |
|---|---|
| Flutter 3.47.6 (estável), Dart 3.13.5 | Instalado em `C:\src\flutter`, no PATH do usuário |
| Firebase CLI 15.32.1 | Instalado (`npm install -g firebase-tools`) |
| Web (Chrome) | Pronto |
| Android | Falta SDK 36 e Build Tools 28.0.3 (Android Studio → SDK Manager) |
| Windows desktop | Fora do plano (exigiria completar o Visual Studio) |

## Como rodar localmente (Fase 0)

Tudo contra o Firebase Emulator Suite, com o projeto fictício `demo-estagios-uff`; nada toca a nuvem.

```bash
firebase emulators:start --project demo-estagios-uff   # terminal 1
npm run seed                                           # terminal 2: dados e usuário fictícios
flutter run -d chrome                                  # terminal 2: o app
```

O seed cria `divisao@exemplo.test` (papel `divisao`, vê tudo) e `externo@exemplo.test` (sem papel, é barrado), ambos com a senha `senha-de-teste`, 6 concedentes e 7 convênios fictícios (`tools/seed.mjs`). Antes de abrir PR: `./tools/ci` (formatação, análise, testes Flutter, de regras e das Functions); o GitHub Actions roda o mesmo script.

### Android

No emulador Android o app usa `10.0.2.2` para chegar aos emuladores do Firebase; o manifesto de **debug** libera HTTP sem criptografia (`usesCleartextTraffic`), pois eles falam HTTP. O manifesto de release não tem essa permissão. Em máquinas com pouca memória, limite o Gradle em `~/.gradle/gradle.properties` (ex.: `org.gradle.jvmargs=-Xmx2G`), porque o padrão do projeto pede 8 GB.
