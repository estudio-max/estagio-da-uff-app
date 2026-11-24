# STEPS — Sistema de Estágios UFF (app Flutter + Firebase)

Estado em 20/11/2026: **Fase 0 fechada, exceto o projeto `prod`** (cabe ao Cosme, `docs/CRIAR-PROD.md`). **Fase 1 aberta por exceção (projeto piloto): 1a, 1b e 1d na `main`** (concedentes, convênios, etapas e histórico; importação do XML do Drupal; alertas de vencimento), e **login com Google e papéis por grupo (D26) na `main` e em uso no `estagiosuff`** (a Function `sincronizarPapel` lê o grupo pela API do Cosme, `docs/API-GRUPO.md`). **Plano Blaze ativo no `estagiosuff`**, com as Functions da 1b (XML e planilhas) da 1c (página pública em https://estagiosuff.web.app/convenios) e da 1e (painel) publicadas em 20/11/2026; a dos alertas (1d) espera a conta de envio. **1c**, **1e** e a importação das planilhas da Divisão (D28) na `main`. **Demonstração publicada** em https://estagiosuff.web.app (código, seed e manual no PR 4); em 24/11/2026, o site foi publicado de novo com a identidade visual da Divisão de Estágio (PR 23), e a Function `paginaPublica`, com o nome fantasia abaixo da razão social (PR 21). Decididas: D23, D24, D25, D26. **Aberta: D27** (acesso externo das concedentes, com login). A STI é ignorada até a migração para a UFF.

| Fase | Objetivo | Status | Complexidade |
|---|---|---|---|
| 0 | Fundação: ferramentas, projetos Firebase, emuladores, CI, protótipo | Em andamento: `firebase.json`, `.firebaserc`, regras fechadas e emuladores (Auth, Firestore, Hosting) validados; projeto Flutter criado (android, ios, web; `flutter_lints`; analyze, format e teste de fumaça verdes) e testes de regras do Firestore (`npm run test:rules`); pipeline local `tools/ci` verde e GitHub Actions (`.github/workflows/ci.yml`, ainda não rodou no GitHub); Functions em TypeScript com teste; protótipo (login, lista e tela de convênio) funcionando no navegador contra os emuladores, com seed fictício. protótipo também validado num emulador Android (login, lista e tela de convênio). **Falta: `prod` (bloqueado por D25)** | Média |
| 1 | MVP de convênios com paridade à versão Django | Em andamento: **1a** feita no app (domínio, regras do Firestore, telas e histórico, com os casos de teste portados); falta homologar. **1b** feita (Function de importação com os casos de teste portados e tela de envio no app; também importa as planilhas da Divisão, D28), publicada no `estagiosuff` em 20/11/2026; falta rodar com o XML real. **1d** feita com a premissa da D3 (Function agendada, filtro e alertas no app, casos de teste portados); falta SMTP no projeto e as respostas de D3 e D21. **1c** feita com a premissa da D2 (página pública em `/convenios`, gerada por Function, casos de teste portados), publicada no `estagiosuff` em 20/11/2026 e atualizada em 24/11/2026. **1e** feita com a premissa da D4 (Function `painelConvenios` e tela do painel, casos de teste portados), publicada no `estagiosuff` em 20/11/2026 | Média |
| 2 | Solicitação externa via gov.br | Pendente | Média |
| 3 | TCE e ciclo do estágio | Fora do escopo atual | Alta |

Toda fase entrega as melhorias sobre o SIGAA que lhe cabem (REQUIREMENTS §4.0) e só fecha com elas testadas.

## Para continuar em outra máquina (ex.: o Cosme)

1. `git clone https://github.com/estudio-max/estagio-da-uff-app.git` e `./tools/ci` (precisa de Flutter, Node 22, Java 21 e Firebase CLI). Deve fechar verde.
2. Desenvolvimento local: emuladores + `npm run seed` + `flutter run -d chrome` (ver `README.md`).
3. **Nenhum PR de código aberto.** Os PRs 4 a 19 já estão na `main` (a revisão de outro desenvolvedor continua exigida pelo `CLAUDE.md`).
4. **O que não está no GitHub, de propósito:** a senha da demonstração (pedir a quem a recebeu), a chave de serviço do `estagiosuff` (apagar depois da apresentação) e o `firebase login`. A configuração do app na nuvem vai por `--dart-define` (ver `docs/DEMO-NUVEM.md`).

### Pendências com dono

| Pendência | Quem |
|---|---|
| Publicar no `estagiosuff` a Function dos alertas (1d), depois da conta de envio. As demais (importações, página pública e painel) foram publicadas em 20/11/2026, com o segredo `SMTP_URL` criado com um valor provisório só para o deploy passar (ele confere os segredos de todas as Functions). Ao publicar, usar `--only` com as Functions e o `firebase-tools` do npm: o `firebase` avulso falha na etapa de build (`/bin/sh: Illegal option --`) | Equipe, depois da conta de envio |
| Criar o projeto `prod` (`docs/CRIAR-PROD.md`) | Cosme |
| SMTP para os alertas (1d): uma conta de envio institucional (ex.: caixa `nao-responda` ou da Divisão), trocar o valor do segredo (`firebase functions:secrets:set SMTP_URL --project estagiosuff`, formato `smtps://usuario:senha@host:465`) e pôr `EMAIL_REMETENTE`, `APP_URL` e `DIVISAO_EMAIL` no `.env` do projeto | A definir (STI ou Divisão) |
| D27: como a concedente entra (gov.br, e-mail com link ou Google), como se liga à empresa e o que vê | Cliente + equipe |
| D28: confirmar a correspondência ETAPA → situação, aditivos como convênios próprios e o que fazer com os 334 convênios em tramitação há mais de um ano (relatório da importação) | PROGRAD |

### Próximos incrementos

Pelo desenho atual: acesso externo das concedentes conforme a D27 (depois de a PROGRAD confirmar a premissa). A 1e foi feita com a premissa da D4 (painel só da Divisão) e espera a resposta; a D22 (renovação) não faz parte do painel do Django e precisa ser refeita com os dados das planilhas; a 1c foi feita com a premissa da D2 e ainda espera a resposta; a 1d foi feita com a premissa da D3 e ainda espera D3 e D21. Com o Blaze ativo, a 1b já pode rodar com o XML real no `dev`, com a Function da importação já publicada (o XML não entra no repositório).

## Fase 0 — Fundação

- **Inclui:**
  - Flutter SDK e Firebase CLI instalados (feito nesta máquina em 07/10/2026; Android SDK 36 pendente, ver README);
  - projeto Flutter (`flutter create`), lint (`flutter analyze` com `very_good_analysis` ou `flutter_lints`) e formatação (`dart format`);
  - projetos Firebase `dev` e `prod` na região `southamerica-east1`;
  - Emulator Suite (Auth, Data Connect/Firestore, Functions, Hosting);
  - pipeline local `tools/ci` e GitHub Actions (analyze, format, testes Flutter, testes das Functions, testes de regras/`@auth` no emulador);
  - um protótipo mínimo: login → lista de convênios → tela de convênio, contra o emulador.
- **Pré-requisitos:** D23 (banco) decidido; conta Google Cloud com dono definido (D25: Cosme, cosmefc@id.uff.br, definido em 28/10/2026).
- **Critério de conclusão:** pipeline local e CI verdes; o protótipo roda no navegador e num emulador Android.
- **Riscos:** curva de aprendizado de Dart/Flutter; o Data Connect é um produto mais novo que o Firestore.

## Fase 1 — MVP de convênios (paridade com o Django)

Mesmos incrementos da versão Django, cada um com os **mesmos casos de teste** portados:

1. **1a** — Concedente, convênio e etapas; cadastro no app; histórico de alterações (RF01, RF02, RF08).
2. **1b** — Importação do XML do Drupal por Function (RF07); idempotente pelo `id_drupal`, relatório de rejeitados e avisos. *Feita (Function, tela de envio no app e testes); falta rodar com o XML real.* **Planilhas da Divisão (20/11/2026):** por decisão do cliente, os convênios vêm das planilhas internas, só de 2022 em diante (D28); o XML do site fica para os anteriores, se vierem. *Feita (Function `importarConveniosPlanilhas`, tela no app, testes) e rodada no emulador com as planilhas reais; falta a PROGRAD confirmar a D28 (a Function está publicada no `estagiosuff`; as planilhas reais só entram lá depois da confirmação).*
3. **1c** — Página pública em HTML com busca e selo "a partir de" (RF03, RF04, RN01, RN08, MS06, MS07). *Feita com a premissa da D2 (Function `paginaPublica`, rotas no Hosting, testes); publicada no `estagiosuff` em 20/11/2026. O acesso externo das concedentes (D27) fica fora.*
4. **1d** — Alertas de vencimento: Function agendada diária (RF05, MS01 parcial). *Feita com a premissa da D3 (Function, filtro e alertas no app, testes); falta SMTP no projeto e as respostas de D3 e D21.*
5. **1e** — Painel com indicadores e gráficos no app (RF06, MS05 parcial). *Feita com a premissa da D4 (Function `painelConvenios`, tela no app, testes); publicada no `estagiosuff` em 20/11/2026.*

- **Critério de conclusão:** os casos de teste da versão Django passam na nova plataforma; homologação com a Divisão; decisão de qual versão vai para produção.

## Fases 2 e 3

Como na versão Django: replanejar depois da Fase 1 em produção.
