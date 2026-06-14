const financeForm      = document.querySelector("#finance-form");
const calculateButton  = document.querySelector("#calculate-button");
const formMessage      = document.querySelector("#form-message");
const historyBody      = document.querySelector("#history-body");
const exportButton     = document.querySelector("#export-button");

let currentHistory = [];
let currentResult  = null;
let currentPeriod  = "bulanan";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
});
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "long", year: "numeric"
});

function formatCurrency(v) {
  return currencyFormatter.format(Number(v) || 0).replace(/\s/g, "");
}
function parseAmount(v) {
  return Number(String(v || "").replace(/[^\d]/g, ""));
}
function formatInput(e) {
  const n = parseAmount(e.target.value);
  e.target.value = n ? new Intl.NumberFormat("id-ID").format(n) : "";
}
function setText(sel, val) {
  const el = document.querySelector(sel);
  if (el) el.textContent = val;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function updateFinancialHealth(result) {
  const savingRatio = result.monthlyIncome > 0
    ? clampScore((result.monthlySavings / result.monthlyIncome) * 500)
    : 0;
  const emergencyScore = clampScore(result.emergencyCoverage);
  const expenseRatio = result.monthlyIncome > 0 ? result.monthlyExpense / result.monthlyIncome : 1;
  const expenseScore = clampScore(100 - Math.max(0, expenseRatio - 0.5) * 200);
  const healthScore = clampScore((savingRatio * 0.35) + (emergencyScore * 0.4) + (expenseScore * 0.25));

  let healthLabel = "Perlu Perhatian";
  let healthDescription = "Mulai perbaiki rasio tabungan dan dana daruratmu";
  if (healthScore >= 80) {
    healthLabel = "Sangat Baik";
    healthDescription = "Keuanganmu berada di jalur yang sehat";
  } else if (healthScore >= 65) {
    healthLabel = "Baik";
    healthDescription = "Sedikit penyesuaian akan membuat kondisi makin kuat";
  } else if (healthScore >= 45) {
    healthLabel = "Cukup";
    healthDescription = "Fokus pada dana darurat dan kontrol pengeluaran";
  }

  setText("#health-score-value", healthScore);
  setText("#health-status-text", healthLabel);
  setText("#saving-ratio-value", `${savingRatio}%`);
  setText("#emergency-score-value", `${emergencyScore}%`);
  setText("#expense-score-value", `${expenseScore}%`);

  const healthDescriptionElement = document.querySelector(".health-status > span:last-child");
  if (healthDescriptionElement) healthDescriptionElement.textContent = healthDescription;

  document.querySelector("#health-score-ring")?.style.setProperty("--health-progress", `${healthScore}%`);
  document.querySelector("#saving-ratio-bar")?.style.setProperty("--metric-progress", `${savingRatio}%`);
  document.querySelector("#emergency-score-bar")?.style.setProperty("--metric-progress", `${emergencyScore}%`);
  document.querySelector("#expense-score-bar")?.style.setProperty("--metric-progress", `${expenseScore}%`);
}

function updateSmartInsights(result) {
  const additionalSaving = Math.max(0, Math.round(result.monthlyIncome * 0.05));
  const expensePercent = result.monthlyIncome > 0
    ? Math.round((result.monthlyExpense / result.monthlyIncome) * 100)
    : 0;

  setText("#income-insight-value", `+${Math.max(8, Math.round(result.goalProgress / 5))}%`);
  setText("#income-insight-text", `Pendapatan ${periodLabel(currentPeriod)} aktif dan siap dialokasikan.`);
  setText("#expense-insight-value", `${expensePercent}%`);
  setText("#expense-insight-text", `${expensePercent}% pendapatan dialokasikan untuk kebutuhan utama.`);
  setText("#saving-insight-value", formatCurrency(additionalSaving));
  setText("#saving-insight-text", "Potensi tambahan tabungan dengan mengurangi 5% pengeluaran fleksibel.");
}

function updateSmartGoals(result) {
  const progress = clampScore(result.goalProgress);
  setText("#smart-primary-collected", formatCurrency(result.totalMoney));
  setText("#smart-primary-target", formatCurrency(result.savingTarget));
  setText("#smart-primary-percent", `${progress}%`);
  setText("#smart-primary-timeline", result.monthsToTarget ? `${result.monthsToTarget} bulan lagi` : "Target tercapai");
  document.querySelector("#smart-primary-progress")?.style.setProperty("--goal-card-progress", `${progress}%`);
}

function updateTransactionTimeline(result) {
  const timeline = document.querySelector("#transaction-timeline");
  if (!timeline) return;

  const dailyExpense = Math.round(result.monthlyExpense / 30);
  const flexibleExpense = Math.round(result.monthlyIncome * 0.03);
  timeline.innerHTML = `
    <div class="timeline-group">
      <span class="timeline-date">Hari Ini</span>
      <div class="timeline-item">
        <span class="transaction-icon transaction-income">↗</span>
        <div><strong>Pendapatan</strong><span>${periodLabel(currentPeriod)} aktif</span></div>
        <b class="transaction-plus">+ ${formatCurrency(fromMonthly(result.monthlyIncome, currentPeriod))}</b>
      </div>
      <div class="timeline-item">
        <span class="transaction-icon transaction-expense">↓</span>
        <div><strong>Kebutuhan Harian</strong><span>Estimasi rata-rata</span></div>
        <b class="transaction-minus">- ${formatCurrency(dailyExpense)}</b>
      </div>
    </div>
    <div class="timeline-group">
      <span class="timeline-date">Rencana Bulan Ini</span>
      <div class="timeline-item">
        <span class="transaction-icon transaction-income">↗</span>
        <div><strong>Target Tabungan</strong><span>Alokasi otomatis 20%</span></div>
        <b class="transaction-plus">+ ${formatCurrency(result.monthlySavings)}</b>
      </div>
      <div class="timeline-item">
        <span class="transaction-icon transaction-expense">↓</span>
        <div><strong>Pengeluaran Fleksibel</strong><span>Batas rekomendasi</span></div>
        <b class="transaction-minus">- ${formatCurrency(flexibleExpense)}</b>
      </div>
    </div>`;
}

// ─── Periode ──────────────────────────────────────────────────────────────────

function toMonthly(amount, period) {
  if (period === "harian")   return Math.round(amount * 30);
  if (period === "mingguan") return Math.round(amount * 4.33);
  if (period === "tahunan")  return Math.round(amount / 12);
  return amount;
}
function fromMonthly(amount, period) {
  if (period === "harian")   return Math.round(amount / 30);
  if (period === "mingguan") return Math.round(amount / 4.33);
  if (period === "tahunan")  return Math.round(amount * 12);
  return amount;
}
function periodLabel(p) {
  return p === "harian" ? "hari" :
    p === "mingguan" ? "minggu" :
    p === "tahunan" ? "tahun" : "bulan";
}

function syncPeriodButtons(period) {
  document.querySelectorAll(".period-btn, .analytics-period-btn").forEach(btn => {
    const active = btn.dataset.period === period;
    btn.classList.toggle("active", active);
    btn.classList.toggle("period-btn-active", active);
  });
  const labelEl = document.querySelector("#income-label-text");
  if (labelEl) labelEl.textContent =
    period === "harian" ? "Pendapatan Harian" :
    period === "mingguan" ? "Pendapatan Mingguan" :
    period === "tahunan" ? "Pendapatan Tahunan" : "Pendapatan Bulanan";
  const incInput = document.querySelector("#monthly-income");
  if (incInput) incInput.placeholder =
    period === "harian" ? "416.667" :
    period === "mingguan" ? "2.886.000" :
    period === "tahunan" ? "150.000.000" : "12.500.000";
}

function applyPeriod(period) {
  currentPeriod = period;
  syncPeriodButtons(period);
  if (currentResult) updateDashboard(currentResult);
  else updateCharts(null, currentHistory);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function updateDashboard(result) {
  const progress    = Math.max(0, Math.min(100, result.goalProgress));
  const dispIncome  = fromMonthly(result.monthlyIncome,  currentPeriod);
  const dispSavings = fromMonthly(result.monthlySavings, currentPeriod);
  const label       = periodLabel(currentPeriod);

  setText("#summary-total",      formatCurrency(result.totalMoney));
  setText("#summary-income",     formatCurrency(dispIncome));
  setText("#summary-savings",    formatCurrency(dispSavings));
  setText("#summary-saving-rate","20%");
  setText("#summary-emergency",  formatCurrency(result.emergencyTarget));

  const incSub = document.querySelector("#summary-income-sub");
  const savSub = document.querySelector("#summary-savings-sub");
  if (incSub) incSub.textContent = `Pendapatan per ${label}`;
  if (savSub) savSub.textContent = `Rekomendasi tabungan per ${label}`;

  setText("#goal-percent",   progress);
  setText("#goal-target",    formatCurrency(result.savingTarget));
  setText("#goal-collected", formatCurrency(result.totalMoney));
  setText("#goal-remaining", formatCurrency(result.remainingTarget));
  setText("#goal-status",    progress >= 100 ? "Tercapai" : progress >= 50 ? "On Track" : "Mulai Bertumbuh");

  document.querySelector("#goal-ring")?.style.setProperty("--goal-progress", `${progress}%`);
  document.querySelector("#goal-progress")?.style.setProperty("--goal-progress", `${progress}%`);

  const monthText = result.monthsToTarget
    ? `target diperkirakan tercapai dalam ${result.monthsToTarget} bulan.`
    : "target tabungan sudah tercapai.";
  setText("#goal-note-text",
    `Dengan tabungan ${formatCurrency(result.monthlySavings)} per bulan, ${monthText}`);

  updateFinancialHealth(result);
  updateSmartInsights(result);
  updateSmartGoals(result);
  updateTransactionTimeline(result);
  currentResult = result;
  updateCharts(result, currentHistory);
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const DAY_NAMES   = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

function buildBarChart(history, latestResult) {
  const chartBars  = document.querySelector(".chart-bars");
  const chartStat  = document.querySelector(".chart-stat");
  const barTitle   = document.querySelector(".bar-card .chart-heading div h3");
  const barSub     = document.querySelector(".bar-card .chart-heading div span");
  if (!chartBars) return;

  if (barTitle) barTitle.textContent =
    currentPeriod === "harian" ? "Arus Kas Harian" :
    currentPeriod === "mingguan" ? "Arus Kas Mingguan" :
    currentPeriod === "tahunan" ? "Arus Kas Tahunan" : "Arus Kas Bulanan";

  let pts = [];

  if (currentPeriod === "bulanan") {
    const map = {};
    history.forEach(item => {
      const d = new Date(item.createdAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map[k]) map[k] = { label: MONTH_NAMES[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), income:0, expense:0, count:0 };
      map[k].income += item.monthlyIncome; map[k].expense += item.monthlyExpense; map[k].count++;
    });
    if (latestResult) {
      const now = new Date(); const k = `${now.getFullYear()}-${now.getMonth()}`;
      if (!map[k]) map[k] = { label: MONTH_NAMES[now.getMonth()], year: now.getFullYear(), month: now.getMonth(), income: latestResult.monthlyIncome, expense: latestResult.monthlyExpense, count:1 };
    }
    pts = Object.values(map).sort((a,b) => a.year!==b.year?a.year-b.year:a.month-b.month).slice(-6)
      .map(m => ({ label:m.label, income:Math.round(m.income/m.count), expense:Math.round(m.expense/m.count) }));
    if (barSub) barSub.textContent = "6 bulan terakhir";
  } else if (currentPeriod === "mingguan") {
    const base = latestResult || history[0];
    if (!base) { chartBars.innerHTML = `<p style="color:#9ca3af;font-size:.85rem;padding:1rem">Isi form dulu.</p>`; return; }
    const wI = fromMonthly(base.monthlyIncome,"mingguan"), wE = fromMonthly(base.monthlyExpense,"mingguan");
    [0.92,0.98,1.05,0.96,1.08,1.0].forEach((v,i) => pts.push({ label:`W${i+1}`, income:Math.round(wI*v), expense:Math.round(wE*v) }));
    if (barSub) barSub.textContent = "6 minggu terakhir";
  } else if (currentPeriod === "harian") {
    const base = latestResult || history[0];
    if (!base) { chartBars.innerHTML = `<p style="color:#9ca3af;font-size:.85rem;padding:1rem">Isi form dulu.</p>`; return; }
    const dI = fromMonthly(base.monthlyIncome,"harian"), dE = fromMonthly(base.monthlyExpense,"harian");
    const today = new Date();
    [0.8,1.1,0.95,1.2,0.9,1.05,1.0].forEach((v,i) => {
      const d = new Date(today); d.setDate(today.getDate()-(6-i));
      pts.push({ label:DAY_NAMES[d.getDay()], income:Math.round(dI*v), expense:Math.round(dE*v) });
    });
    if (barSub) barSub.textContent = "7 hari terakhir";
  } else {
    const yearlyMap = {};
    history.forEach(item => {
      const year = new Date(item.createdAt).getFullYear();
      if (!yearlyMap[year]) {
        yearlyMap[year] = { label: String(year), income: 0, expense: 0, count: 0 };
      }
      yearlyMap[year].income += fromMonthly(item.monthlyIncome, "tahunan");
      yearlyMap[year].expense += fromMonthly(item.monthlyExpense, "tahunan");
      yearlyMap[year].count += 1;
    });

    pts = Object.values(yearlyMap)
      .sort((a, b) => Number(a.label) - Number(b.label))
      .slice(-6)
      .map(item => ({
        label: item.label,
        income: Math.round(item.income / item.count),
        expense: Math.round(item.expense / item.count)
      }));

    if (!pts.length) {
      const base = latestResult || history[0];
      if (!base) {
        chartBars.innerHTML = `<p style="color:#9ca3af;font-size:.85rem;padding:1rem">Isi form dulu.</p>`;
        return;
      }
      const year = new Date().getFullYear();
      pts = [{
        label: String(year),
        income: fromMonthly(base.monthlyIncome, "tahunan"),
        expense: fromMonthly(base.monthlyExpense, "tahunan")
      }];
    }
    if (barSub) barSub.textContent = "Ringkasan per tahun";
  }

  if (!pts.length) { chartBars.innerHTML = `<p style="color:#9ca3af;font-size:.85rem;padding:1rem">Isi form untuk menampilkan data.</p>`; return; }

  const maxVal = Math.max(...pts.map(m=>m.income), 1);
  if (pts.length >= 2 && chartStat) {
    const pct = ((pts.at(-1).income - pts[0].income) / pts[0].income * 100).toFixed(1);
    chartStat.textContent = `${pct>=0?"+":""}${pct}%`;
    chartStat.style.color = pct>=0?"var(--primary,#16a34a)":"#ef4444";
  }
  const yL = document.querySelector(".y-labels");
  if (yL) {
    const f = v => v>=1_000_000?`${(v/1_000_000).toFixed(0)}jt`:v>=1_000?`${(v/1_000).toFixed(0)}rb`:v;
    yL.innerHTML = `<span>${f(maxVal)}</span><span>${f(Math.round(maxVal*.75))}</span><span>${f(Math.round(maxVal*.5))}</span><span>0</span>`;
  }
  chartBars.innerHTML = pts.map((m,i) => `
    <div class="bar-group">
      <div class="bar income${i===pts.length-1?" current":""}" style="--height:${Math.round(m.income/maxVal*90)}%" title="Pendapatan: ${formatCurrency(m.income)}"></div>
      <div class="bar expense" style="--height:${Math.round(m.expense/maxVal*90)}%" title="Pengeluaran: ${formatCurrency(m.expense)}"></div>
      <span>${m.label}</span>
    </div>`).join("");
}

function buildPieChart(result) {
  const pieChart  = document.querySelector(".pie-chart");
  const pieCenter = document.querySelector(".pie-center strong");
  const legend    = document.querySelector(".chart-legend");
  const headSpan  = document.querySelector(".chart-card:not(.bar-card) .chart-heading div span");
  if (!pieChart || !result) return;

  const total = fromMonthly(result.monthlyExpense, currentPeriod);
  const segs = [
    {label:"Kebutuhan",    pct:45, color:"var(--primary,#16a34a)", cls:"color-one"},
    {label:"Transportasi", pct:25, color:"#4ade80",                cls:"color-two"},
    {label:"Hiburan",      pct:18, color:"#86efac",                cls:"color-three"},
    {label:"Lainnya",      pct:12, color:"#bbf7d0",                cls:"color-four"}
  ];
  if (pieCenter) pieCenter.textContent = total>=1_000_000?`Rp${(total/1_000_000).toFixed(1)}jt`:formatCurrency(total);
  if (headSpan) {
    const now = new Date();
    headSpan.textContent = currentPeriod==="harian"?`${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`:
      currentPeriod==="mingguan"?"Minggu ini":
      currentPeriod==="tahunan"?`Tahun ${now.getFullYear()}`:`${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }
  if (legend) legend.innerHTML = segs.map(s=>`<div><span><i class="legend-color ${s.cls}"></i>${s.label}</span><strong>${s.pct}%</strong></div>`).join("");
  pieChart.style.background = `conic-gradient(${segs.map((s,i)=>{const st=segs.slice(0,i).reduce((a,x)=>a+x.pct,0);return `${s.color} ${st}% ${st+s.pct}%`;}).join(",")})`;
}

function updateCharts(result, history) {
  buildBarChart(history, result);
  buildPieChart(result);
}

// ─── History ──────────────────────────────────────────────────────────────────

function createHistoryRow(item) {
  const row = document.createElement("tr");
  const date = new Date(item.createdAt);
  row.innerHTML = `
    <td><span class="date-cell"><strong>${String(date.getDate()).padStart(2,"0")}</strong><span>${dateFormatter.format(date).replace(/^\d+\s/,"")}</span></span></td>
    <td class="income-text">+${formatCurrency(item.monthlyIncome)}</td>
    <td class="expense-text">-${formatCurrency(item.monthlyExpense)}</td>
    <td>${formatCurrency(item.monthlySavings)}</td>
    <td><span class="status-pill${item.status==="Sehat"?"":" status-warning"}">${item.status}</span></td>`;
  return row;
}

function renderHistory(history) {
  currentHistory = history;
  historyBody.replaceChildren();
  if (!history.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5">Belum ada riwayat. Isi form untuk membuat rencana pertama.</td>';
    historyBody.append(row); return;
  }
  history.forEach(item => historyBody.append(createHistoryRow(item)));
}

async function loadHistory() {
  try {
    const res  = await fetch("/api/history");
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderHistory(data.history || []);
    if (data.history?.[0]) updateDashboard(data.history[0]);
    buildBarChart(data.history || [], currentResult);
  } catch {
    formMessage.textContent = "Jalankan website melalui server Node agar fitur backend aktif.";
    formMessage.className   = "form-message error";
  }
}

// ─── Form submit ──────────────────────────────────────────────────────────────

financeForm?.addEventListener("submit", async e => {
  e.preventDefault();
  formMessage.textContent = "";
  formMessage.className   = "form-message";
  calculateButton.disabled = true;
  calculateButton.querySelector("span").textContent = "Memproses...";

  const rawIncome     = parseAmount(document.querySelector("#monthly-income").value);
  const monthlyIncome = toMonthly(rawIncome, currentPeriod);

  const payload = {
    name:         document.querySelector("#full-name").value,
    totalMoney:   parseAmount(document.querySelector("#total-money").value),
    monthlyIncome,
    savingTarget: parseAmount(document.querySelector("#saving-target").value)
  };

  try {
    const res  = await fetch("/api/finance", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Data gagal diproses.");
    updateDashboard(data.result);
    formMessage.textContent = data.message;
    formMessage.className   = "form-message success";
    await loadHistory();
    document.querySelector("#target")?.scrollIntoView({ behavior:"smooth", block:"center" });
  } catch(err) {
    formMessage.textContent = err.message;
    formMessage.className   = "form-message error";
  } finally {
    calculateButton.disabled = false;
    calculateButton.querySelector("span").textContent = "Hitung Keuangan";
  }
});

// ─── Input formatting ─────────────────────────────────────────────────────────

document.querySelectorAll('input[inputmode="numeric"]').forEach(input => {
  input.addEventListener("input", formatInput);
});

// ─── Export CSV ───────────────────────────────────────────────────────────────

exportButton?.addEventListener("click", () => {
  if (!currentHistory.length) return;
  const rows = [
    ["Tanggal","Nama","Pendapatan (Bulanan)","Pengeluaran","Tabungan","Status"],
    ...currentHistory.map(item => [dateFormatter.format(new Date(item.createdAt)), item.name, item.monthlyIncome, item.monthlyExpense, item.monthlySavings, item.status])
  ];
  const csv  = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`],{type:"text/csv;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"),{href:url,download:"riwayat-keuangan.csv"}).click();
  URL.revokeObjectURL(url);
});

// ─── SATU click handler untuk semua ─────────────────────────────────────────

const aiChatTrigger = document.querySelector("#ai-chat-trigger");
const aiChatPanel = document.querySelector("#ai-chat-panel");
const aiChatClose = document.querySelector("#ai-chat-close");
const aiChatForm = document.querySelector("#ai-chat-form");
const aiChatInput = document.querySelector("#ai-chat-input");
const aiChatBody = document.querySelector("#ai-chat-body");

function toggleAiChat(forceOpen) {
  const shouldOpen = typeof forceOpen === "boolean"
    ? forceOpen
    : !aiChatPanel?.classList.contains("open");
  aiChatPanel?.classList.toggle("open", shouldOpen);
  aiChatPanel?.setAttribute("aria-hidden", String(!shouldOpen));
  aiChatTrigger?.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) setTimeout(() => aiChatInput?.focus(), 180);
}

