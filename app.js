const storageKey = "mysavings-tracker-v4";
const quoteStorageKey = "mysavings-tracker-quotes-v1";
const backupStoragePrefix = "mysavings-tracker-backup-";
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
  importQuotes: document.querySelector("#importQuotes"),
  clearQuotes: document.querySelector("#clearQuotes"),
  quoteStatus: document.querySelector("#quoteStatus"),
  clearData: document.querySelector("#clearData"),
};

let state = loadState();
let quotes = loadQuotes();

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
  const candidates = listStateStorageKeys()
    .map((key) => readStoredState(key))
    .filter(Boolean);

  if (!candidates.length) {
    return emptyState();
  }

  const bestCandidate = candidates.reduce((best, candidate) => {
    if (candidate.transactions.length > best.transactions.length) {
      return candidate;
    }
    return best;
  }, candidates[0]);

  return normalizeState(bestCandidate);
}

function listStateStorageKeys() {
  const keys = new Set([storageKey, ...previousStorageKeys]);

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(backupStoragePrefix)) {
      keys.add(key);
    }
  }

  return [...keys];
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
        amount: Math.abs(Number(item.amount || 0)),
        note: item.note || "",
        createdAt: item.createdAt || new Date().toISOString(),
      })),
  };
}

function saveState() {
  backupCurrentState();
  localStorage.setItem(storageKey, JSON.stringify(state, null, 2));
}

function backupCurrentState() {
  const current = readStoredState(storageKey);
  if (!current || !Array.isArray(current.transactions) || !current.transactions.length) {
    return;
  }

  const key = `${backupStoragePrefix}${new Date().toISOString()}`;
  localStorage.setItem(key, JSON.stringify(current, null, 2));
  pruneBackups();
}

function pruneBackups() {
  const backups = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(backupStoragePrefix)) {
      backups.push(key);
    }
  }

  backups.sort().slice(0, -10).forEach((key) => localStorage.removeItem(key));
}

function loadQuotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(quoteStorageKey));
    if (!saved || !saved.values || !Array.isArray(saved.dates)) {
      return emptyQuotes();
    }

    return {
      importedAt: saved.importedAt || "",
      values: saved.values,
      dates: saved.dates.filter((date) => Number.isFinite(Number(saved.values[date]))).sort(),
    };
  } catch {
    return emptyQuotes();
  }
}

function emptyQuotes() {
  return {
    importedAt: "",
    values: {},
    dates: [],
  };
}

