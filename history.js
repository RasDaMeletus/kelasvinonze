/* Compact transaction history + mini chart for the transparency dashboard. */
(function () {
  let historyOpen = false;
  let allHistoryData = null;
  const originalRenderTxTable = window.renderTxTable;

  function listFor(data, view) {
    if (!data) return [];
    if (view === 'masuk') return data.pemasukanHistory || [];
    if (view === 'keluar') return data.pengeluaranHistory || [];
    return data.transactions || [];
  }

  function row(t) {
    const masuk = t.jenis === 'masuk';
    const cls = masuk ? 'history-in' : 'history-out';
    const sign = masuk ? '+' : '-';
    return '<tr>' +
      '<td>' + escapeHtml(t.tanggal) + '</td>' +
      '<td>' + escapeHtml(t.deskripsi) + '</td>' +
      '<td class="' + cls + '">' + sign + rupiah(t.jumlah) + '</td>' +
      '<td>' + rupiah(t.saldo) + '</td>' +
      '</tr>';
  }

  function currentView() {
    return document.querySelector('#txTabBar .tab-btn.active')?.getAttribute('data-view') || 'semua';
  }

  function chartValues(data, view) {
    const list = listFor(data, view).slice().reverse();
    return list.map(function (t, i) {
      return { label: t.tanggal || String(i + 1), value: Number(t.jumlah) || 0, saldo: Number(t.saldo) || 0, jenis: t.jenis };
    });
  }

  function renderMiniChart(view) {
    const host = document.getElementById('historyMiniChart');
    if (!host) return;
    const data = chartValues(allHistoryData, view);
    if (!data.length) {
      host.innerHTML = '<div class="history-chart-empty">Belum ada data grafik.</div>';
      return;
    }

    const W = 760, H = 180, px = 36, py = 18;
    const plotW = W - px * 2, plotH = H - py - 28;
    const max = Math.max(1, ...data.map(x => Math.max(x.value, x.saldo)));
    const x = i => data.length === 1 ? W / 2 : px + i * plotW / (data.length - 1);
    const y = v => py + plotH - (Math.max(0, v) / max) * plotH;
    const points = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const saldo = data.map(x => x.saldo);
    const amount = data.map(x => x.value);
    const labels = data.length <= 6 ? data : [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];

    host.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik riwayat transaksi">' +
        '<line x1="' + px + '" y1="' + (py + plotH) + '" x2="' + (W - px) + '" y2="' + (py + plotH) + '" class="history-axis"/>' +
        '<path d="' + points(saldo) + '" class="history-chart-saldo"/>' +
        '<path d="' + points(amount) + '" class="history-chart-amount"/>' +
        saldo.map((v, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" class="history-dot-saldo"/>').join('') +
        labels.map(function (item) {
          const i = data.indexOf(item);
          return '<text x="' + x(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" class="history-axis-text">' + escapeHtml(item.label) + '</text>';
        }).join('') +
      '</svg>' +
      '<div class="history-chart-legend">' +
        '<span><i class="history-legend-saldo"></i>Saldo</span>' +
        '<span><i class="history-legend-amount"></i>Nilai transaksi</span>' +
      '</div>';
  }

  window.renderTxTable = function (view) {
    const selected = view || currentView();
    if (typeof originalRenderTxTable === 'function') originalRenderTxTable(selected);

    const tbody = document.getElementById('tableTx');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (rows.length > 3) rows.slice(3).forEach(function (tr) { tr.remove(); });
    }

    if (historyOpen && allHistoryData) {
      renderAllHistory(selected);
      renderMiniChart(selected);
    }
  };

  function renderAllHistory(view) {
    const tbody = document.getElementById('allHistoryBody');
    if (!tbody) return;
    const list = listFor(allHistoryData, view || currentView());
    tbody.innerHTML = list.length
      ? list.map(row).join('')
      : '<tr><td colspan="4" class="muted">Belum ada transaksi.</td></tr>';
  }

  function updateModalFilter(view) {
    const modal = document.getElementById('historyModal');
    if (!modal) return;
    modal.querySelectorAll('.history-filter').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    renderAllHistory(view);
    renderMiniChart(view);
    const list = listFor(allHistoryData, view);
    const count = document.getElementById('allHistoryCount');
    if (count) count.textContent = list.length + ' transaksi';
  }

  async function openHistory() {
    const modal = document.getElementById('historyModal');
    if (!modal) return;
    historyOpen = true;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('history-lock');

    const tbody = document.getElementById('allHistoryBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="muted">Memuat seluruh riwayat...</td></tr>';

    try {
      allHistoryData = await apiGet('getTransparencyDashboard');
      updateModalFilter('semua');
    } catch (error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="muted">' + escapeHtml(error.message) + '</td></tr>';
    }
  }

  function closeHistory() {
    historyOpen = false;
    const modal = document.getElementById('historyModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('history-lock');
  }

  function setup() {
    const card = document.getElementById('txCard');
    const tabBar = document.getElementById('txTabBar');
    if (!card || !tabBar) return;

    const head = card.querySelector('.card-head');
    if (head && !document.getElementById('showAllHistoryBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'showAllHistoryBtn';
      btn.className = 'history-all-btn';
      btn.innerHTML = 'Lihat semua <span aria-hidden="true">→</span>';
      btn.addEventListener('click', openHistory);
      head.appendChild(btn);
    }

    if (!document.getElementById('historyCount')) {
      const meta = document.createElement('div');
      meta.id = 'historyCount';
      meta.className = 'history-count';
      meta.textContent = '3 transaksi terbaru';
      tabBar.parentNode.insertBefore(meta, tabBar);
    }

    if (!document.getElementById('historyModal')) {
      const modal = document.createElement('div');
      modal.id = 'historyModal';
      modal.className = 'history-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML =
        '<div class="history-backdrop" data-close-history></div>' +
        '<section class="history-sheet" role="dialog" aria-modal="true" aria-labelledby="historyTitle">' +
          '<div class="history-sheet-head">' +
            '<div><div class="section-kicker">Riwayat transaksi</div><h2 id="historyTitle">Semua Riwayat</h2><div id="allHistoryCount" class="history-count">0 transaksi</div></div>' +
            '<button type="button" class="history-close" aria-label="Tutup" data-close-history>×</button>' +
          '</div>' +
          '<div class="history-filter-bar" id="historyFilterBar">' +
            '<button type="button" class="history-filter active" data-view="semua">Semua</button>' +
            '<button type="button" class="history-filter" data-view="masuk">Pendapatan</button>' +
            '<button type="button" class="history-filter" data-view="keluar">Pengeluaran</button>' +
          '</div>' +
          '<div id="historyMiniChart" class="history-mini-chart"></div>' +
          '<div class="table-wrap history-table-wrap"><table>' +
            '<thead><tr><th>Tanggal</th><th>Keterangan</th><th>Jumlah</th><th>Saldo</th></tr></thead>' +
            '<tbody id="allHistoryBody"></tbody>' +
          '</table></div>' +
        '</section>';
      document.body.appendChild(modal);

      modal.addEventListener('click', function (e) {
        const filter = e.target.closest ? e.target.closest('.history-filter') : null;
        if (filter) updateModalFilter(filter.getAttribute('data-view'));
        if (e.target.closest && e.target.closest('[data-close-history]')) closeHistory();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && historyOpen) closeHistory();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', setup);
})();
