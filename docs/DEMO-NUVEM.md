# Demonstração na nuvem (projeto `dev`)

Publica o protótipo em `https://estagiosuff.web.app` para o cliente abrir de qualquer lugar. Só dados fictícios.

**Quem executa:** o Cosme (cosmefc@id.uff.br), dono da conta do projeto `estagiosuff` (D25), ou alguém que ele autorize. Nada aqui entra no repositório: chave, senha e credenciais ficam só na máquina de quem executa.

> Exceção ao "desenvolvimento local só no emulador" (`CLAUDE.md`), autorizada em 28/10/2026 para a demonstração. O projeto `prod` não é tocado, e o `tools/seed.mjs` recusa rodar contra projeto `demo-*` ou com `prod` no nome.

## Pré-requisitos

- Firebase CLI e Flutter instalados; Node 22.
- `firebase login` com a conta do Cosme.
- Para o seed: um JSON de conta de serviço (console → Configurações do projeto → Contas de serviço → Gerar nova chave privada), guardado **fora** do repositório e apontado por `GOOGLE_APPLICATION_CREDENTIALS`. Apague a chave depois da demonstração. (Alternativa: `gcloud auth application-default login`.)

## Estado em 28/10/2026

Já feitos no console do `estagiosuff`: Authentication com E-mail/senha ativado e **cadastro aberto desligado**; Firestore `(default)` em `southamerica-east1` (modo produção); app web "Estágios UFF" registrado e Hosting vinculado ao site `estagiosuff`. Faltam o deploy (passo 5) e o seed (passo 6), que dependem de login do CLI e de credencial de serviço.

## Passos

1. **Authentication** (console do Firebase, projeto `estagiosuff`): em *Sign-in method*, habilite **E-mail/senha**. Em *Settings → User actions*, **desmarque "Enable create (sign-up)"** para ninguém se cadastrar sozinho.
2. **Firestore** (console): se ainda não existir, crie o banco `(default)` no modo produção, região `southamerica-east1`.
3. **App web:** crie o app e pegue a configuração (o ID do app aparece na saída do primeiro comando).

   ```bash
   firebase apps:create web "Estágios UFF" --project estagiosuff
   firebase apps:sdkconfig web <APP_ID> --project estagiosuff
   ```

4. **Build** com a configuração (a chave web do Firebase não é segredo, mas não vai para o repositório):

   ```bash
   flutter build web --release \
     --dart-define=FIREBASE_API_KEY=<apiKey> \
     --dart-define=FIREBASE_APP_ID=<appId> \
     --dart-define=FIREBASE_SENDER_ID=<messagingSenderId> \
     --dart-define=FIREBASE_PROJECT_ID=estagiosuff \
     --dart-define=FIREBASE_AUTH_DOMAIN=estagiosuff.firebaseapp.com
   ```

5. **Deploy** das regras e do site:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,hosting --project estagiosuff
   ```

6. **Dados e usuários fictícios** (escolha uma senha forte, com 12 ou mais caracteres):

   ```bash
   SEED_ALVO=nuvem CONFIRMO_NUVEM=sim FIREBASE_PROJECT_ID=estagiosuff SEED_SENHA='<senha forte>' npm run seed
   ```

   Cria `divisao@exemplo.test` (papel `divisao`, vê tudo) e `externo@exemplo.test` (sem papel, é barrado). Rodar de novo recria os dois usuários e regrava os dados do seed.

7. Abra `https://estagiosuff.web.app`; o app mostra a faixa "Demonstração: protótipo com dados fictícios". Envie ao cliente o endereço e a senha por canais separados.

## Depois da apresentação

- Tirar o site do ar: `firebase hosting:disable --project estagiosuff`.
- Apagar os usuários de demonstração no console (*Authentication → Users*) ou trocar a senha.
- Não há custo no plano gratuito (Spark) para este volume.

## O que protege a demonstração

- As regras do Firestore (RN04) só deixam o papel `divisao` ler e escrever, e ninguém exclui; um usuário sem papel não vê nada.
- Sem cadastro aberto (passo 1), só quem recebeu a senha entra.
- Os dados são fictícios: nomes inventados e CNPJs gerados.
