# MySavings Tracker

Projeto simples para acompanhar entradas, saídas e juros estimados da app MySavings da Fidelidade.

## O que faz

- Regista entradas, saídas e juros pagos.
- Guarda os dados no browser com `localStorage`.
- Calcula saldo atual.
- Estima juros brutos e líquidos com base na TANB anual configurada.
- Permite exportar e importar os dados em JSON.
- Funciona como site estático, pronto para GitHub Pages.

## Como usar

Abre o ficheiro `index.html` no browser ou publica o projeto no GitHub Pages.

1. Define a TANB anual indicada na app MySavings.
2. Define a retenção de imposto, por defeito `28%`.
3. Regista cada entrada e saída com a data real do movimento.
4. Usa "Juros pagos" quando a Fidelidade creditar juros na conta.

## Nota importante

O cálculo é uma estimativa: usa capitalização simples diária com base na TANB configurada. Pode haver pequenas diferenças face ao valor oficial por arredondamentos, calendário bancário, alterações de taxa, impostos ou regras internas da Fidelidade.

## GitHub Pages

Depois de criares o repositório no GitHub:

1. Envia estes ficheiros para a branch principal.
2. Vai a `Settings > Pages`.
3. Em `Build and deployment`, escolhe `Deploy from a branch`.
4. Seleciona a branch principal e a pasta `/root`.

