# STEPS — Sistema de Estágios UFF (app Flutter + Firebase)

Estado em 28/10/2026 (fim do dia): **Fase 0 fechada, exceto o projeto `prod`** (cabe ao Cosme, `docs/CRIAR-PROD.md`). **Fase 1 aberta por exceção (projeto piloto): incremento 1a pronto e na `main`** (concedentes, convênios, etapas e histórico, com as regras reais do Firestore). **Demonstração publicada** em https://estagiosuff.web.app (código, seed e manual no PR 4). Decididas: D23, D24, D25, D26. **Aberta: D27** (acesso externo das concedentes, com login). A STI é ignorada até a migração para a UFF.

| Fase | Objetivo | Status | Complexidade |
|---|---|---|---|
| 0 | Fundação: ferramentas, projetos Firebase, emuladores, CI, protótipo | Em andamento: `firebase.json`, `.firebaserc`, regras fechadas e emuladores (Auth, Firestore, Hosting) validados; projeto Flutter criado (android, ios, web; `flutter_lints`; analyze, format e teste de fumaça verdes) e testes de regras do Firestore (`npm run test:rules`); pipeline local `tools/ci` verde e GitHub Actions (`.github/workflows/ci.yml`, ainda não rodou no GitHub); Functions em TypeScript com teste; protótipo (login, lista e tela de convênio) funcionando no navegador contra os emuladores, com seed fictício. protótipo também validado num emulador Android (login, lista e tela de convênio). **Falta: `prod` (bloqueado por D25)** | Média |
| 1 | MVP de convênios com paridade à versão Django | Em andamento: **1a** feita no app (domínio, regras do Firestore, telas e histórico, com os casos de teste portados); falta homologar. 1b a 1e pendentes | Média |
| 2 | Solicitação externa via gov.br | Pendente | Média |
| 3 | TCE e ciclo do estágio | Fora do escopo atual | Alta |

Toda fase entrega as melhorias sobre o SIGAA que lhe cabem (REQUIREMENTS §4.0) e só fecha com elas testadas.

## Para continuar em outra máquina (ex.: o Cosme)

1. `git clone https://github.com/estudio-max/estagio-da-uff-app.git` e `./tools/ci` (precisa de Flutter, Node 22, Java 21 e Firebase CLI). Deve fechar verde.
2. Desenvolvimento local: emuladores + `npm run seed` + `flutter run -d chrome` (ver `README.md`).
3. **PRs abertos para revisar e mergear** (a revisão de outro desenvolvedor é exigida pelo `CLAUDE.md`): o PR 4 (demonstração na nuvem e manual do usuário) e o PR 5 (decisões D26 e D27).
4. **O que não está no GitHub, de propósito:** a senha da demonstração (pedir a quem a recebeu), a chave de serviço do `estagiosuff` (apagar depois da apresentação) e o `firebase login`. A configuração do app na nuvem vai por `--dart-define` (ver `docs/DEMO-NUVEM.md`).

### Pendências com dono

| Pendência | Quem |
|---|---|
| Ativar o plano Blaze no `estagiosuff` (necessário para Functions) | Cosme |
| Criar o grupo do Google em `id.uff.br` e dar à conta de serviço permissão para ler os membros (D26) | Cosme |
| Criar o projeto `prod` (`docs/CRIAR-PROD.md`) | Cosme |
| D27: como a concedente entra (gov.br, e-mail com link ou Google), como se liga à empresa e o que vê | Cliente + equipe |

### Próximos incrementos

Pelo desenho atual: **login Google e papéis por grupo** (D26, depende do Blaze e do grupo), **1b** importação do XML do Drupal, **1c** página pública (HTML gerado, D24) e acesso externo conforme a D27, **1d** alertas de vencimento, **1e** painel.

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
2. **1b** — Importação do XML do Drupal por Function (RF07); idempotente pelo `id_drupal`, relatório de rejeitados e avisos.
3. **1c** — Página pública em HTML com busca e selo "a partir de" (RF03, RF04, RN01, RN08, MS06, MS07).
4. **1d** — Alertas de vencimento: Function agendada diária (RF05, MS01 parcial).
5. **1e** — Painel com indicadores e gráficos no app (RF06, MS05 parcial).

- **Critério de conclusão:** os casos de teste da versão Django passam na nova plataforma; homologação com a Divisão; decisão de qual versão vai para produção.

## Fases 2 e 3

Como na versão Django: replanejar depois da Fase 1 em produção.