function appendChatMessage(message, sender = "bot", allowHtml = false) {
  if (!aiChatBody) return;
  const wrapper = document.createElement("div");
  wrapper.className = `ai-message ai-message-${sender}`;
  if (sender === "bot") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.textContent = "AI";
    wrapper.append(avatar);
  }
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (allowHtml) bubble.innerHTML = message;
  else bubble.textContent = message;
  wrapper.append(bubble);
  aiChatBody.append(wrapper);
  aiChatBody.scrollTop = aiChatBody.scrollHeight;
}

function showTypingIndicator() {
  if (!aiChatBody) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "ai-message ai-message-bot";
  wrapper.innerHTML = '<span class="message-avatar">AI</span><div class="message-bubble ai-typing"><i></i><i></i><i></i></div>';
  aiChatBody.append(wrapper);
  aiChatBody.scrollTop = aiChatBody.scrollHeight;
  return wrapper;
}

function extractSalary(question) {
  const normalized = question.toLowerCase().replace(/\./g, "").replace(/,/g, ".");
  const jutaMatch = normalized.match(/(\d+(?:\.\d+)?)\s*juta/);
  if (jutaMatch) return Math.round(Number(jutaMatch[1]) * 1_000_000);
  const rupiahMatch = normalized.match(/(?:rp\s*)?(\d{6,12})/);
  return rupiahMatch ? Number(rupiahMatch[1]) : null;
}

