# Sistema de Estágios UFF (app Flutter + Firebase) — instruções para o Claude

Projeto em equipe, todos usando Claude Code. Mudanças neste arquivo passam por PR.

## Fonte da verdade

Leia antes de qualquer tarefa:
- `REQUIREMENTS.md`: o quê, regras, critérios de aceitação, dúvidas pendentes (D…);
- `ARCHITECTURE.md`: como está construído e as decisões (B…);
- `STEPS.md`: fase atual;
- `docs/DECISAO-PLATAFORMA.md`: por que Firebase + Flutter e o que ainda está em aberto.

A versão Django ([estudio-max/estagio-da-uff](https://github.com/estudio-max/estagio-da-uff)) é a **referência funcional**. Ao portar uma regra, leia o código e os testes de lá e porte os **mesmos casos de teste**. Não reinvente a regra.

As **melhorias em relação ao SIGAA** (`REQUIREMENTS.md` §4.0, MS01…) são requisito fundamental: toda fase entrega e testa as que lhe cabem.

Não implemente nada fora da fase atual do `STEPS.md`. Enquanto D23 (banco) não for decidida, não escreva código de acesso a dados. Dúvida pendente (D#) não vira regra inventada: pergunte.

## Fluxo de trabalho em equipe

- Uma branch por incremento e PR para `main`; nunca commitar direto na `main`.
- O PR que muda comportamento atualiza no mesmo PR os documentos afetados.
- PR só com o pipeline local verde; merge só com o CI verde e a revisão de outro desenvolvedor.

## Regras

- Português nos documentos, nas mensagens de commit e na interface; código e identificadores em inglês.
- Nunca colocar no repositório credenciais, `google-services.json` ou `firebase_options.dart` de produção, o XML do Drupal ou dados reais. Testes e `dev` usam dados fictícios.
- Desenvolvimento local sempre contra o Firebase Emulator Suite, nunca contra `prod`.
- CPF não aparece em tela ou saída pública; se um requisito exigir, use a máscara do gov.br (`***.456.789-**`, RN08) e confirme antes.
- Toda regra de negócio nova vem com o seu teste.
