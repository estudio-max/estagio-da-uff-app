# Manual do usuário: Sistema de Estágios UFF

Para quem trabalha na **Divisão de Estágio** e vai cadastrar e acompanhar os convênios. Não precisa saber nada de informática: o passo a passo está em linguagem simples.

> **Versão de demonstração.** Os nomes, os CNPJs e os convênios que você verá são **inventados**. Pode mexer à vontade: nada aqui é real.

## O que o sistema faz

- Guarda os **convênios de estágio** da UFF com as **empresas e instituições** (as "concedentes").
- Mostra, de cada convênio, se ele está **vigente**, **vencido**, **a iniciar**, **em tramitação** ou **cancelado**. O sistema descobre isso sozinho, pelas datas; ninguém precisa digitar.
- Registra o **andamento do processo** (documentação recebida, análise, assinaturas etc.).
- Guarda o **histórico**: quem mexeu em cada convênio, quando e o que mudou.

## 1. Como entrar

1. Abra o endereço do sistema no navegador (Chrome, Edge ou Firefox, no computador ou no celular).
2. Digite seu **e-mail** e sua **senha**.
3. Toque em **Entrar**.

Se aparecer "E-mail ou senha inválidos", confira se digitou certo (cuidado com letras maiúsculas e minúsculas na senha) e tente de novo. Se continuar, peça uma nova senha a quem administra o sistema.

Se aparecer "Este usuário não pertence à Divisão de Estágio e não tem acesso", seu usuário ainda não foi liberado. Fale com quem administra.

Para **sair**, toque no ícone de porta com seta, no canto superior direito.

## 2. A tela principal

Embaixo da tela há duas abas:

- **Convênios**: a lista de todos os convênios.
- **Concedentes**: as empresas e instituições cadastradas.

## 3. Procurar um convênio

Na aba **Convênios**:

- **Busca:** digite no campo de cima parte do nome da concedente, o número do convênio (por exemplo, `PR-212/2026`) ou o número do processo SEI. A lista se ajusta enquanto você digita.
- **Filtros:** toque em um dos botões abaixo da busca para ver só um tipo de convênio. Toque em **Todos** para voltar a ver tudo.

O que significa cada etiqueta colorida:

| Etiqueta | Significa |
|---|---|
| **Vigente** (verde) | Convênio assinado e dentro do prazo. |
| **A iniciar** (azul) | Assinado, mas a vigência ainda não começou. |
| **Vencido** (vermelho) | O prazo acabou. |
| **Em tramitação** (laranja) | Ainda está sendo preparado; ainda não foi finalizado. |
| **Cancelado** (cinza) | Foi cancelado (por exemplo, cadastrado por engano). |

## 4. Ver os detalhes de um convênio

Toque no convênio na lista. Você verá:

- os **dados** (número, processo SEI, datas de vigência, situação, tipo de minuta, objeto, observações);
- o **andamento do processo**, com cada etapa e a data;
- o **histórico de alterações**, do mais novo para o mais antigo.

Para voltar à lista, use a seta no canto superior esquerdo.

## 5. Cadastrar uma nova concedente

**Antes de cadastrar um convênio, a empresa ou instituição precisa estar cadastrada.**

1. Abra a aba **Concedentes** e toque em **Nova concedente**.
2. Preencha:
   - **CPF ou CNPJ:** pode digitar com ou sem pontos e traços. Profissional liberal (pessoa física) usa o CPF.
   - **Razão social / nome:** o nome oficial.
   - **Nome fantasia:** o nome pelo qual ela é conhecida (opcional). Se existir, é o que aparece nas listas.
   - **Tipo:** escolha o que melhor descreve (empresa privada, órgão público, ONG etc.).
   - **UF** e **Cidade.**
   - **Ramo de atividade** e **E-mail** (opcionais).
3. Toque em **Salvar**.

O sistema confere o CPF/CNPJ. Se algum número estiver errado, aparece **"CPF ou CNPJ inválido"**: corrija e salve de novo. Se a empresa já estiver cadastrada, aparece **"Já existe concedente com este CPF/CNPJ"**; procure-a na lista em vez de cadastrar outra.

Para **corrigir** os dados de uma concedente, toque nela na lista, altere e salve.

## 6. Cadastrar um novo convênio

