const storageKey = "mysavings-tracker-v4";
const previousStorageKeys = ["mysavings-tracker-v3", "mysavings-tracker-v2", "mysavings-tracker-v1"];

const currency = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

const labels = {
  deposit: "Entrada",
  withdrawal: "Resgate",
};

const rateSchedule = [
  { start: "2025-01-01", end: "2025-07-01", rate: 0.0225, label: "1o semestre 2025: 2,250%" },
  { start: "2025-07-01", end: "2026-01-01", rate: 0.017, label: "2o semestre 2025: 1,700%" },
  { start: "2026-01-01", end: "2026-07-01", rate: 0.02, label: "1o semestre 2026: 2,000%" },
];

const elements = {
  taxRate: document.querySelector("#taxRate"),
  calculationDate: document.querySelector("#calculationDate"),
  transactionDate: document.querySelector("#transactionDate"),
  operationDate: document.querySelector("#operationDate"),
  transactionAmount: document.querySelector("#transactionAmount"),
  transactionNote: document.querySelector("#transactionNote"),
  transactionForm: document.querySelector("#transactionForm"),
  settingsForm: document.querySelector("#settingsForm"),
  transactionsTable: document.querySelector("#transactionsTable"),
  movementCount: document.querySelector("#movementCount"),
  totalDeposits: document.querySelector("#totalDeposits"),
  totalWithdrawals: document.querySelector("#totalWithdrawals"),
  realizedTaxable: document.querySelector("#realizedTaxable"),
  taxWithheld: document.querySelector("#taxWithheld"),
  netWithdrawals: document.querySelector("#netWithdrawals"),
  remainingCost: document.querySelector("#remainingCost"),
  unrealizedInterest: document.querySelector("#unrealizedInterest"),
  estimatedPosition: document.querySelector("#estimatedPosition"),
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
      taxRate: 28,
      calculationDate: todayIso(),
    },
    transactions: [],
  };
}

function loadState() {
  const saved = readStoredState(storageKey);
  if (saved) {
    return normalizeState(saved);
  }

  for (const key of previousStorageKeys) {
    const previous = readStoredState(key);
    if (previous) {
      return normalizeState(previous);
    }
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
      taxRate: Number(value.settings?.taxRate ?? fallback.settings.taxRate),
      calculationDate: value.settings?.calculationDate || fallback.settings.calculationDate,
    },
    transactions: value.transactions
      .filter((item) => item.type === "deposit" || item.type === "withdrawal")
      .map((item) => ({
        id: item.id || crypto.randomUUID(),
        type: item.type,
        date: item.date || todayIso(),
        operationDate: item.operationDate || item.date || todayIso(),
        amount: Math.abs(Number(item.amount || 0)),
        note: item.note || "",
        createdAt: item.createdAt || new Date().toISOString(),
      })),
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state, null, 2));
}

function sortTransactions(transactions = state.transactions) {
  return [...transactions].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    const byOperationDate = (a.operationDate || a.date).localeCompare(b.operationDate || b.date);
    return byDate || byOperationDate || a.createdAt.localeCompare(b.createdAt);
  });
}

function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function rateForDate(iso) {
  const rate = rateSchedule.find((item) => iso >= item.start && iso < item.end);
  if (rate) {
    return rate.rate;
  }

  if (iso < rateSchedule[0].start) {
    return rateSchedule[0].rate;
  }

  return rateSchedule[rateSchedule.length - 1].rate;
}

function growthFactor(startIso, endIso) {
  if (endIso <= startIso) {
    return 1;
  }

  const boundaries = new Set([startIso, endIso]);
  rateSchedule.forEach((item) => {
    if (item.start > startIso && item.start < endIso) {
      boundaries.add(item.start);
    }
    if (item.end > startIso && item.end < endIso) {
      boundaries.add(item.end);
    }
  });

  const ordered = [...boundaries].sort();
  let growth = 0;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const periodStart = ordered[index];
    const periodEnd = ordered[index + 1];
    growth += rateForDate(periodStart) * (daysBetween(periodStart, periodEnd) / 365);
  }

  return 1 + growth;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function floorMoney(value) {
  return Math.floor((value + Number.EPSILON) * 100) / 100;
}

