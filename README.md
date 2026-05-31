# MySavings Lucro Real

App simples para controlar entradas, levantamentos e lucro real na Fidelidade MySavings.

## O que faz

- Regista entradas de dinheiro.
- Regista levantamentos.
- Guarda o saldo atual que aparece na app MySavings.
- Calcula o lucro liquido real por diferenca.
- Calcula os juros brutos antes de imposto e o imposto retido, usando 28% por defeito.
- Guarda os dados no browser com `localStorage`.
- Permite exportar e importar os dados em JSON.

## Formula

```text
lucro liquido = saldo atual + total levantado - total de entradas
juros brutos = lucro liquido / (1 - taxa de imposto)
imposto retido = juros brutos - lucro liquido
```

Com imposto de 28%, o divisor e `0.72`.

## Como usar

1. Regista cada entrada feita na MySavings.
2. Regista cada levantamento feito da MySavings.
3. Atualiza o saldo atual com o valor visivel na app MySavings.
4. Mantem a retencao de imposto em `28%`, exceto se a tua situacao fiscal exigir outro valor.

Se todos os movimentos estiverem registados, o lucro liquido e exato por reconciliacao de dinheiro. Nao depende da TANB nem de estimativas diarias.

