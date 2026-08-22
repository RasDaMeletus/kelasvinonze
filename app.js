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

let cashChartInstance = null;

function rupiah(n) {
  n = Math.round(Number(n || 0));
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp' + Math.abs(n).toLocaleString('id-ID');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function apiUrl(action, params = {}) {
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set('action', action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function apiGet(action, params = {}) {
  const response = await fetch(apiUrl(action, params), {
    method: 'GET',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Server API merespons HTTP ${response.status}.`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Terjadi kesalahan pada server.');
  }

  return result.data;
}

function drawCashChart(data) {
  const canvas = document.getElementById('cashChart');
  if (!canvas || !window.Chart) return;

  if (cashChartInstance) cashChartInstance.destroy();

  cashChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: 'Saldo',
          data: data.balance || [],
          borderWidth: 3,
          tension: .35,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: 'Pemasukan',
          data: data.income || [],
          borderWidth: 2,
          tension: .35,
          fill: false,
          pointRadius: 2
        },
        {
          label: 'Pengeluaran',
          data: data.expense || [],
          borderWidth: 2,
          tension: .35,
          fill: false,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ' ' + ctx.dataset.label + ': ' + rupiah(ctx.raw);
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148,163,184,.12)' },
          ticks: {
            font: { size: 9 },
            callback: function(v) {
              if (Math.abs(v) >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1) + 'jt';
              if (Math.abs(v) >= 1000) return 'Rp ' + (v / 1000).toFixed(0) + 'rb';
              return 'Rp ' + v;
            }
          }
        }
      }
    }
  });
}

async function loadLiveTransparency() {
  const status = document.getElementById('liveStatus');

  try {
    const res = await apiGet('getTransparencyDashboard');

    setText('liveSaldo', rupiah(res.saldo ?? res.balance ?? 0));
    setText('liveMasuk', rupiah(res.totalMasuk ?? res.masuk ?? res.income ?? 0));
    setText('liveKeluar', rupiah(res.totalKeluar ?? res.keluar ?? res.expense ?? 0));
    setText('liveMinggu', res.mingguBerjalan ?? res.week ?? '-');
    setText('liveLunas', res.lunas ?? res.paid ?? '-');
    setText('liveBelumLunas', res.belumLunas ?? res.unpaid ?? '-');
    setText('liveUpdated', new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    }));

    if (res.labels && (res.balance || res.saldoHistory || res.income || res.expense)) {
      drawCashChart({
        labels: res.labels,
        balance: res.balance || res.saldoHistory || [],
        income: res.income || [],
        expense: res.expense || []
      });
    }

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

  loadStudentList();
  loadLiveTransparency();
  setInterval(loadLiveTransparency, 60000);
});
