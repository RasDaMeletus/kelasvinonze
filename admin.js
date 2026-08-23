/*
 * Kas Kelas 12.5 — Admin Bendahara (Vercel)
 * Pakai apiGet/apiPost/rupiah/escapeHtml dari common.js.
 */
let PIN = '';

function showMsg(id, text, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + (ok ? 'ok' : 'err');
  setTimeout(function() { el.classList.remove('show'); }, 4000);
}

async function login() {
  const pinInput = document.getElementById('pinInput');
  const errEl = document.getElementById('loginErr');
  const btn = document.getElementById('loginBtn');
  const pin = pinInput.value;

  errEl.classList.remove('show');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Masuk...';

  try {
    const data = await apiPost('login', { pin });
    PIN = pin;
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    renderDashboard(data);
    document.getElementById('bayarTanggal').valueAsDate = new Date();
    document.getElementById('keluarTanggal').valueAsDate = new Date();
  } catch (error) {
    errEl.textContent = error.message;
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
}

async function refreshDashboard() {
  const data = await apiPost('getAdminDashboard', { pin: PIN });
  renderDashboard(data);
  return data;
}

function renderDashboard(d) {
  d = d || {};

  document.getElementById('dSaldo').textContent = rupiah(d.saldoSaatIni);
  document.getElementById('dTerkumpul').textContent = rupiah(d.totalTerkumpul);
  document.getElementById('dPengeluaran').textContent = rupiah(d.totalPengeluaran);
  document.getElementById('dMinggu').textContent = d.weeksElapsed;
  document.getElementById('dLunas').textContent = d.jumlahLunas;
  document.getElementById('dBelumLunas').textContent = d.jumlahBelumLunas;
  document.getElementById('dTglMulai').textContent = d.tanggalMulai;

  const sel = document.getElementById('bayarNama');
  const prevValue = sel.value;
  sel.innerHTML = '';
  (d.students || []).forEach(function(s) {
    const opt = document.createElement('option');
    opt.value = s.nama;
    opt.textContent = s.nama;
    sel.appendChild(opt);
  });
  if (prevValue) sel.value = prevValue;

  let pRows = '';
  (d.recentPayments || []).forEach(function(p) {
    pRows += '<tr><td>' + escapeHtml(p.nama) + '</td><td>' +
      escapeHtml(p.tanggal) + '</td><td>' + rupiah(p.jumlah) + '</td></tr>';
  });
  document.getElementById('tablePembayaran').innerHTML =
    pRows || '<tr><td colspan="3" class="muted">Belum ada data.</td></tr>';

  let eRows = '';
  (d.recentExpenses || []).forEach(function(e) {
    eRows += '<tr><td>' + escapeHtml(e.tanggal) + '</td><td>' +
      escapeHtml(e.deskripsi) + '</td><td>' + rupiah(e.jumlah) + '</td></tr>';
  });
  document.getElementById('tablePengeluaran').innerHTML =
    eRows || '<tr><td colspan="3" class="muted">Belum ada data.</td></tr>';

  let sRows = '';
  (d.students || []).forEach(function(s) {
    const pill = s.lunas
      ? '<span class="status-pill pill-green">Lunas</span>'
      : '<span class="status-pill pill-red">Kurang</span>';
    sRows += '<tr><td>' + escapeHtml(s.nama) + '</td><td>' +
      rupiah(s.totalPaid) + '</td><td>' +
      (s.kurang > 0 ? rupiah(s.kurang) : '-') +
      '</td><td>' + pill + '</td></tr>';
  });
  document.getElementById('tableSiswa').innerHTML =
    sRows || '<tr><td colspan="4" class="muted">Belum ada data siswa.</td></tr>';

  const startInput = document.getElementById('setTanggalMulai');
  const feeInput = document.getElementById('setIuran');
  const saldoInput = document.getElementById('setSaldoAwal');
  if (startInput && d.tanggalMulaiISO) startInput.value = d.tanggalMulaiISO;
  if (feeInput && d.weeklyFee != null) feeInput.value = d.weeklyFee;
  if (saldoInput && d.saldoAwal != null) saldoInput.value = d.saldoAwal;
}

function showTab(name, button) {
  const tabs = ['bayar', 'keluar', 'siswa', 'setting'];

  tabs.forEach(function(t) {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.style.display = (t === name) ? 'block' : 'none';
  });

  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });

  if (button) {
    button.classList.add('active');
  } else {
    const fallback = document.querySelector('.tab-btn[data-tab="' + name + '"]');
    if (fallback) fallback.classList.add('active');
  }

  const selected = document.getElementById('tab-' + name);
  if (selected) selected.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitBayar() {
  const nama = document.getElementById('bayarNama').value;
  const tanggal = document.getElementById('bayarTanggal').value;
  const jumlah = document.getElementById('bayarJumlah').value;
  const ket = document.getElementById('bayarKet').value;
  try {
    const data = await apiPost('addPayment', { pin: PIN, nama, tanggal, jumlah, keterangan: ket });
    showMsg('bayarMsg', data.message, true);
    document.getElementById('bayarKet').value = '';
    // Tunggu dashboard selesai mengambil data terbaru dari GAS sebelum
    // menganggap transaksi selesai. Ini mencegah history tertinggal.
    await refreshDashboard();
  } catch (error) {
    showMsg('bayarMsg', error.message, false);
  }
}

