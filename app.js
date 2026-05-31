const storageKey = "mysavings-tracker-v2";
const legacyStorageKey = "mysavings-tracker-v1";

const currency = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

const labels = {
  deposit: "Entrada",
  withdrawal: "Levantamento",
};

const elements = {
  taxRate: document.querySelector("#taxRate"),
  currentBalanceInput: document.querySelector("#currentBalanceInput"),
  transactionDate: document.querySelector("#transactionDate"),
  transactionAmount: document.querySelector("#transactionAmount"),
  transactionNote: document.querySelector("#transactionNote"),
  transactionForm: document.querySelector("#transactionForm"),
  settingsForm: document.querySelector("#settingsForm"),
  transactionsTable: document.querySelector("#transactionsTable"),
  movementCount: document.querySelector("#movementCount"),
  currentBalance: document.querySelector("#currentBalance"),
  netProfit: document.querySelector("#netProfit"),
  grossProfit: document.querySelector("#grossProfit"),
  taxWithheld: document.querySelector("#taxWithheld"),
  totalDeposits: document.querySelector("#totalDeposits"),
  totalWithdrawals: document.querySelector("#totalWithdrawals"),
  exportJson: document.querySelector("#exportJson"),
  importJson: document.querySelector("#importJson"),
  clearData: document.querySelector("#clearData"),
};

let state = loadState();

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyState() {
  return {
    settings: {
      currentBalance: 0,
      taxRate: 28,
    },
    transactions: [],
  };
}

function loadState() {
  const saved = readStoredState(storageKey);
  if (saved) {
    return normalizeState(saved);
  }

  const legacy = readStoredState(legacyStorageKey);
  if (legacy) {
    return normalizeState({
      settings: {
        currentBalance: legacy.transactions.reduce((sum, item) => sum + signedLegacyAmount(item), 0),
        taxRate: legacy.settings?.taxRate ?? 28,
      },
      transactions: legacy.transactions.filter((item) => item.type === "deposit" || item.type === "withdrawal"),
    });
  }

  return emptyState();
}

function readStoredState(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved && Array.isArray(saved.transactions) ? saved : null;
  } catch {
    return null;
  }
}

function normalizeState(value) {
  const fallback = emptyState();
  return {
    settings: {
      ...fallback.settings,
      ...value.settings,
      currentBalance: Number(value.settings?.currentBalance ?? 0),
      taxRate: Number(value.settings?.taxRate ?? 28),
    },
    transactions: value.transactions
      .filter((item) => item.type === "deposit" || item.type === "withdrawal")
      .map((item) => ({
        id: item.id || crypto.randomUUID(),
        type: item.type,
        date: item.date || todayIso(),
        amount: Math.abs(Number(item.amount || 0)),
        note: item.note || "",
        createdAt: item.createdAt || new Date().toISOString(),
      })),
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state, null, 2));
}

function signedLegacyAmount(transaction) {
  if (transaction.type === "withdrawal") {
    return -Math.abs(Number(transaction.amount || 0));
  }

  return Math.abs(Number(transaction.amount || 0));
}

function sortTransactions(transactions = state.transactions) {
  return [...transactions].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate || a.createdAt.localeCompare(b.createdAt);
  });
}

function calculateSummary() {
  const taxRate = Number(state.settings.taxRate) / 100;
  const totalDeposits = state.transactions
    .filter((item) => item.type === "deposit")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalWithdrawals = state.transactions
    .filter((item) => item.type === "withdrawal")
    .reduce((sum, item) => sum + item.amount, 0);
  const currentBalance = Number(state.settings.currentBalance || 0);
  const netProfit = currentBalance + totalWithdrawals - totalDeposits;
  const grossProfit = netProfit > 0 && taxRate < 1 ? netProfit / (1 - taxRate) : netProfit;
  const taxWithheld = netProfit > 0 ? grossProfit - netProfit : 0;

  return {
    currentBalance,
    totalDeposits,
    totalWithdrawals,
    netProfit,
    grossProfit,
    taxWithheld,
  };
}

function runningCapital() {
  let capital = 0;
  return sortTransactions().map((transaction) => {
    capital += transaction.type === "withdrawal" ? -transaction.amount : transaction.amount;
    return { ...transaction, capital };
  });
}

function render() {
  elements.currentBalanceInput.value = state.settings.currentBalance;
  elements.taxRate.value = state.settings.taxRate;

  const summary = calculateSummary();
  elements.currentBalance.textContent = currency.format(summary.currentBalance);
  elements.netProfit.textContent = currency.format(summary.netProfit);
  elements.grossProfit.textContent = currency.format(summary.grossProfit);
  elements.taxWithheld.textContent = currency.format(summary.taxWithheld);
  elements.totalDeposits.textContent = currency.format(summary.totalDeposits);
  elements.totalWithdrawals.textContent = currency.format(summary.totalWithdrawals);

  const rows = runningCapital();
  elements.movementCount.textContent = rows.length
    ? `${rows.length} movimento${rows.length === 1 ? "" : "s"} registado${rows.length === 1 ? "" : "s"}.`
    : "Sem movimentos registados.";

  elements.transactionsTable.innerHTML = rows
    .map((transaction) => {
      const signedAmount = transaction.type === "withdrawal" ? -transaction.amount : transaction.amount;
      return `
        <tr>
          <td>${transaction.date}</td>
          <td><span class="pill ${transaction.type}">${labels[transaction.type]}</span></td>
          <td>${escapeHtml(transaction.note || "-")}</td>
          <td class="number">${currency.format(signedAmount)}</td>
          <td class="number">${currency.format(transaction.capital)}</td>
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
    currentBalance: Number(elements.currentBalanceInput.value || 0),
    taxRate: Number(elements.taxRate.value || 0),
  };
  saveState();
  render();
});

elements.transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(elements.transactionForm);

  state.transactions.push({
    id: crypto.randomUUID(),
    type: form.get("type"),
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
      throw new Error("Formato invalido");
    }

    state = normalizeState(imported);
    saveState();
    render();
  } catch {
    alert("Nao foi possivel importar o ficheiro. Confirma se e um export deste projeto.");
  } finally {
    event.target.value = "";
  }
});

elements.clearData.addEventListener("click", () => {
  const confirmed = confirm("Queres apagar todos os dados guardados neste browser?");
  if (!confirmed) {
    return;
  }

  localStorage.removeItem(storageKey);
  state = emptyState();
  elements.transactionDate.value = todayIso();
  render();
});

elements.transactionDate.value = todayIso();
render();