function buildAiResponse(question) {
  const lower = question.toLowerCase();
  const salary = extractSalary(question);

  if (salary || lower.includes("gaji")) {
    const baseSalary = salary || currentResult?.monthlyIncome || 5_000_000;
    return `<strong>Rekomendasi pembagian ${formatCurrency(baseSalary)}:</strong>
      <p>50% Kebutuhan: <b>${formatCurrency(baseSalary * 0.5)}</b><br>
      30% Keinginan: <b>${formatCurrency(baseSalary * 0.3)}</b><br>
      20% Tabungan: <b>${formatCurrency(baseSalary * 0.2)}</b></p>
      <p>Target tabungan idealmu adalah <b>${formatCurrency(baseSalary * 0.2)}/bulan</b>.</p>`;
  }
  if (lower.includes("darurat")) {
    const monthlyExpense = currentResult?.monthlyExpense || 2_500_000;
    return `<strong>Target dana darurat:</strong><p>Minimal 6 kali pengeluaran bulanan, yaitu sekitar <b>${formatCurrency(monthlyExpense * 6)}</b>.</p><p>Mulai dari target 1 bulan biaya hidup, lalu naikkan bertahap sampai 6–12 bulan.</p>`;
  }
  if (lower.includes("100 juta") || lower.includes("100000000")) {
    const monthlySaving = currentResult?.monthlySavings || 2_000_000;
    const months = Math.ceil(100_000_000 / monthlySaving);
    return `<strong>Strategi target Rp100 juta:</strong><p>Dengan tabungan <b>${formatCurrency(monthlySaving)}/bulan</b>, estimasi waktu sekitar <b>${months} bulan</b>.</p><p>Percepat dengan auto-debit, bonus tahunan, dan menaikkan tabungan 5% setiap 3 bulan.</p>`;
  }
  if (lower.includes("lambat") || lower.includes("tabungan")) {
    const income = currentResult?.monthlyIncome || 5_000_000;
    const saving = currentResult?.monthlySavings || income * 0.2;
    return `<strong>Tabungan terasa lambat biasanya karena tiga hal:</strong><p>1. Target terlalu besar tanpa milestone.<br>2. Tabungan dilakukan di akhir bulan.<br>3. Pengeluaran fleksibel tidak dibatasi.</p><p>Mulai dengan auto-save <b>${formatCurrency(saving)}/bulan</b>.</p>`;
  }
  if (lower.includes("pengeluaran") || lower.includes("hemat")) {
    return `<strong>Cara cepat mengontrol pengeluaran:</strong><p>Tetapkan batas mingguan, pisahkan rekening kebutuhan dan keinginan, lalu evaluasi tiga pengeluaran terbesar setiap akhir minggu.</p>`;
  }
  return `<strong>Saran awal untukmu:</strong><p>Gunakan metode 50/30/20, bangun dana darurat, dan buat target tabungan dengan nominal serta tenggat yang jelas.</p><p>Kamu juga bisa bertanya tentang gaji, dana darurat, pengeluaran, atau target Rp100 juta.</p>`;
}

