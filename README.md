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
(cd functions && npm run build)                        # as Functions rodam do JS compilado
firebase emulators:start --only auth,firestore,functions --project demo-estagios-uff   # terminal 1
npm run seed                                           # terminal 2: dados e usuário fictícios
flutter run -d chrome                                  # terminal 2: o app
```

O seed cria `divisao@exemplo.test` (papel `divisao`, vê tudo) e `externo@exemplo.test` (sem papel, é barrado), ambos com a senha `senha-de-teste`, 6 concedentes e 7 convênios fictícios (`tools/seed.mjs`). Antes de abrir PR: `./tools/ci` (formatação, análise, testes Flutter, de regras e das Functions, incluindo o teste das Functions contra o emulador); o GitHub Actions roda o mesmo script.

### Alertas de vencimento no emulador (1d, RF05)

A Function `enviarAlertasVencimento` roda sozinha todo dia às 07h (Brasília) no projeto. No emulador, o agendamento não dispara: a lógica é coberta por `npm test` e pelo teste contra o emulador (`npm run test:emulador`, em `functions/`). Sem o segredo `SMTP_URL`, o emulador só registra o e-mail no log. Para o projeto, configure `DIVISAO_EMAIL` e as demais variáveis em `functions/.env.<projeto>` (ver `functions/.env.example`) e crie o segredo com `firebase functions:secrets:set SMTP_URL --project <id>`.

### Importar um XML do Drupal no emulador (1b, RF07)

Para testar com volume. O comando recusa rodar sem `FIRESTORE_EMULATOR_HOST`, então não grava na nuvem. O XML real nunca entra no repositório (`conveniosestagio.xml` e `reports/` estão no `.gitignore`).

```bash
(cd functions && npm run build)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/lib/importarCli.js conveniosestagio.xml --simular
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/lib/importarCli.js conveniosestagio.xml
```

O relatório de rejeitados e avisos sai em `reports/importacao.csv` (separado por `;`, abre no Excel).

Pelo app, a Divisão usa o botão **Importar do estagio.uff.br** na barra do topo: escolhe o XML, simula (nada é gravado), confere as contagens, salva o relatório se quiser e só então importa, com confirmação. O app chama a Function `importarConveniosDrupal`, que só aceita o papel `divisao`; localmente, ela roda no emulador de Functions.

### Android

No emulador Android o app usa `10.0.2.2` para chegar aos emuladores do Firebase; o manifesto de **debug** libera HTTP sem criptografia (`usesCleartextTraffic`), pois eles falam HTTP. O manifesto de release não tem essa permissão. Em máquinas com pouca memória, limite o Gradle em `~/.gradle/gradle.properties` (ex.: `org.gradle.jvmargs=-Xmx2G`), porque o padrão do projeto pede 8 GB.

Para publicar a demonstração na nuvem (projeto `dev`), ver `docs/DEMO-NUVEM.md`.

Manual para quem usa o sistema (linguagem simples): `docs/MANUAL-USUARIO.md`.
