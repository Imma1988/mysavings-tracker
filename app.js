const storageKey = "mysavings-tracker-v1";

const currency = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

const labels = {
  deposit: "Entrada",
  withdrawal: "Saída",
  interest: "Juros pagos",
};

const elements = {
  annualRate: document.querySelector("#annualRate"),
  taxRate: document.querySelector("#taxRate"),
  calculationDate: document.querySelector("#calculationDate"),
  transactionDate: document.querySelector("#transactionDate"),
  transactionAmount: document.querySelector("#transactionAmount"),
  transactionNote: document.querySelector("#transactionNote"),
  transactionForm: document.querySelector("#transactionForm"),
  settingsForm: document.querySelector("#settingsForm"),
  transactionsTable: document.querySelector("#transactionsTable"),
  movementCount: document.querySelector("#movementCount"),
  currentBalance: document.querySelector("#currentBalance"),
  grossInterest: document.querySelector("#grossInterest"),
  netInterest: document.querySelector("#netInterest"),
  totalMoved: document.querySelector("#totalMoved"),
  exportJson: document.querySelector("#exportJson"),
  importJson: document.querySelector("#importJson"),
  clearData: document.querySelector("#clearData"),
};

let state = loadState();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  const fallback = {
    settings: {
      annualRate: 2.5,
      taxRate: 28,
      calculationDate: todayIso(),
    },
    transactions: [],
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || !Array.isArray(saved.transactions)) {
      return fallback;
    }

    return {
      settings: { ...fallback.settings, ...saved.settings },
      transactions: saved.transactions,
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state, null, 2));
}

function signedAmount(transaction) {
  if (transaction.type === "withdrawal") {
    return -Math.abs(transaction.amount);
  }

  return Math.abs(transaction.amount);
}

function sortTransactions(transactions = state.transactions) {
  return [...transactions].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate || a.createdAt.localeCompare(b.createdAt);
  });
}

function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function calculateSummary() {
  const transactions = sortTransactions();
  const annualRate = Number(state.settings.annualRate) / 100;
  const taxRate = Number(state.settings.taxRate) / 100;
  const calculationDate = state.settings.calculationDate || todayIso();
  let balance = 0;
  let grossInterest = 0;
  let previousDate = transactions[0]?.date || calculationDate;

  transactions.forEach((transaction) => {
    const elapsedDays = daysBetween(previousDate, transaction.date);
    grossInterest += balance * annualRate * (elapsedDays / 365);
    balance += signedAmount(transaction);
    previousDate = transaction.date;
  });

  const finalDays = daysBetween(previousDate, calculationDate);
  grossInterest += balance * annualRate * (finalDays / 365);

  const totalMoved = transactions.reduce((sum, transaction) => {
    return sum + Math.abs(transaction.amount);
  }, 0);

  return {
    balance,
    grossInterest,
    netInterest: grossInterest * (1 - taxRate),
    totalMoved,
  };
}

function runningBalances() {
  let balance = 0;
  return sortTransactions().map((transaction) => {
    balance += signedAmount(transaction);
    return { ...transaction, balance };
  });
}

function render() {
  elements.annualRate.value = state.settings.annualRate;
  elements.taxRate.value = state.settings.taxRate;
  elements.calculationDate.value = state.settings.calculationDate;

  const summary = calculateSummary();
  elements.currentBalance.textContent = currency.format(summary.balance);
  elements.grossInterest.textContent = currency.format(summary.grossInterest);
  elements.netInterest.textContent = currency.format(summary.netInterest);
  elements.totalMoved.textContent = currency.format(summary.totalMoved);

  const rows = runningBalances();
  elements.movementCount.textContent = rows.length
    ? `${rows.length} movimento${rows.length === 1 ? "" : "s"} registado${rows.length === 1 ? "" : "s"}.`
    : "Sem movimentos registados.";

  elements.transactionsTable.innerHTML = rows
    .map((transaction) => {
      const amountClass = transaction.type === "withdrawal" ? "negative" : "positive";
      return `
        <tr>
          <td>${transaction.date}</td>
          <td><span class="pill ${transaction.type}">${labels[transaction.type]}</span></td>
          <td>${escapeHtml(transaction.note || "-")}</td>
          <td class="number ${amountClass}">${currency.format(signedAmount(transaction))}</td>
          <td class="number">${currency.format(transaction.balance)}</td>
          <td class="number">
            <button class="remove-button" type="button" data-id="${transaction.id}">Remover</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings = {
    annualRate: Number(elements.annualRate.value),
    taxRate: Number(elements.taxRate.value),
    calculationDate: elements.calculationDate.value || todayIso(),
  };
  saveState();
  render();
});

elements.transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(elements.transactionForm);
  const type = form.get("type");

  state.transactions.push({
    id: crypto.randomUUID(),
    type,
    date: elements.transactionDate.value,
    amount: Number(elements.transactionAmount.value),
    note: elements.transactionNote.value.trim(),
    createdAt: new Date().toISOString(),
  });

  elements.transactionForm.reset();
  elements.transactionDate.value = todayIso();
  elements.transactionForm.querySelector('input[value="deposit"]').checked = true;
  saveState();
  render();
});

elements.transactionsTable.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) {
    return;
  }

  state.transactions = state.transactions.filter((transaction) => transaction.id !== button.dataset.id);
  saveState();
  render();
});

elements.exportJson.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mysavings-tracker-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

elements.importJson.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported.transactions)) {
      throw new Error("Formato inválido");
    }

    state = {
      settings: { ...state.settings, ...imported.settings },
      transactions: imported.transactions,
    };
    saveState();
    render();
  } catch {
    alert("Não foi possível importar o ficheiro. Confirma se é um export deste projeto.");
  } finally {
    event.target.value = "";
  }
});

elements.clearData.addEventListener("click", () => {
  const confirmed = confirm("Queres apagar todos os movimentos e parâmetros guardados neste browser?");
  if (!confirmed) {
    return;
  }

  localStorage.removeItem(storageKey);
  state = loadState();
  elements.transactionDate.value = todayIso();
  render();
});

elements.transactionDate.value = todayIso();
if (!state.settings.calculationDate) {
  state.settings.calculationDate = todayIso();
}
render();
