# Decisão de plataforma: Firebase + Flutter

**Para:** PROGRAD (Divisão de Estágio) e equipe de desenvolvimento
**Data:** 07/10/2026
**Situação:** em decisão (REQUIREMENTS D23, D24, D25)

## O pedido

Usar Firebase (Google) e Flutter para:

1. **Não depender de servidor da STI.**
2. **Ter um só aplicativo** para celular (Android e iOS) e navegador.

## Ponto de partida

Já existe uma versão funcionando em Django + PostgreSQL ([estudio-max/estagio-da-uff](https://github.com/estudio-max/estagio-da-uff)) com:

- cadastro de convênios e etapas;
- página pública de convênios vigentes;
- alertas de vencimento;
- painel com gráficos;
- importação dos 4.133 convênios do estagio.uff.br;
- 110 testes automatizados.

Mudar de plataforma **não é um fork**: o código não passa para Flutter. Passam os requisitos, as regras de negócio, os testes (como especificação) e a análise dos dados reais. Por isso, o trabalho fica num repositório novo.

## As três opções

| | A. Firebase com Firestore | B. Firebase Data Connect | C. Django como API + app Flutter |
|---|---|---|---|
| **O que é** | Banco de documentos (NoSQL) do Firebase | Firebase com banco **PostgreSQL** (Cloud SQL) | O sistema atual vira o servidor; o Flutter é só a tela |
| **Depende da STI?** | Não | Não | Não, se hospedado no Google Cloud |
| **Celular + navegador** | Sim | Sim | Sim |
| **Custo mensal estimado¹** | Provavelmente zero (4 mil convênios cabem no plano gratuito) | ~US$ 10–30 (Cloud SQL) | ~US$ 10–30 (Cloud Run + Cloud SQL) |
| **Relatórios e regras que cruzam dados**² | Difícil: contadores e funções mantidos à mão | Simples: consultas de banco relacional | Simples: já prontos e testados |
| **Fase 3 (TCE, estudantes, aditivos)** | Arriscado: são exatamente as relações que o Firestore faz mal | Adequado | Adequado |
| **Reaproveita o que já foi feito** | Só documentos e regras | Documentos, regras e o modelo de dados | Quase tudo |
| **Tempo até chegar onde estamos** | Maior | Médio | Menor |
| **Se um dia trocar de fornecedor** | Difícil (formato do Google) | Fácil (PostgreSQL padrão) | Fácil |

¹ Estimativa a confirmar na calculadora do Google Cloud; varia com uso e região.
² Exemplos do sistema atual: "concedentes cujo convênio venceu e que não renovaram", "vigentes por UF", "soma das vigências de um estudante na mesma empresa ≤ 24 meses".

## Riscos que valem para qualquer opção

- **A burocracia de aprovação continua valendo.** São dados de uma instituição pública. LGPD, guarda dos documentos pelo arquivo da UFF (SDC) e processo no SEI valem também fora do servidor da STI. Sair da STI resolve a espera por servidor, não a necessidade de aprovação. Ignorar isso pode fazer o sistema ser barrado depois, já em uso (D25).
- **Página pública em Flutter web.** O Flutter desenha a tela como uma imagem: o Google indexa mal, e leitores de tela funcionam pior. Para a página onde empresas e estudantes procuram convênios, o recomendado é HTML comum, gerado pelo Firebase, com o app Flutter para a Divisão (D24).
- **Login gov.br.** O Firebase Auth não aceita o gov.br direto; precisa do Identity Platform, a versão paga do Auth, barata nesse volume.
- **Região dos dados.** Configurar o projeto em `southamerica-east1` (São Paulo).

## Recomendação

**Opção B, Firebase Data Connect**, com página pública em HTML e app Flutter para a Divisão.

- Atende aos dois pedidos: independência da STI e um só aplicativo para vários dispositivos.
- Mantém o banco relacional, que as Fases 2 e 3 vão exigir.
- O modelo de dados e as regras já validados passam quase sem mudança.

Se custo zero for indispensável, a **opção A** serve para o MVP de convênios, que é pequeno, mas com o compromisso de reavaliar antes da Fase 3.

## O que precisamos do cliente

1. Escolher entre A, B e C (D23).
2. Confirmar se a página pública pode ser HTML, e não Flutter web (D24).
3. Dizer qual burocracia se quer evitar: hospedagem ou aprovação (D25).
4. Indicar quem será o dono da conta Google Cloud/Firebase e quem paga, mesmo que hoje o custo seja zero.