function askFinanceAi(question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) return;
  appendChatMessage(cleanQuestion, "user");
  aiChatInput.value = "";
  const typing = showTypingIndicator();
  setTimeout(() => {
    typing?.remove();
    appendChatMessage(buildAiResponse(cleanQuestion), "bot", true);
  }, 650);
}

aiChatTrigger?.addEventListener("click", () => toggleAiChat());
aiChatClose?.addEventListener("click", () => toggleAiChat(false));
aiChatForm?.addEventListener("submit", event => {
  event.preventDefault();
  askFinanceAi(aiChatInput?.value);
});
document.querySelector("#ai-quick-prompts")?.addEventListener("click", event => {
  const button = event.target.closest("button[data-question]");
  if (button) askFinanceAi(button.dataset.question);
});
document.querySelector("#add-goal-button")?.addEventListener("click", () => {
  toggleAiChat(true);
  setTimeout(() => askFinanceAi("Strategi menabung untuk target baru"), 180);
});

document.addEventListener("click", e => {
  // 1. Tombol periode pemasukan dan analytics
  const periodBtn = e.target.closest(".period-btn, .analytics-period-btn");
  if (periodBtn) {
    e.preventDefault();
    e.stopPropagation();
    applyPeriod(periodBtn.dataset.period);
    return;
  }

  // 2. Link navigasi (#hash)
  const navLink = e.target.closest("a[href^='#']");
  if (navLink) {
    const href = navLink.getAttribute("href");
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior:"smooth", block:"start" });
      setActiveNav(href);
      document.querySelector(".app-shell")?.classList.remove("sidebar-open");
    }
  }
});

// ─── Navigasi aktif ───────────────────────────────────────────────────────────

function setActiveNav(href) {
  document.querySelectorAll(".nav-link, .topbar-links a").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === href);
  });
}

// IntersectionObserver — update active state saat scroll
const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) setActiveNav(`#${entry.target.id}`);
  });
}, { threshold: 0.25, rootMargin:"-80px 0px -40% 0px" });

["#dashboard","#keuangan","#target","#analytics","#riwayat","#pengaturan"].forEach(sel => {
  const el = document.querySelector(sel);
  if (el) navObserver.observe(el);
});

// Mobile menu
document.querySelector(".menu-button")?.addEventListener("click", () => {
  document.querySelector(".app-shell")?.classList.toggle("sidebar-open");
});

// ─── Init ─────────────────────────────────────────────────────────────────────

syncPeriodButtons(currentPeriod);
loadHistory();