async function submitKeluar() {
  const tanggal = document.getElementById('keluarTanggal').value;
  const deskripsi = document.getElementById('keluarDeskripsi').value;
  const jumlah = document.getElementById('keluarJumlah').value;
  try {
    const data = await apiPost('addExpense', { pin: PIN, tanggal, deskripsi, jumlah });
    showMsg('keluarMsg', data.message, true);
    document.getElementById('keluarDeskripsi').value = '';
    document.getElementById('keluarJumlah').value = '';
    await refreshDashboard();
  } catch (error) {
    showMsg('keluarMsg', error.message, false);
  }
}

async function submitSetting() {
  const tanggalMulai = document.getElementById('setTanggalMulai').value;
  const iuranMingguan = document.getElementById('setIuran').value;
  const saldoAwal = document.getElementById('setSaldoAwal').value;
  try {
    const data = await apiPost('updateSettings', { pin: PIN, tanggalMulai, iuranMingguan, saldoAwal });
    showMsg('settingMsg', data.message, true);
    await refreshDashboard();
  } catch (error) {
    showMsg('settingMsg', error.message, false);
  }
}

async function submitSiswaBaru() {
  const nama = document.getElementById('siswaBaruNama').value;
  try {
    const data = await apiPost('addStudent', { pin: PIN, nama });
    showMsg('siswaBaruMsg', data.message, true);
    document.getElementById('siswaBaruNama').value = '';
    await refreshDashboard();
  } catch (error) {
    showMsg('siswaBaruMsg', error.message, false);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('loginBtn')?.addEventListener('click', login);

  const pinInput = document.getElementById('pinInput');
  if (pinInput) {
    pinInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') login();
    });
  }

  const tabBar = document.getElementById('tabBar');
  if (tabBar) {
    tabBar.addEventListener('click', function(e) {
      const btn = e.target.closest ? e.target.closest('.tab-btn') : null;
      if (!btn) return;
      showTab(btn.getAttribute('data-tab'), btn);
    });
  }

  document.getElementById('submitBayarBtn')?.addEventListener('click', submitBayar);
  document.getElementById('submitKeluarBtn')?.addEventListener('click', submitKeluar);
  document.getElementById('submitSettingBtn')?.addEventListener('click', submitSetting);
  document.getElementById('submitSiswaBaruBtn')?.addEventListener('click', submitSiswaBaru);
});
