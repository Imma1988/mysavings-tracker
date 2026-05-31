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

Quando importas o Excel de cotacoes da Fidelidade, a app usa as cotacoes oficiais:

- nas entradas, compra unidades pela proxima cotacao disponivel;
- nos resgates, vende unidades pela proxima cotacao disponivel, aproximando a data da operacao;
- a mais-valia e a diferenca entre a cotacao de venda e a cotacao de compra das unidades resgatadas.

Para cada lote resgatado:

```text
unidades compradas = valor da entrada / cotacao da entrada
unidades resgatadas = valor bruto do resgate / cotacao do resgate
custo original proporcional = unidades resgatadas x cotacao da entrada
valor sujeito a imposto = valor bruto resgatado - custo original proporcional
imposto = valor sujeito a imposto x taxa de imposto
valor liquido = valor bruto resgatado - imposto
```

Sem cotacoes importadas, a app continua a usar uma estimativa por TANB com as taxas historicas aplicaveis a cada periodo:

- 1o semestre de 2026: 2,000% TANB, de 2026-01-01 a 2026-06-30.
- 2o semestre de 2025: 1,700% TANB, de 2025-07-01 a 2025-12-31.
- 1o semestre de 2025: 2,250% TANB, de 2025-01-01 a 2025-06-30.

O imposto usado por defeito e 28%.

## Como usar

1. Descarrega da Fidelidade o Excel `Fidelidade Savings Opcao Seguro.xlsx`.
2. Na app, carrega em `Importar cotacoes` e seleciona esse Excel.
3. Regista cada entrada com data e valor.
4. Regista cada resgate com a data do pedido e o valor bruto do resgate.
5. Compara o valor sujeito a imposto, imposto retido e valor liquido calculados pela app com o detalhe mostrado pela Fidelidade.

As cotacoes ficam guardadas no browser depois da importacao. Pequenas diferencas podem existir por arredondamentos ou por regras internas de calendario da Fidelidade.
