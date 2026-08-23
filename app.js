/*
 * Kas Kelas 12.5 — Portal Siswa (Vercel)
 *
 * IMPORTANT:
 * Paste your deployed Google Apps Script Web App URL below.
 * Example:
 * https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
 */
const GAS_URL = '';
const API_BASE = '/api/gas';

// Menyimpan payload terakhir dari getTransparencyDashboard supaya tab
// riwayat (Semua/Pemasukan/Pengeluaran) bisa difilter di frontend tanpa
// request tambahan ke server.
let lastTransparencyData = null;


/**
 * Call the Vercel API proxy and unwrap the Google Apps Script response.
 * The Apps Script API returns: { success: true, data: ... }
 */
async function apiGet(action, params = {}) {
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set('action', action);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Accept': 'application/json' }
  });

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw new Error('Server mengembalikan response yang bukan JSON.');
  }

  if (!response.ok || !payload || payload.success !== true) {
    throw new Error(
      (payload && payload.error) ||
      `Request gagal (${response.status}).`
    );
  }

  return payload.data;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function rupiah(value) {
  const number = Number(value) || 0;
  return 'Rp' + Math.round(number).toLocaleString('id-ID');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function drawCashChart(data) {
  const container = document.getElementById('cashChart');
  if (!container) return;

  const labels = Array.isArray(data.labels) ? data.labels : [];
  const balance = Array.isArray(data.balance) ? data.balance.map(Number) : [];
  const income = Array.isArray(data.income) ? data.income.map(Number) : [];
  const expense = Array.isArray(data.expense) ? data.expense.map(Number) : [];
  const count = Math.max(labels.length, balance.length, income.length, expense.length);

  if (!count) {
    container.innerHTML = '<div class="chart-empty">Belum ada transaksi untuk ditampilkan.</div>';
    return;
  }

  const W = 900, H = 260;
  const pad = { left: 58, right: 18, top: 18, bottom: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const allValues = balance.concat(income, expense).filter(Number.isFinite);
  let maxValue = Math.max(0, ...allValues);
  let minValue = Math.min(0, ...allValues);
  if (maxValue === minValue) {
    maxValue += maxValue === 0 ? 10000 : Math.abs(maxValue) * .2;
  }
  const range = maxValue - minValue || 1;
  const x = i => count === 1 ? pad.left + plotW / 2 : pad.left + (i * plotW / (count - 1));
  const y = v => pad.top + (maxValue - v) * plotH / range;
  const fmt = v => {
    v = Number(v) || 0;
    if (Math.abs(v) >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1) + 'jt';
    if (Math.abs(v) >= 1000) return 'Rp ' + Math.round(v / 1000) + 'rb';
    return 'Rp ' + Math.round(v);
  };
  const safe = arr => Array.from({length: count}, (_, i) => Number(arr[i] || 0));
  const b = safe(balance), inc = safe(income), exp = safe(expense);
  const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = arr => {
    if (count === 1) return '';
    const base = y(minValue);
    return path(arr) + ' L ' + x(count - 1).toFixed(1) + ' ' + base.toFixed(1) + ' L ' + x(0).toFixed(1) + ' ' + base.toFixed(1) + ' Z';
  };

  const grid = [];
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const value = minValue + range * (i / ticks);
    const yy = y(value);
    grid.push('<line x1="' + pad.left + '" y1="' + yy.toFixed(1) + '" x2="' + (W-pad.right) + '" y2="' + yy.toFixed(1) + '" class="chart-grid"/>');
    grid.push('<text x="' + (pad.left - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" class="chart-axis">' + escapeHtml(fmt(value)) + '</text>');
  }

  const labelStep = Math.max(1, Math.ceil(count / 7));
  const xLabels = [];
  for (let i = 0; i < count; i += labelStep) {
    xLabels.push('<text x="' + x(i).toFixed(1) + '" y="' + (H - 15) + '" text-anchor="middle" class="chart-axis">' + escapeHtml(labels[i] || '') + '</text>');
  }
  if (count > 1 && (count - 1) % labelStep !== 0) {
    xLabels.push('<text x="' + x(count - 1).toFixed(1) + '" y="' + (H - 15) + '" text-anchor="middle" class="chart-axis">' + escapeHtml(labels[count - 1] || '') + '</text>');
  }

  const points = (arr, cls) => arr.map((v, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" class="' + cls + '"/>').join('');

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik saldo, pemasukan, dan pengeluaran">' +
      '<g>' + grid.join('') + '</g>' +
      '<path d="' + area(b) + '" class="chart-area"/>' +
      '<path d="' + path(b) + '" class="chart-line chart-balance"/>' +
      '<path d="' + path(inc) + '" class="chart-line chart-income"/>' +
      '<path d="' + path(exp) + '" class="chart-line chart-expense"/>' +
      points(b, 'chart-dot chart-balance-dot') +
      points(inc, 'chart-dot chart-income-dot') +
      points(exp, 'chart-dot chart-expense-dot') +
      '<g>' + xLabels.join('') + '</g>' +
    '</svg>' +
    '<div class="chart-legend">' +
      '<span><i class="legend-dot balance"></i>Saldo</span>' +
      '<span><i class="legend-dot income"></i>Pemasukan</span>' +
      '<span><i class="legend-dot expense"></i>Pengeluaran</span>' +
    '</div>';
}

async function loadLiveTransparency() {
  const status = document.getElementById('liveStatus');

  try {
    const res = await apiGet('getTransparencyDashboard');
    lastTransparencyData = res;

    setText('liveSaldo', rupiah(res.saldo ?? res.balance ?? 0));
    setText('liveMasuk', rupiah(res.totalMasuk ?? res.masuk ?? res.income ?? 0));
    setText('liveKeluar', rupiah(res.totalKeluar ?? res.keluar ?? res.expense ?? 0));
    setText('liveMinggu', res.mingguBerjalan ?? res.week ?? '-');
    setText('liveLunas', res.lunas ?? res.paid ?? '-');
    setText('liveBelumLunas', res.belumLunas ?? res.unpaid ?? '-');
    setText('liveUpdated', new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    }));

    drawCashChart({
      labels: res.labels || [],
      balance: res.balance || res.saldoHistory || [],
      income: res.income || [],
      expense: res.expense || []
    });

    renderTxTable(document.querySelector('#txTabBar .tab-btn.active')?.getAttribute('data-view') || 'semua');

    if (status) {
      status.textContent = '● Data live';
      status.className = 'status-pill pill-green';
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    if (status) {
      status.textContent = '● Gagal memuat';
      status.className = 'status-pill pill-amber';
    }
  }
}

function renderTxTable(view) {
  const tbody = document.getElementById('tableTx');
  if (!tbody || !lastTransparencyData) return;

  const list = view === 'masuk' ? lastTransparencyData.pemasukanHistory
             : view === 'keluar' ? lastTransparencyData.pengeluaranHistory
             : lastTransparencyData.transactions;

  let rows = '';
  (list || []).forEach(function(t) {
    const cls = t.jenis === 'masuk' ? 'tag-masuk' : 'tag-keluar';
    const sign = t.jenis === 'masuk' ? '+' : '-';
    rows += '<tr><td>' + escapeHtml(t.tanggal) + '</td><td>' + escapeHtml(t.deskripsi) + '</td>' +
            '<td class="' + cls + '">' + sign + rupiah(t.jumlah) + '</td>' +
            '<td>' + rupiah(t.saldo) + '</td></tr>';
  });

  const emptyMsg = view === 'masuk' ? 'Belum ada pemasukan.'
                 : view === 'keluar' ? 'Belum ada pengeluaran.'
                 : 'Belum ada transaksi.';
  tbody.innerHTML = rows || '<tr><td colspan="4" class="muted">' + emptyMsg + '</td></tr>';
}

async function loadStudentList() {
  const select = document.getElementById('namaSelect');

  try {
    const names = await apiGet('getStudentList');

    select.innerHTML = '<option value="">-- Pilih nama kamu --</option>';
    names.forEach(function(name) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Student list error:', error);
    select.innerHTML = '<option value="">Gagal memuat daftar siswa</option>';
  }
}

async function cekStatus() {
  const nama = document.getElementById('namaSelect').value;
  const resultDiv = document.getElementById('result');
  const btn = document.getElementById('cekBtn');

  if (!nama) {
    resultDiv.innerHTML = '<div class="card"><p class="msg err show">Pilih nama dulu ya.</p></div>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Mengecek...';

  try {
    const data = await apiGet('getStudentStatus', { nama });
    renderResult(data);
  } catch (error) {
    resultDiv.innerHTML = '<div class="card"><p class="msg err show">' + escapeHtml(error.message) + '</p></div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Cek Status Kas';
  }
}

function renderResult(data) {
  const resultDiv = document.getElementById('result');
  const history = Array.isArray(data.history) ? data.history : [];
  const pillClass = data.lunas ? 'pill-green' : 'pill-red';
  const pillText = data.lunas
    ? (data.kurang < 0 ? 'LEBIH BAYAR' : 'LUNAS')
    : 'BELUM LUNAS';
  const kurangLabel = data.kurang <= 0 ? 'Sisa lebih / lunas' : 'Kekurangan';
  const kurangValue = data.kurang <= 0
    ? rupiah(Math.abs(data.kurang))
    : rupiah(data.kurang);

  let historyRows = '';
  if (history.length === 0) {
    historyRows = '<tr><td colspan="3" class="muted">Belum ada riwayat pembayaran.</td></tr>';
  } else {
    history.forEach(function(item) {
      historyRows += '<tr>' +
        '<td>' + escapeHtml(item.tanggal) + '</td>' +
        '<td>' + rupiah(item.jumlah) + '</td>' +
        '<td class="muted">' + escapeHtml(item.keterangan || '-') + '</td>' +
      '</tr>';
    });
  }

  resultDiv.innerHTML =
    '<div class="card">' +
      '<h2>' + escapeHtml(data.nama) + '</h2>' +
      '<span class="status-pill ' + pillClass + '">' + pillText + '</span>' +
      '<div class="big-number">' + kurangValue + '</div>' +
      '<p class="muted">' + kurangLabel + ' (dihitung sampai hari ini)</p>' +
      '<div class="stat-grid" style="margin-top:14px;">' +
        '<div class="stat-box"><div class="label">Minggu Berjalan</div><div class="value">' + Number(data.weeksElapsed || 0) + '</div></div>' +
        '<div class="stat-box"><div class="label">Iuran / Minggu</div><div class="value">' + rupiah(data.weeklyFee) + '</div></div>' +
        '<div class="stat-box"><div class="label">Total Wajib</div><div class="value">' + rupiah(data.totalDue) + '</div></div>' +
        '<div class="stat-box"><div class="label">Total Dibayar</div><div class="value">' + rupiah(data.totalPaid) + '</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>Riwayat Pembayaran</h2>' +
      '<table><thead><tr><th>Tanggal</th><th>Jumlah</th><th>Ket.</th></tr></thead><tbody>' + historyRows + '</tbody></table>' +
    '</div>';
}

window.addEventListener('DOMContentLoaded', function() {
  document.getElementById('cekBtn')?.addEventListener('click', cekStatus);

  const txTabBar = document.getElementById('txTabBar');
  if (txTabBar) {
    txTabBar.addEventListener('click', function(e) {
      const btn = e.target.closest ? e.target.closest('.tab-btn') : null;
      if (!btn) return;
      txTabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTxTable(btn.getAttribute('data-view'));
    });
  }

  loadStudentList();
  loadLiveTransparency();
  setInterval(loadLiveTransparency, 60000);
});
