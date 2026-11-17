# Contrato da API do grupo (provisório)

O Cosme criou uma API no Cloud Run que lê o grupo de estágios (função `ldap`). A Function `sincronizarPapel` pode consultá-la em vez de chamar a Directory API (`DIRECTORY_API_URL` e `GRUPO_EMAIL` em `functions/.env.<projeto>`). Este documento fixa o que a Function espera.

**Revisado em 17/11/2026** para a rota `/membros/me`. A versão anterior deste contrato (consulta por e-mail e identidade da Function) não chegou a ser implementada na API.

## Consulta

```
GET {DIRECTORY_API_URL}/me?email={GRUPO_EMAIL}
Authorization: Bearer <token de ID do Firebase de quem entrou>
```

- `DIRECTORY_API_URL`: `https://<serviço>.a.run.app/grupos/estagios/membros`, sem barra no fim.
- O parâmetro `email` é o **grupo** (`estagios.uff@id.uff.br`), não a pessoa.
- A pessoa sai do **token**: a API responde sobre o dono do token, e só sobre ele.

## Autenticação

- O app chama a `sincronizarPapel` com o token de ID do Firebase da pessoa (o SDK das *callable functions* manda esse token no cabeçalho `Authorization`). A Function confere o token e **repassa o mesmo cabeçalho** à API. Nenhuma chave é guardada.
- A API aceita só tokens de projetos Firebase que ela autorizou. **O projeto `estagiosuff` (e depois o de produção) precisa estar nessa lista**, e o token precisa trazer um e-mail `@id.uff.br` verificado.
- O token vale por até 1 hora; a Function o usa na hora, dentro da mesma chamada.

## Respostas

| Resposta | A Function entende |
|---|---|
| `200` com `{"ok": true, "member": {"email", "role", "status", ...}}` | Membro. Vale o `role` (`OWNER`, `MANAGER` ou `MEMBER`) se o `status` for `ACTIVE` ou estiver ausente; outro `status` não conta. |
| `404` com `{"ok": false, ...}` | Não está no grupo. |
| `404` sem esse corpo (rota que não existe, URL errada) | Erro: a Function não concede nem revoga nada, e o app pede para tentar de novo. Assim uma configuração errada não tira o acesso de todos. |
| `400`, `401`, `403`, `5xx` | Erro, como acima. |
| `200` cujo `member.email` não é o e-mail do token | Erro (a resposta seria de outra pessoa). |

A Function só usa `email`, `role` e `status`. A resposta traz outros dados pessoais (nome, foto, unidade, último login): a Function não os grava nem os registra.

## Pontos em aberto com o Cosme

- **Grupo inexistente e "não é membro" dão o mesmo 404.** Se `GRUPO_EMAIL` estiver errado, todos ficam sem acesso, sem erro. Ideal: códigos ou mensagens diferentes para os dois casos.
- **A resposta traz mais dados do que o necessário** (foto, unidade, último login). Para o sistema bastam `email`, `role` e `status` (LGPD: minimização).
- **A URL de listagem** (`GET …/membros`) também existe; confirmar que exige o mesmo token e quem pode usá-la.

## Segurança da própria API

- A URL **não pode** responder 200 sem credencial. Em 12/11/2026 a listagem respondeu 200 sem autenticação; em 17/11/2026 ela já respondia 401 sem token.
- Registrar nos logs o resultado, mas **não o corpo** nem o e-mail completo.
- A conta que ela representa no Workspace deve ser uma conta administrativa **dedicada**, só de leitura.
