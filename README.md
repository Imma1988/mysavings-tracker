# MySavings FIFO

App simples para validar resgates da Fidelidade MySavings.

## Objetivo

A app calcula automaticamente, para cada resgate:

- valor sujeito a imposto;
- imposto retido estimado;
- valor liquido esperado;
- capital que continua aplicado.

## Regra usada

Os resgates usam FIFO: sai primeiro a entrada mais antiga ainda em carteira.

Nos resgates existem duas datas:

- data do pedido: usada para calcular a valorizacao e o imposto;
- data da operacao: guardada como referencia do movimento mostrado pela MySavings.

Para cada lote resgatado:

```text
valor bruto atual = capital original x fator de valorizacao
custo original proporcional = valor bruto resgatado / fator de valorizacao
valor sujeito a imposto = valor bruto resgatado - custo original proporcional
imposto = valor sujeito a imposto x taxa de imposto
valor liquido = valor bruto resgatado - imposto
```

O valor sujeito a imposto e truncado aos centimos antes de calcular o imposto, para aproximar o comportamento observado nos detalhes da MySavings.

O fator de valorizacao e calculado com as taxas historicas aplicaveis a cada periodo:

- 1o semestre de 2026: 2,000% TANB, de 2026-01-01 a 2026-06-30.
- 2o semestre de 2025: 1,700% TANB, de 2025-07-01 a 2025-12-31.
- 1o semestre de 2025: 2,250% TANB, de 2025-01-01 a 2025-06-30.

O imposto usado por defeito e 28%.

## Como usar

1. Regista cada entrada com data e valor.
2. Regista cada resgate com a data do pedido, a data da operacao e o valor bruto do resgate.
3. Compara o valor sujeito a imposto, imposto retido e valor liquido calculados pela app com o detalhe mostrado pela Fidelidade.

Se os movimentos antigos estiverem todos registados e as taxas historicas estiverem corretas, a app deve aproximar-se dos valores da Fidelidade. Pequenas diferencas podem existir por arredondamentos ou por regras internas de calendario.
