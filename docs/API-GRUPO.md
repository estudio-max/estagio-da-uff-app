# Contrato da API do grupo (provisório)

O Cosme criou uma API no Cloud Run que lê o grupo de estágios. A Function `sincronizarPapel` pode consultá-la em vez de chamar a Directory API (`DIRECTORY_API_URL` em `functions/.env.<projeto>`). Este documento fixa o que a Function espera.

## Autenticação

- **O serviço deve exigir autenticação do Cloud Run** (não aceitar invocador anônimo).
- A Function se identifica com um **token de identidade do Google** (sem chave), cuja audiência é o endereço do serviço. O Cosme concede o papel **Invocador do Cloud Run** (`roles/run.invoker`) à conta que roda a Function: `<número-do-projeto>-compute@developer.gserviceaccount.com`.
- Chave de API compartilhada só se o Cloud Run não puder ser usado; nesse caso ela fica no Secret Manager, nunca no repositório.

## Consulta por pessoa

```
GET {DIRECTORY_API_URL}/{email}
```

`{email}` vai codificado na URL. O serviço atende um grupo só.

| Resposta | Significa |
|---|---|
| `200` com `{"role": "OWNER" \| "MANAGER" \| "MEMBER", "status": "ACTIVE"}` | A pessoa é membro. `status` ausente vale como ativo; qualquer outro valor não conta. |
| `404` | Não é membro. |
| `401`, `403`, `5xx` | Erro: a Function não concede nem revoga nada, e o app pede para tentar de novo. |

## Por que por pessoa, e não a lista inteira

- Devolve só o necessário: não expõe os e-mails dos outros membros a cada login (LGPD).
- A regra precisa do **papel** e do **status** de uma pessoa, não da lista.
- Evita paginação (a Directory API pagina acima de 200 membros).

## Segurança da própria API

- A URL **não pode** responder 200 sem credencial. Em 12/11/2026 a listagem respondeu 200 sem autenticação; fechar isso antes de a API receber qualquer uso.
- Registrar nos logs o resultado, mas **não o corpo** nem o e-mail completo.
- A conta que ela representa no Workspace deve ser uma conta administrativa **dedicada**, só de leitura.
