# Configurar o login com Google e o grupo (D26)

Como o sistema decide quem entra: a pessoa entra com a conta Google `@id.uff.br`; uma Function (`sincronizarPapel`) pergunta ao Google se ela está no grupo `estagios.uff@id.uff.br` e, se estiver, grava a marca `divisao` na conta. As regras do Firestore (RN04) só olham essa marca.

```
Entrar com Google → app chama sincronizarPapel → Function consulta o grupo (Directory API)
   → é membro? grava divisao=true → app relê a marca → libera a Divisão
```

Quem executa: o Cosme (dono do projeto `estagiosuff`), com apoio de quem tem acesso à conta de serviço da integração.

## O que o sistema exige, e onde é conferido

| Regra | Onde |
|---|---|
| E-mail verificado e terminado em `@id.uff.br` | Na Function (a dica `hd` da tela é só visual) |
| Estar no grupo, com papel que dá acesso | Na Function, pela Directory API |
| Só `divisao` lê e escreve os dados | Regras do Firestore |

**Papéis do grupo.** No Google cada pessoa tem **um** papel no grupo (Proprietário, Gerente ou Membro), e Proprietário e Gerente já são membros. Os três dão acesso ao sistema (`PAPEIS_COM_ACESSO=OWNER,MANAGER,MEMBER`), como decidido em 11/11/2026, inclusive o Proprietário. Para tirar o acesso de um papel, retire-o dessa lista.

## Passos

### 1. Console do Firebase (projeto `estagiosuff`)

- *Authentication → Método de login → Adicionar novo provedor → Google*: ativar e escolher o e-mail de suporte.
- *Authentication → Configurações → Domínios autorizados*: conferir que `estagiosuff.web.app` está na lista.
- Manter o cadastro aberto desligado (já está).

### 2. APIs no projeto `estagiosuff`

Ativar **IAM Service Account Credentials API** (`iamcredentials.googleapis.com`). O deploy da Function ativa as demais (Cloud Functions, Cloud Build, Artifact Registry).

### 3. Permissão para assinar como a conta com delegação

A conta de serviço com a delegação em todo o domínio já autorizada (`DIRECTORY_SA`) precisa aceitar que a conta que roda a Function a represente. Dê a papel **Criador de token de conta de serviço** (`roles/iam.serviceAccountTokenCreator`) **nessa conta de serviço** à conta padrão da Function:

```
<numero-do-projeto>-compute@developer.gserviceaccount.com
```

O número do projeto `estagiosuff` aparece em *Configurações do projeto*. Sem chave e sem arquivo: só essa permissão de impersonação. A concessão é feita no projeto que hospeda a conta de serviço, por quem administra lá.

A delegação precisa ter o escopo `https://www.googleapis.com/auth/admin.directory.group.member.readonly` (a equipe já informou que a conta o tem), e a **Admin SDK API** precisa estar ativa no projeto dessa conta.

### 4. Valores da Function

Copie `functions/.env.example` para `functions/.env.estagiosuff` e preencha:

- `GRUPO_EMAIL`: `estagios.uff@id.uff.br`
- `DIRECTORY_SA`: e-mail da conta de serviço com a delegação
- `DIRECTORY_SUBJECT`: o administrador do Workspace que a delegação representa (só leitura). **Use uma conta administrativa dedicada a este sistema**, não a de uma pessoa: se a pessoa sair, o login de todos para de funcionar.

O arquivo não vai ao repositório (`.gitignore`).

### 5. Publicar

```bash
firebase deploy --only functions --project estagiosuff
```

Depois, recompilar e publicar o site (o botão do Google só aparece no build da nuvem), como em `docs/DEMO-NUVEM.md`.

### 6. Montar o grupo

Os atuais Proprietário e Gerentes já são membros. Acrescente os **Membros** que vão usar o sistema (Google Grupos, aba *Membros*).

## Como testar

1. Entrar com a conta de um Membro: deve abrir a lista de convênios.
2. Remover essa pessoa do grupo e entrar de novo: deve aparecer "não tem acesso".
3. Entrar com um Google de fora de `id.uff.br`: deve ser barrado.
4. Os logins de demonstração por e-mail e senha continuam funcionando.

## Se algo falhar

| Sintoma | Causa provável |
|---|---|
| "Não foi possível confirmar seu acesso agora" | A Function não conseguiu consultar o grupo; veja os logs da `sincronizarPapel` |
| Log com `assinatura do JWT: HTTP 403` | Falta o papel de criador de token (passo 3) ou a API do passo 2 |
| Log com `troca do token: HTTP 400/401` | A delegação não cobre o escopo, ou o `DIRECTORY_SUBJECT` não é administrador |
| Log com `consulta ao grupo: HTTP 403` | A conta representada não tem função de leitura de grupos |
| Pessoa no grupo, mas sem acesso | O e-mail da conta Google é outro; ou o papel dela não está em `PAPEIS_COM_ACESSO` |

## O que vale saber

- Se o grupo não puder ser consultado, a Function **não concede e não revoga**: quem já tinha acesso mantém o que tem até a marca expirar.
- A remoção do grupo vale no **próximo login** (a marca antiga dura até cerca de uma hora).
- A leitura considera só **membros diretos** do grupo, não grupos dentro de grupos.
- Nenhuma chave de serviço entra no repositório; o `.env` guarda e-mails, não segredos.
