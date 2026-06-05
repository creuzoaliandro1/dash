# ACCOUNTING_CONCEPTS.md — Conceitos Contábeis de Referência

## 1. Objetivo

Fornecer a base conceitual contábil (Brasil: CPC; internacional: IFRS) que fundamenta todas as regras e algoritmos do módulo. Este documento é **normativo**: quando uma SPEC ou código contradisser um conceito aqui descrito, este documento prevalece.

## 2. Responsabilidades

- Definir terminologia única usada em todo o módulo.
- Explicar partidas dobradas, naturezas de conta, regime de competência e estrutura das demonstrações.
- Servir de material de contexto para agentes de IA implementarem cálculos corretos.

## 3. Método das Partidas Dobradas

Cada fato contábil afeta ao menos duas contas: todo **débito** tem um **crédito** de igual valor. A equação fundamental:

```
ATIVO = PASSIVO + PATRIMÔNIO LÍQUIDO
```

expandida com resultado:

```
ATIVO + DESPESAS + CUSTOS = PASSIVO + PL + RECEITAS
```

Invariante de sistema: em qualquer recorte (lançamento, dia, período, exercício, empresa), `Σ débitos = Σ créditos`.

## 4. Natureza das Contas e Efeito de D/C

| Grupo | Natureza do saldo | Débito | Crédito |
|---|---|---|---|
| Ativo | Devedora | aumenta | diminui |
| Passivo | Credora | diminui | aumenta |
| Patrimônio Líquido | Credora | diminui | aumenta |
| Receitas | Credora | diminui | aumenta |
| Custos | Devedora | aumenta | diminui |
| Despesas | Devedora | aumenta | diminui |

Contas **retificadoras** têm natureza invertida ao grupo (ex.: `(-) Depreciação Acumulada` é ativo de natureza credora; `(-) Deduções da Receita` é resultado de natureza devedora). Por isso a natureza é atributo da **conta**, não do grupo.

## 5. Conta Sintética × Analítica

- **Sintética**: agrupadora, não recebe lançamentos; seu saldo é a soma das filhas.
- **Analítica**: folha da árvore, recebe lançamentos.
- A ECD exige indicador S/A por conta (registro I050) — campo `aceita_lancamento` + `nivel` cobrem essa exigência.

## 6. Convenção de Sinal Adotada pelo Sistema

Para evitar ambiguidade, o sistema armazena e calcula assim:

1. Itens de lançamento: `valor > 0` sempre; campo `tipo` ∈ {`D`,`C`}.
2. Saldo "bruto" de qualquer conta: `saldo_bruto = Σ débitos − Σ créditos` (positivo = devedor, negativo = credor).
3. Saldo "apresentado": `saldo_apresentado = saldo_bruto` para natureza devedora; `saldo_apresentado = −saldo_bruto` para natureza credora. Conta saudável tem `saldo_apresentado ≥ 0`; negativo indica saldo invertido (destacar nos relatórios).
4. `ctb_saldo_contabil.saldo_final` armazena o **saldo bruto** (D−C). A apresentação converte conforme a natureza.

## 7. Regime de Competência (CPC 00 / Estrutura Conceitual)

Receitas e despesas são reconhecidas no período em que o **fato gerador** ocorre, independentemente do recebimento/pagamento (regime de caixa). Por isso todo lançamento tem `data_competencia` distinta de `data_lancamento`, e todos os relatórios filtram por competência (regra RR-01).

Exemplo: duplicata emitida em 28/01 com vencimento 28/02 → receita reconhecida em **janeiro** (competência); o recebimento em fevereiro movimenta apenas contas patrimoniais (Banco × Clientes).

## 8. Plano de Contas — estrutura modelo

Estrutura de 5 níveis com máscara `9.9.99.999.9999`:

| Nível | Exemplo | Tipo |
|---|---|---|
| 1 | `1` Ativo | Sintética |
| 2 | `1.1` Ativo Circulante | Sintética |
| 3 | `1.1.2` Créditos | Sintética |
| 4 | `1.1.2.001` Clientes | Sintética ou Analítica |
| 5 | `1.1.2.001.0001` Clientes Nacionais | Analítica |

Raízes do modelo: `1` Ativo, `2` Passivo, `2.3` (ou `3`) Patrimônio Líquido, `4` Receitas, `5` Custos, `6` Despesas, `7` Apuração do Resultado (transitória). Ver seed completo em `SPECS/PLAN_OF_ACCOUNTS.md` §9.