function saveQuotes() {
  localStorage.setItem(quoteStorageKey, JSON.stringify(quotes, null, 2));
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

function hasQuotes() {
  return quotes.dates.length > 0;
}

function quoteForDate(iso, mode = "same-or-next") {
  if (!hasQuotes()) {
    return null;
  }

  const match = mode === "next"
    ? quotes.dates.find((date) => date > iso)
    : quotes.dates.find((date) => date >= iso);

  if (!match) {
    return null;
  }

  return {
    date: match,
    value: Number(quotes.values[match]),
  };
}

function quoteForDeposit(iso) {
  return quoteForDate(iso, "next");
}

function quoteForWithdrawal(iso) {
  return quoteForDate(iso, "next");
}

function buildLedger() {
  return hasQuotes() ? buildQuoteLedger() : buildEstimatedLedger();
}

function buildEstimatedLedger() {
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

function buildQuoteLedger() {
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
      const quote = quoteForDeposit(transaction.date);
      if (quote) {
        lots.push({
          id: transaction.id,
          date: transaction.date,
          quoteDate: quote.date,
          quote: quote.value,
          remainingUnits: transaction.amount / quote.value,
        });
      }

      totals.totalDeposits += transaction.amount;
      rows.push({
        ...transaction,
        taxable: 0,
        tax: 0,
        net: 0,
        unmatched: quote ? 0 : transaction.amount,
        remainingCost: sumRemainingCostFromUnits(lots),
        quoteDate: quote?.date || "",
      });
      return;
    }

    const quote = quoteForWithdrawal(transaction.date);
    const result = quote
      ? redeemUnitsFromLots(lots, transaction.amount, quote)
      : { taxable: 0, unmatched: transaction.amount, details: [] };
    const roundedTaxable = roundMoney(result.taxable);
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
      remainingCost: sumRemainingCostFromUnits(lots),
      quoteDate: quote?.date || "",
      details: result.details,
    });
  });

  totals.remainingCost = sumRemainingCostFromUnits(lots);
  const currentQuote = quoteForDate(calculationDate, "same-or-next");
  totals.estimatedPosition = currentQuote
    ? lots.reduce((sum, lot) => sum + lot.remainingUnits * currentQuote.value, 0)
    : totals.remainingCost;
  totals.unrealizedInterest = totals.estimatedPosition - totals.remainingCost;

  return {
    rows,
    totals: {
      ...totals,
      realizedTaxable: roundMoney(totals.realizedTaxable),
      taxWithheld: roundMoney(totals.taxWithheld),
      netWithdrawals: roundMoney(totals.netWithdrawals),
      remainingCost: roundMoney(totals.remainingCost),
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

function sumRemainingCostFromUnits(lots) {
  return lots.reduce((sum, lot) => sum + lot.remainingUnits * lot.quote, 0);
}

function redeemUnitsFromLots(lots, grossWithdrawal, withdrawalQuote) {
  let remainingUnits = grossWithdrawal / withdrawalQuote.value;
  let taxable = 0;
  const details = [];

  for (const lot of lots) {
    if (remainingUnits <= 0 || lot.remainingUnits <= 0) {
      continue;
    }

    const unitsFromLot = Math.min(remainingUnits, lot.remainingUnits);
    const grossFromLot = unitsFromLot * withdrawalQuote.value;
    const costFromLot = unitsFromLot * lot.quote;
    const gainFromLot = Math.max(0, grossFromLot - costFromLot);

    lot.remainingUnits = Math.max(0, lot.remainingUnits - unitsFromLot);
    taxable += gainFromLot;
    remainingUnits -= unitsFromLot;
    details.push({
      depositDate: lot.date,
      depositQuoteDate: lot.quoteDate,
      withdrawalQuoteDate: withdrawalQuote.date,
      gain: gainFromLot,
    });
  }

  return {
    taxable,
    unmatched: Math.max(0, remainingUnits * withdrawalQuote.value),
    details,
  };
}

function render() {
  elements.taxRate.value = state.settings.taxRate;
  elements.calculationDate.value = state.settings.calculationDate;
  renderQuoteStatus();

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
      const quoteInfo = transaction.quoteDate
        ? `<div class="quote-line">Cotacao: ${transaction.quoteDate}</div>`
        : "";
      return `
        <tr>
          <td>${transaction.date}</td>
          <td><span class="pill ${transaction.type}">${labels[transaction.type]}</span></td>
          <td>${escapeHtml(transaction.note || "-")}${quoteInfo}${warning}</td>
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

function renderQuoteStatus() {
  if (!elements.quoteStatus) {
    return;
  }

  if (!hasQuotes()) {
    elements.quoteStatus.textContent = "Sem cotacoes importadas. A app usa TANB como estimativa.";
    return;
  }

  const firstDate = quotes.dates[0];
  const lastDate = quotes.dates[quotes.dates.length - 1];
  elements.quoteStatus.textContent = `${quotes.dates.length} cotacoes importadas (${firstDate} a ${lastDate}).`;
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

if (elements.importQuotes) {
  elements.importQuotes.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      return;
    }

    try {
      if (!window.XLSX) {
        throw new Error("Biblioteca XLSX indisponivel");
      }

      const importedQuotes = await readQuotesFromExcel(file);
      if (!importedQuotes.dates.length) {
        throw new Error("Sem cotacoes");
      }

      quotes = importedQuotes;
      saveQuotes();
      render();
    } catch {
      alert("Nao foi possivel importar as cotacoes. Confirma se e o Excel da Fidelidade com DATA COTACAO e COTACAO.");
    } finally {
      event.target.value = "";
    }
  });
}

if (elements.clearQuotes) {
  elements.clearQuotes.addEventListener("click", () => {
    localStorage.removeItem(quoteStorageKey);
    quotes = emptyQuotes();
    render();
  });
}

elements.clearData.addEventListener("click", () => {
  const confirmed = confirm("Queres apagar todos os dados guardados neste browser?");
  if (!confirmed) {
    return;
  }

  backupCurrentState();
  localStorage.removeItem(storageKey);
  state = emptyState();
  elements.transactionDate.value = todayIso();
  render();
});

async function readQuotesFromExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const values = {};

  rows.forEach((row) => {
    const dateValue = row["DATA COTAÇÃO"] || row["DATA COTACAO"] || row["Data Cotação"] || row["Data Cotacao"];
    const quoteValue = row["COTAÇÃO"] || row["COTACAO"] || row["Cotação"] || row["Cotacao"];
    const date = normalizeExcelDate(dateValue);
    const quote = normalizeQuoteValue(quoteValue);

    if (date && Number.isFinite(quote)) {
      values[date] = quote;
    }
  });

  return {
    importedAt: new Date().toISOString(),
    values,
    dates: Object.keys(values).sort(),
  };
}

function normalizeExcelDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) {
      return "";
    }
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }

  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const pt = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (pt) {
    return `${pt[3]}-${pt[2].padStart(2, "0")}-${pt[1].padStart(2, "0")}`;
  }

  return "";
}

function normalizeQuoteValue(value) {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value || "")
    .replace("€", "")
    .replace(/\s/g, "")
    .replace(",", ".");

  return Number(normalized);
}

elements.transactionDate.value = todayIso();
if (!state.settings.calculationDate) {
  state.settings.calculationDate = todayIso();
}
render();