function buildLedger() {
  const taxRate = Number(state.settings.taxRate || 0) / 100;
  const calculationDate = state.settings.calculationDate || todayIso();
  const lots = [];
  const rows = [];
  const totals = {
    totalDeposits: 0,
    totalWithdrawals: 0,
    realizedTaxable: 0,
    taxWithheld: 0,
    netWithdrawals: 0,
    remainingCost: 0,
    unrealizedInterest: 0,
    estimatedPosition: 0,
  };

  sortTransactions().forEach((transaction) => {
    if (transaction.type === "deposit") {
      lots.push({
        id: transaction.id,
        date: transaction.date,
        remainingCost: transaction.amount,
      });
      totals.totalDeposits += transaction.amount;
      rows.push({
        ...transaction,
        taxable: 0,
        tax: 0,
        net: 0,
        unmatched: 0,
        remainingCost: sumRemainingCost(lots),
      });
      return;
    }

    const result = redeemFromLots(lots, transaction.amount, transaction.date);
    const roundedTaxable = floorMoney(result.taxable);
    const tax = roundMoney(roundedTaxable * taxRate);
    const net = roundMoney(transaction.amount - tax);

    totals.totalWithdrawals += transaction.amount;
    totals.realizedTaxable += roundedTaxable;
    totals.taxWithheld += tax;
    totals.netWithdrawals += net;

    rows.push({
      ...transaction,
      taxable: roundedTaxable,
      tax,
      net,
      unmatched: result.unmatched,
      remainingCost: sumRemainingCost(lots),
    });
  });

  totals.remainingCost = sumRemainingCost(lots);
  totals.unrealizedInterest = lots.reduce((sum, lot) => {
    const factor = growthFactor(lot.date, calculationDate);
    return sum + lot.remainingCost * (factor - 1);
  }, 0);
  totals.estimatedPosition = totals.remainingCost + totals.unrealizedInterest;

  return {
    rows,
    totals: {
      ...totals,
      unrealizedInterest: roundMoney(totals.unrealizedInterest),
      estimatedPosition: roundMoney(totals.estimatedPosition),
    },
  };
}

function redeemFromLots(lots, grossWithdrawal, withdrawalDate) {
  let remainingGross = grossWithdrawal;
  let taxable = 0;

  for (const lot of lots) {
    if (remainingGross <= 0 || lot.remainingCost <= 0) {
      continue;
    }

    const factor = growthFactor(lot.date, withdrawalDate);
    const lotGrossValue = lot.remainingCost * factor;
    const grossFromLot = Math.min(remainingGross, lotGrossValue);
    const costFromLot = factor > 0 ? grossFromLot / factor : grossFromLot;
    const gainFromLot = grossFromLot - costFromLot;

    lot.remainingCost = Math.max(0, lot.remainingCost - costFromLot);
    taxable += Math.max(0, gainFromLot);
    remainingGross -= grossFromLot;
  }

  return {
    taxable,
    unmatched: Math.max(0, remainingGross),
  };
}

function sumRemainingCost(lots) {
  return lots.reduce((sum, lot) => sum + lot.remainingCost, 0);
}

function render() {
  elements.taxRate.value = state.settings.taxRate;
  elements.calculationDate.value = state.settings.calculationDate;

  const ledger = buildLedger();
  elements.totalDeposits.textContent = currency.format(ledger.totals.totalDeposits);
  elements.totalWithdrawals.textContent = currency.format(ledger.totals.totalWithdrawals);
  elements.realizedTaxable.textContent = currency.format(ledger.totals.realizedTaxable);
  elements.taxWithheld.textContent = currency.format(ledger.totals.taxWithheld);
  elements.netWithdrawals.textContent = currency.format(ledger.totals.netWithdrawals);
  elements.remainingCost.textContent = currency.format(ledger.totals.remainingCost);
  elements.unrealizedInterest.textContent = currency.format(ledger.totals.unrealizedInterest);
  elements.estimatedPosition.textContent = currency.format(ledger.totals.estimatedPosition);

  elements.movementCount.textContent = ledger.rows.length
    ? `${ledger.rows.length} movimento${ledger.rows.length === 1 ? "" : "s"} registado${ledger.rows.length === 1 ? "" : "s"}.`
    : "Sem movimentos registados.";

  elements.transactionsTable.innerHTML = ledger.rows
    .map((transaction) => {
      const warning = transaction.unmatched > 0
        ? `<div class="warning">Sem entradas suficientes para ${currency.format(transaction.unmatched)}</div>`
        : "";
      return `
        <tr>
          <td>${transaction.date}</td>
          <td>${transaction.type === "withdrawal" ? transaction.operationDate || transaction.date : "-"}</td>
          <td><span class="pill ${transaction.type}">${labels[transaction.type]}</span></td>
          <td>${escapeHtml(transaction.note || "-")}${warning}</td>
          <td class="number">${currency.format(transaction.amount)}</td>
          <td class="number">${transaction.type === "withdrawal" ? currency.format(transaction.taxable) : "-"}</td>
          <td class="number">${transaction.type === "withdrawal" ? currency.format(transaction.tax) : "-"}</td>
          <td class="number">${transaction.type === "withdrawal" ? currency.format(transaction.net) : "-"}</td>
          <td class="number">${currency.format(transaction.remainingCost)}</td>
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
    taxRate: Number(elements.taxRate.value || 0),
    calculationDate: elements.calculationDate.value || todayIso(),
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
    operationDate: elements.operationDate.value || elements.transactionDate.value,
    amount: Number(elements.transactionAmount.value),
    note: elements.transactionNote.value.trim(),
    createdAt: new Date().toISOString(),
  });

  elements.transactionForm.reset();
  elements.transactionDate.value = todayIso();
  elements.operationDate.value = "";
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
elements.operationDate.value = "";
if (!state.settings.calculationDate) {
  state.settings.calculationDate = todayIso();
}
render();
