# STEPS — Sistema de Estágios UFF (app Flutter + Firebase)

Estado em 28/10/2026: **Fase 0 quase fechada**. Falta só criar o projeto `prod`, que cabe ao Cosme, dono da conta e pagador (D25 decidida); passo a passo em `docs/CRIAR-PROD.md`. D24 decidida: página pública em HTML gerado. **Próximo: o Cosme criar o `prod`; depois a Fase 1.** A Fase 1 não começa antes de a Fase 0 fechar.

| Fase | Objetivo | Status | Complexidade |
|---|---|---|---|
| 0 | Fundação: ferramentas, projetos Firebase, emuladores, CI, protótipo | Em andamento: `firebase.json`, `.firebaserc`, regras fechadas e emuladores (Auth, Firestore, Hosting) validados; projeto Flutter criado (android, ios, web; `flutter_lints`; analyze, format e teste de fumaça verdes) e testes de regras do Firestore (`npm run test:rules`); pipeline local `tools/ci` verde e GitHub Actions (`.github/workflows/ci.yml`, ainda não rodou no GitHub); Functions em TypeScript com teste; protótipo (login, lista e tela de convênio) funcionando no navegador contra os emuladores, com seed fictício. protótipo também validado num emulador Android (login, lista e tela de convênio). **Falta: `prod` (bloqueado por D25)** | Média |
| 1 | MVP de convênios com paridade à versão Django | Pendente | Média |
| 2 | Solicitação externa via gov.br | Pendente | Média |
| 3 | TCE e ciclo do estágio | Fora do escopo atual | Alta |

Toda fase entrega as melhorias sobre o SIGAA que lhe cabem (REQUIREMENTS §4.0) e só fecha com elas testadas.

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