1. Na aba **Convênios**, toque em **Novo convênio**.
2. Escolha a **Concedente** na lista.
3. Preencha o que já souber:
   - **Nº do convênio** (exemplo: `PR-212/2026`).
   - **Nº do processo SEI.**
   - **Situação:** *Em tramitação* enquanto estiver sendo preparado; *Finalizado* quando estiver assinado e concluído; *Cancelado* se for desfeito.
   - **Início** e **fim da vigência:** toque no campo e escolha no calendário.
   - **Minuta** (padrão UFF ou externa) e **Origem** (quem procurou quem).
   - **Resolução CEP**, **objeto** e **observações internas** (opcionais).
4. Toque em **Salvar**.

Um convênio **em tramitação** pode ser salvo incompleto, sem número e sem datas, para completar depois.

### Se aparecer um aviso em vermelho

| Aviso | O que fazer |
|---|---|
| **Finalizado exige número e datas de vigência** | Para marcar como *Finalizado*, preencha o número do convênio e as duas datas. Se ainda não tem, deixe *Em tramitação*. |
| **O fim da vigência deve ser depois do início** | Confira as datas: o fim não pode ser igual ou anterior ao início. |
| **A vigência máxima é de 5 anos** | O convênio pode durar até 5 anos, menos um dia. Exemplo: de 08/09/2026 a 07/09/2031. |
| **Já existe convênio com este número** | Esse número já está em outro convênio. Confira se não é duplicado. |
| **Escolha a concedente** | Falta selecionar a empresa ou instituição. |

## 7. Corrigir ou atualizar um convênio

1. Abra o convênio e toque no **lápis**, no canto superior direito.
2. Altere o que precisar e toque em **Salvar**.

Tudo o que você mudar fica registrado no histórico.

**Não existe excluir.** Se um convênio foi cadastrado por engano, mude a situação para **Cancelado** (e, se quiser, explique nas observações internas). Assim a história fica guardada.

## 8. Registrar o andamento do processo

Cada vez que o processo avança, registre a etapa:

1. Abra o convênio e, em **Andamento do processo**, toque em **Registrar etapa**.
2. Escolha a **etapa** (documentação recebida, análise, termo preparado, assinado pela concedente, assinado pelo pró-reitor, ratificação, extrato publicado no Boletim de Serviço, ou outra).
3. Confira a **data** (já vem com a de hoje; toque para mudar).
4. Se quiser, escreva uma **observação.**
5. Toque em **Registrar.**

A etapa aparece na lista do andamento e no histórico. Não é possível apagar uma etapa registrada.

## 9. Ler o histórico

No fim da tela de um convênio, o **Histórico de alterações** mostra frases como:

- *"fulano@uff.br criou o convênio"*
- *"fulano@uff.br alterou: fim da vigência, situação"*
- *"fulano@uff.br registrou a etapa Análise da documentação"*

com o dia e a hora. O histórico **não pode ser editado nem apagado**, para garantir a transparência. Ele mostra **quem** alterou, **quando** e **quais campos**; não mostra o valor que havia antes.

## 10. Dúvidas frequentes

**Digitei errado o número de um convênio. E agora?**
Abra o convênio, toque no lápis, corrija o número e salve. A correção fica no histórico.

**Não encontro uma empresa na lista de concedentes.**
Pesquise pelo CNPJ ou por um pedaço do nome. Se realmente não existir, cadastre-a (seção 5).

**O convênio aparece como "Vencido", mas foi renovado.**
A renovação é feita cadastrando um novo convênio (ou ajustando as datas, se for o mesmo). A situação *Vencido* é automática: muda assim que a data final passa.

**Posso usar no celular?**
Sim. A tela se adapta ao tamanho do celular.

**Quem pode ver os dados?**
Só quem é da Divisão de Estágio e tem login. O CPF de pessoas físicas só aparece aqui dentro, nunca em páginas públicas.

**Algo deu errado ("Não foi possível salvar").**
Verifique a conexão com a internet e tente de novo. Se persistir, avise quem administra o sistema e conte o que estava fazendo.

## O que ainda não existe nesta versão

Estão previstos, mas **ainda não funcionam**: importar os convênios antigos do site, a página pública de consulta para empresas, os avisos automáticos de vencimento e o painel com gráficos.
