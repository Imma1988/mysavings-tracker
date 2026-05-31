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

Para cada lote resgatado:

```text
valor bruto atual = capital original x (1 + TANB x dias / 365)
custo original proporcional = valor bruto resgatado / (1 + TANB x dias / 365)
valor sujeito a imposto = valor bruto resgatado - custo original proporcional
imposto = valor sujeito a imposto x taxa de imposto
valor liquido = valor bruto resgatado - imposto
```

Por defeito:

```text
TANB = 2%
imposto = 28%
```

## Como usar

1. Regista cada entrada com data e valor.
2. Regista cada resgate com a data da operacao e o valor bruto do resgate.
3. Compara o valor sujeito a imposto, imposto retido e valor liquido calculados pela app com o detalhe mostrado pela Fidelidade.

Se os movimentos antigos estiverem todos registados e a TANB estiver correta, a app deve aproximar-se dos valores da Fidelidade. Pequenas diferencas podem existir por arredondamentos ou por regras internas de calendario.

