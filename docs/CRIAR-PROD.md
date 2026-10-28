# Criar o projeto Firebase `prod`

Quem executa: **Cosme (cosmefc@id.uff.br)**, dono da conta Google Cloud e pagador (D25, 28/10/2026). Nada disso é feito pelo Claude nem pela CI: é uma ação manual na conta dele.

## Antes de começar

- **Plano Blaze:** as Functions e o Hosting com domínio próprio exigem o plano Blaze (pago por uso; para o volume atual o custo esperado é zero). Dono e pagador: Cosme (D25, decidido em 28/10/2026), que ativa o faturamento na conta dele.
- Confirmar o nome do projeto. Proposta: `estagios-uff-prod`. O `dev` é `estagiosuff`.

## Passos

1. Console do Firebase → **Adicionar projeto** com o nome definido. Não habilitar Google Analytics sem decisão da equipe.
2. **Firestore:** criar o banco `(default)` no modo produção, na região `southamerica-east1` (B6). As regras vêm do repositório (`firestore.rules`), nunca editadas pelo console.
3. **Authentication:** habilitar só o provedor que a Fase 1 usar. O login gov.br é da Fase 2 (D10).
4. **Hosting:** habilitar o site padrão. Domínio próprio fica para depois (depende da STI).
5. **Plano Blaze:** o Cosme ativa o faturamento.
6. Dar acesso (papel Editor ou menor) só às pessoas da equipe que fazem o deploy.

## O que registrar no repositório (em PR)

- O ID do projeto como alias `prod` no `.firebaserc`.
- A confirmação em `STEPS.md` e `ARCHITECTURE.md` (B7): "`prod` criado em <data>".

## O que nunca entra no repositório

- `firebase_options.dart` ou `google-services.json` de `prod`, chaves de serviço e tokens. A CI gera o que precisar a partir de segredos do GitHub.
- Dados reais. O primeiro deploy de `prod` só acontece com a Fase 1 homologada.

## Verificação

- `firebase projects:list` mostra o projeto, e `firebase use prod` funciona na máquina de quem faz o deploy.
- Nenhum emulador nem teste local aponta para `prod`: o desenvolvimento segue em `demo-estagios-uff`.