## 9. Livros Contábeis

- **Livro Diário**: registro cronológico e sequencial de todos os lançamentos (obrigatório; base do registro I200/I250 da ECD).
- **Livro Razão**: movimentação por conta — saldo anterior, partidas D/C, saldo após cada partida, saldo final.
- **Balancete de Verificação**: lista de contas com saldo anterior, débitos, créditos e saldo final do período; prova de equilíbrio.

## 10. Demonstrações

### 10.1 DRE (CPC 26)

Estrutura dedutiva por competência:

```
  Receita Bruta
(−) Deduções (impostos sobre vendas, devoluções, abatimentos)
(=) Receita Líquida
(−) CMV / CSP / CPV
(=) Lucro Bruto
(−) Despesas Operacionais (vendas, administrativas)
(±) Outras receitas/despesas operacionais
(=) Resultado antes do Resultado Financeiro
(±) Resultado Financeiro (receitas − despesas financeiras)
(=) Resultado antes de IR/CSLL
(−) IR e CSLL
(=) Resultado Líquido do Período
```

Cada linha é um `grupo_dre` com `ordem` e `tipo_operacao` (soma/subtração/subtotal). Ver `SPECS/INCOME_STATEMENT.md`.

### 10.2 Balanço Patrimonial (CPC 26)

| ATIVO | PASSIVO + PL |
|---|---|
| Ativo Circulante | Passivo Circulante |
| Ativo Não Circulante (Realizável LP, Investimentos, Imobilizado, Intangível) | Passivo Não Circulante |
| | Patrimônio Líquido (Capital, Reservas, Lucros/Prejuízos Acumulados, Resultado do Período) |

Invariante: `Total Ativo = Total Passivo + PL`. O resultado do período não encerrado entra no PL como "Resultado do Período".

## 11. Apuração e Encerramento do Resultado

No encerramento do exercício (ou apuração mensal, configurável):

1. Saldos de todas as contas de resultado (4, 5, 6) são transferidos para a conta transitória **ARE** (Apuração do Resultado do Exercício, grupo 7): debita receitas, credita despesas/custos.
2. O saldo da ARE (lucro = credor; prejuízo = devedor) é transferido para **Lucros ou Prejuízos Acumulados** no PL.
3. Contas de resultado iniciam o exercício seguinte zeradas; contas patrimoniais carregam saldo.

## 12. Histórico Padronizado

Históricos pré-cadastrados com placeholders (`{documento}`, `{sacado}`, `{parcela}`, `{valor}`) garantem uniformidade e atendem ao campo histórico do registro I200 da ECD. Exemplo: código `001` = "Recebimento da duplicata {documento} de {sacado}".

## 13. Centro de Custo

Dimensão analítica **gerencial** ortogonal ao plano de contas: não altera o equilíbrio contábil, apenas segmenta itens de resultado (e opcionalmente patrimoniais) para análise por departamento/projeto/filial. Distribuição de um item entre N centros deve somar exatamente o valor do item (RL-12).

## 14. SPED Contábil (ECD) — conceitos que moldam o modelo

| Exigência ECD | Reflexo no modelo |
|---|---|
| I050 — plano de contas com indicador S/A, natureza e data de inclusão | `ctb_conta_contabil`: `aceita_lancamento`, `natureza`, `created_at` |
| I051 — mapeamento ao plano referencial da RFB | coluna `codigo_referencial` (nullable, fase 2) |
| I200/I250 — lançamentos com número, data, valor, itens D/C, histórico | `ctb_lancamento` + `ctb_lancamento_item`, número sequencial sem lacunas |
| I150/I155 — saldos periódicos por conta | `ctb_saldo_contabil` por período mensal |
| J100/J150 — Balanço e DRE | `grupo_balanco` / `grupo_dre` |

## 15. Glossário rápido

| Termo | Definição |
|---|---|
| Partida | Item individual (D ou C) de um lançamento |
| Lançamento | Conjunto equilibrado de partidas com data, histórico e número |
| Competência | Mês/ano do fato gerador |
| Exercício | Ano fiscal (jan–dez) |
| ARE | Conta transitória de apuração do resultado |
| ECD | Escrituração Contábil Digital (SPED Contábil) |
| Conta retificadora | Conta com natureza invertida que reduz o grupo |
| Balancete | Relatório de verificação de saldos e equilíbrio |
